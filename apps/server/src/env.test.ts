import {expect, test} from 'bun:test'

// Configuration is evaluated at import time. Use only existing env names in an
// isolated child; never load developer dotenv files or contact external services.
test('existing Cloud API key and cron overrides work without any new deployment environment', async () => {
  const module = new URL('./env.ts', import.meta.url).href
  const appModule = new URL('./app.ts', import.meta.url).href
  for (const [profileOverride, apiKey] of [
    [undefined, 'legacy-key'],
    ['*/1 * * * *', 'legacy-key'],
    [undefined, ''],
    ['*/1 * * * *', ''],
  ] as const) {
    const child = Bun.spawn(
      [
        process.execPath,
        '--no-env-file',
        '-e',
        `
        import {env} from ${JSON.stringify(module)};
        if (env.PHALA_CLOUD_API_KEY !== ${JSON.stringify(apiKey)}) throw new Error('existing API key failed');
        if (env.CRON_API_KEY !== 'cron-admin-key') throw new Error('cron key changed');
        if (env.PROFILE_CRON_PATTERN !== ${JSON.stringify(profileOverride ?? '*/10 * * * *')}) throw new Error('profile override/default failed');
        if (env.APP_CRON_PATTERN !== '*/1 * * * *') throw new Error('app default changed');
        const {createHmac} = await import('node:crypto');
        const {createApp} = await import(${JSON.stringify(appModule)});
        const app = createApp();
        for (const [name, pattern] of [
          ['sync-profiles', env.PROFILE_CRON_PATTERN],
          ['sync-apps', env.APP_CRON_PATTERN],
        ]) {
          const cron = app.store.cron[name];
          if (cron.options.protect !== true) throw new Error(name + ' protection missing');
          if (cron.getPattern() !== pattern) throw new Error(name + ' cadence changed');
        }
        if (Object.values(app.store.cron).filter(cron => cron.options.protect === true).length !== 2) throw new Error('only profile/app jobs should be protected');
        for (const cron of Object.values(app.store.cron ?? {})) cron.stop();
        const timestamp = String(Math.floor(Date.now() / 1000));
        const raw = '{'; // Signed malformed JSON tests auth without touching DB.
        const call = key => app.handle(new Request('http://localhost/webhooks/phala-cloud', {
          method: 'POST', body: raw, headers: {'Content-Type': 'application/json',
            'X-Phala-Timestamp': timestamp,
            'X-Phala-Signature': 'sha256=' + createHmac('sha256', key).update(timestamp + '.' + raw).digest('hex')},
        }));
        if ((await call(env.PHALA_CLOUD_API_KEY)).status !== ${apiKey ? 400 : 503}) throw new Error('existing Cloud key not bound to webhook');
        if ((await call(env.CRON_API_KEY)).status !== ${apiKey ? 401 : 503}) throw new Error('cron management key accepted as webhook key');
        console.log('configuration ready');
        process.exit(0);
      `,
      ],
      {
        env: {
          S3_ENDPOINT: 'http://127.0.0.1:1',
          S3_ACCESS_KEY_ID: 'test-only',
          S3_SECRET_ACCESS_KEY: 'test-only',
          S3_BUCKET: 'test-only',
          CRON_API_KEY: 'cron-admin-key',
          PHALA_CLOUD_API_KEY: apiKey,
          ...(profileOverride === undefined
            ? {}
            : {PROFILE_CRON_PATTERN: profileOverride}),
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    const output = await new Response(child.stdout).text()
    const error = await new Response(child.stderr).text()
    expect(await child.exited).toBe(0)
    expect(error).toBe('')
    expect(output.trim()).toBe('configuration ready')
  }
}, 15000)

test('regression: configured profile and app cron scheduled ticks never overlap an active run', async () => {
  const appModule = new URL('./app.ts', import.meta.url).href
  const child = Bun.spawn(
    [
      process.execPath,
      '--no-env-file',
      '-e',
      `
      const {createApp} = await import(${JSON.stringify(appModule)});
      const app = createApp();
      for (const cron of Object.values(app.store.cron ?? {})) cron.stop();
      const jobs = [];
      let release;
      const barrier = new Promise(resolve => { release = resolve; });
      const waitFor = async (predicate, label) => {
        const deadline = Date.now() + 5000;
        while (!predicate()) {
          if (Date.now() > deadline) throw new Error('timed out: ' + label);
          await Bun.sleep(10);
        }
      };
      const schedule = (configured, options) => {
        const state = {starts: 0, active: 0, maxActive: 0};
        const cron = new configured.constructor('* * * * * *', options, async () => {
          state.starts++;
          state.active++;
          state.maxActive = Math.max(state.maxActive, state.active);
          await barrier;
          state.active--;
        });
        jobs.push(cron);
        return {cron, state};
      };
      try {
        const cases = ['sync-profiles', 'sync-apps'].map(name => {
          const configured = app.store.cron[name];
          if (!configured) throw new Error(name + ' is not configured');
          return {
            name, configured,
            scheduled: schedule(configured, {...configured.options}),
            control: schedule(configured, {...configured.options, protect: false}),
          };
        });
        await waitFor(() => cases.every(({control}) => control.state.starts >= 3), 'three scheduled control ticks');
        for (const {name, configured, scheduled, control} of cases) {
          if (control.state.maxActive < 3) throw new Error(name + ' control did not overlap');
          if (scheduled.state.starts !== 1 || scheduled.state.maxActive !== 1) {
            throw new Error(name + ' overlapped active scheduled run: starts=' + scheduled.state.starts + ', maxActive=' + scheduled.state.maxActive);
          }
          if (configured.options.protect !== true) throw new Error(name + ' must configure protect: true');
          if (!scheduled.cron.isBusy()) throw new Error(name + ' barrier did not hold active run');
        }
        release();
        await waitFor(() => cases.every(({scheduled}) => scheduled.state.active === 0), 'barrier release');
        await waitFor(() => cases.every(({scheduled}) => scheduled.state.starts >= 2), 'scheduled sync resumes');
        for (const {name, scheduled} of cases) {
          if (scheduled.state.maxActive !== 1) throw new Error(name + ' resumed with overlap');
        }
        console.log('scheduled non-overlap invariant ready');
      } finally {
        for (const cron of jobs) cron.stop();
        release();
      }
    `,
    ],
    {
      env: {
        S3_ENDPOINT: 'http://127.0.0.1:1',
        S3_ACCESS_KEY_ID: 'test-only',
        S3_SECRET_ACCESS_KEY: 'test-only',
        S3_BUCKET: 'test-only',
        CRON_API_KEY: 'cron-admin-key',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  const output = await new Response(child.stdout).text()
  const error = await new Response(child.stderr).text()
  expect(error).toBe('')
  expect(await child.exited).toBe(0)
  expect(output.trim()).toBe('scheduled non-overlap invariant ready')
}, 12000)
