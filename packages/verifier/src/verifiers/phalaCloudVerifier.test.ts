import {afterEach, describe, expect, test} from 'bun:test'

import {DstackInstanceSchema, EventLogSchema, VmConfigSchema} from '../schemas'
import type {AppId} from '../types'
import {DataObjectCollector} from '../utils/dataObjectCollector'
import {decodeQuote} from '../utils/dcap-qvl'
import {
  createDefaultHardwareInfo,
  createGatewayMetadata,
  createImageVersion,
  createKmsMetadata,
} from '../utils/metadataUtils'
import {verifyDstackEvidence} from '../verification/osVerification'
import {VerificationService} from '../verificationService'
import {GatewayVerifier} from './gatewayVerifier'
import {PhalaCloudKmsVerifier} from './phalaCloudKmsVerifier'
import {PhalaCloudVerifier} from './phalaCloudVerifier'

const originalFetch = globalThis.fetch

function mockCloudAttestationsResponse(body: unknown) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: {'content-type': 'application/json'},
    })) as unknown as typeof fetch
}

function makeSystemInfoPayload(instances: unknown[]) {
  return {
    app_id: 'abcd',
    contract_address: null,
    kms_info: {
      contract_address: null,
      chain_id: null,
      version: 'v0.5.3 (git:abc123)',
      url: 'https://kms.example.test',
      gateway_app_id: null,
      gateway_app_url: 'https://gateway.example.test',
    },
    instances,
  }
}

describe('PhalaCloudVerifier attestations parsing', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('accepts nullable instance fields from stopped instances', () => {
    const result = DstackInstanceSchema.safeParse({
      quote: null,
      eventlog: null,
      tcb_info: null,
      image_version: null,
    })

    expect(result.success).toBe(true)
  })

  test('filters nullable quote instances before quote normalization', async () => {
    mockCloudAttestationsResponse(
      makeSystemInfoPayload([
        {
          quote: null,
          eventlog: [],
          image_version: 'dstack-0.5.3',
        },
        {
          quote: 'abc123',
          eventlog: [],
          image_version: 'dstack-0.5.3',
        },
      ]),
    )

    const systemInfo = await PhalaCloudVerifier.getSystemInfo('abcd' as AppId)

    expect(systemInfo.instances).toHaveLength(1)
    expect(systemInfo.instances[0]?.quote).toBe('0xabc123')
    expect(systemInfo.instances[0]?.eventlog).toEqual([])
    expect(String(systemInfo.instances[0]?.image_version)).toBe('dstack-0.5.3')
  })

  test('reports no running instances when every parsed instance is invalid', async () => {
    mockCloudAttestationsResponse(
      makeSystemInfoPayload([
        {
          quote: null,
          eventlog: [],
          image_version: 'dstack-0.5.3',
        },
        {
          quote: 'abc123',
          eventlog: null,
          image_version: null,
        },
      ]),
    )

    await expect(
      PhalaCloudVerifier.getSystemInfo('abcd' as AppId),
    ).rejects.toThrow("App 'abcd' has no running instances on Phala Cloud")
  })
})

describe('verifier evidence preservation', () => {
  test('preserves lite measurement material and V2 event evidence', () => {
    const config = {
      spec_version: 1,
      os_image_hash: 'ab'.repeat(32),
      cpu_count: 2,
      memory_size: 2147483648,
      qemu_version: '8.2.2',
      pci_hole64_size: 0,
      hugepages: false,
      num_gpus: 0,
      num_nvswitches: 0,
      hotplug_off: false,
      image: 'dstack-0.6.0',
      host_share_mode: '9p',
      ovmf_variant: 'pre202505',
      tdx_attestation_variant: 'lite',
      tdx_measurement: {measurement: 'Y2Jvcg==', checksum_file: 'bWFuaWZlc3Q='},
    }
    expect(VmConfigSchema.parse(config)).toEqual(config)
    const events = [
      {
        imr: 3,
        event_type: 134217729,
        digest: 'ab'.repeat(48),
        event: 'app-id',
        event_payload: 'abcd',
        version: 2,
        preimage: '1234',
      },
    ]
    expect(EventLogSchema.parse(events)).toEqual(events)
  })
})

const appId = 'ab'.repeat(20)
const instanceId = 'cd'.repeat(20)
const serviceResponse = {
  is_valid: true,
  details: {
    quote_verified: true,
    event_log_verified: true,
    os_image_hash_verified: true,
    acpi_tables_verified: true,
    os_image_version: null,
    os_image_is_dev: null,
    tee_variant: 'dstack-tdx',
    tcb_status: 'UpToDate',
    advisory_ids: [],
    report_data: '00'.repeat(64),
    app_info: {
      app_id: appId,
      instance_id: instanceId,
      compose_hash: 'ef'.repeat(32),
      os_image_hash: 'ab'.repeat(32),
    },
  },
  reason: null,
}

describe('Rust verifier HTTP contract', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('passes complete evidence and accepts missing descriptive OS metadata', async () => {
    const evidence = {
      quote: 'abcd',
      event_log: '[]',
      vm_config:
        '{"tdx_attestation_variant":"lite","tdx_measurement":{"measurement":"Y2Jvcg==","checksum_file":"ZGlnZXN0"}}',
    }
    let received: unknown
    globalThis.fetch = (async (
      _url: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      received = JSON.parse(String(init?.body))
      return Response.json(serviceResponse)
    }) as unknown as typeof fetch
    const result = await verifyDstackEvidence(evidence)
    expect(received).toEqual(evidence)
    expect(result.is_valid).toBe(true)
    expect(result.details.os_image_version).toBeNull()
  })

  test('does not treat HTTP 200 verification rejection as success', async () => {
    mockCloudAttestationsResponse({
      ...serviceResponse,
      is_valid: false,
      reason: 'OS image hash verification failed: MRs do not match',
    })
    const result = await verifyDstackEvidence({attestation: 'abcd'})
    expect(result.is_valid).toBe(false)
    expect(result.reason).toContain('MRs do not match')
  })

  test('rejects an incomplete successful result', async () => {
    mockCloudAttestationsResponse({
      ...serviceResponse,
      details: {...serviceResponse.details, os_image_hash_verified: false},
    })
    await expect(verifyDstackEvidence({attestation: 'abcd'})).rejects.toThrow(
      'incomplete',
    )
  })
})

const liteVmConfig = {
  spec_version: 1,
  os_image_hash: 'ab'.repeat(32),
  cpu_count: 2,
  memory_size: 2147483648,
  qemu_version: '8.2.2',
  pci_hole64_size: 0,
  hugepages: false,
  num_gpus: 0,
  num_nvswitches: 0,
  hotplug_off: false,
  image: 'dstack-0.6.0-rc0',
  tdx_attestation_variant: 'lite',
  tdx_measurement: {measurement: 'Y2Jvcg==', checksum_file: 'bWFuaWZlc3Q='},
}

function makeAppInfo() {
  return {
    app_id: appId,
    instance_id: instanceId,
    app_name: 'test-app',
    app_cert: '',
    device_id: '',
    mr_aggregated: '',
    os_image_hash: liteVmConfig.os_image_hash,
    compose_hash: 'ef'.repeat(32),
    key_provider_info: JSON.stringify({name: 'local', id: ''}),
    vm_config: JSON.stringify(liteVmConfig),
    tcb_info: JSON.stringify({
      mrtd: '01'.repeat(48),
      rtmr0: '02'.repeat(48),
      rtmr1: '03'.repeat(48),
      rtmr2: '04'.repeat(48),
      rtmr3: '05'.repeat(48),
      mr_aggregated: '',
      os_image_hash: liteVmConfig.os_image_hash,
      compose_hash: 'ef'.repeat(32),
      device_id: '',
      event_log: [],
      app_compose: '{}',
    }),
  }
}

describe('App OS verification via Rust service', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('generates an OS report without local image metadata', async () => {
    let verifierRequests = 0
    globalThis.fetch = (async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      const url = String(input)
      if (url.endsWith('/attestations'))
        return Response.json({
          ...makeSystemInfoPayload([
            {
              quote: 'abcd',
              eventlog: [],
              image_version: 'dstack-0.6.0-rc0',
              instance_id: instanceId,
            },
          ]),
          app_id: appId,
        })
      if (url.endsWith('/prpc/Info')) return Response.json(makeAppInfo())
      if (url.endsWith('/verify')) {
        verifierRequests++
        const evidence = JSON.parse(String(init?.body))
        expect(evidence.quote).toBe('abcd')
        expect(JSON.parse(evidence.vm_config)).toEqual(liteVmConfig)
        return Response.json(serviceResponse)
      }
      throw new Error(`Unexpected network request: ${url}`)
    }) as unknown as typeof fetch
    const systemInfo = await PhalaCloudVerifier.getSystemInfo(appId as AppId)
    const collector = new DataObjectCollector()
    const verifier = new PhalaCloudVerifier(
      systemInfo,
      'example.test',
      {
        osSource: {
          version: createImageVersion('dstack-0.6.0-rc0'),
          github_repo: 'https://github.com/Dstack-TEE/dstack',
          git_commit: '',
        },
        hardware: createDefaultHardwareInfo(),
        governance: {type: 'HostedBy', host: 'Phala'},
      },
      collector,
    )
    expect((await verifier.verifyOperatingSystem()).isValid).toBe(true)
    expect((await verifier.verifyOperatingSystem()).isValid).toBe(true)
    expect(verifierRequests).toBe(1)
    const os = collector
      .getAllObjects()
      .find((object) => object.id === 'app-os')
    expect(os?.fields.os_image_hash).toBe(liteVmConfig.os_image_hash)
    expect(os?.fields.os_image_hash_verified).toBe(true)
    expect(os?.fields.bios).toBeUndefined()
  })
})

function makeGuestInfo() {
  const info = makeAppInfo()
  return {
    ...info,
    public_logs: false,
    public_sysinfo: true,
    mr_key_provider: null,
    tcb_info: {...JSON.parse(info.tcb_info), rootfs_hash: null},
    app_certificates: [
      {
        subject: {
          common_name: 'test',
          organization: null,
          country: null,
          state: null,
          locality: null,
        },
        issuer: {common_name: 'test', organization: null, country: null},
        serial_number: '1',
        not_before: '',
        not_after: '',
        version: '3',
        fingerprint: '',
        signature_algorithm: '',
        sans: null,
        is_ca: false,
        position_in_chain: 0,
        quote: 'abcd',
        app_id: appId,
        cert_usage: null,
      },
    ],
  }
}

for (const kind of ['kms', 'gateway'] as const) {
  describe(`${kind} OS verification via Rust service`, () => {
    afterEach(() => {
      globalThis.fetch = originalFetch
    })
    test('uses verified image identity instead of the KMS software version', async () => {
      globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
        const url = String(input)
        if (url.endsWith('/attestations')) {
          const payload = makeSystemInfoPayload([
            {quote: 'abcd', eventlog: [], image_version: 'dstack-0.5.8'},
          ])
          payload.kms_info.version = 'v0.6.0-rc0 (git:abc123)'
          return Response.json({
            ...payload,
            app_id: appId,
            kms_guest_agent_info: makeGuestInfo(),
            gateway_guest_agent_info: makeGuestInfo(),
          })
        }
        if (url.endsWith('/verify')) return Response.json(serviceResponse)
        if (url.endsWith('/.dstack/acme-info'))
          return Response.json({
            account_uri: 'https://acme.test/account',
            account_quote: JSON.stringify({quote: 'abcd', event_log: '[]'}),
          })
        throw new Error(`Unexpected network request: ${url}`)
      }) as unknown as typeof fetch
      const systemInfo = await PhalaCloudVerifier.getSystemInfo(appId as AppId)
      const collector = new DataObjectCollector()
      const metadata = {
        osSource: {
          version: createImageVersion('dstack-0.6.0-rc0'),
          github_repo: 'https://github.com/Dstack-TEE/dstack',
          git_commit: '',
        },
        hardware: createDefaultHardwareInfo(),
        governance: {type: 'HostedBy' as const, host: 'Phala' as const},
      }
      const metadataWithSource = {...metadata, appSource: metadata.osSource}
      const verifier =
        kind === 'kms'
          ? new PhalaCloudKmsVerifier(metadataWithSource, systemInfo, collector)
          : new GatewayVerifier(
              metadataWithSource,
              systemInfo,
              collector,
              'example.test',
            )
      expect((await verifier.verifyOperatingSystem()).isValid).toBe(true)
      expect(
        collector.getAllObjects().find((object) => object.id === `${kind}-os`)
          ?.fields.os_image_hash,
      ).toBe(liteVmConfig.os_image_hash)
    })
  })
}

describe('new verifier orchestration', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('reaches OS verification for RC images without a GitHub version lookup', async () => {
    let verificationRequests = 0
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input)
      if (url.endsWith('/attestations'))
        return Response.json({
          ...makeSystemInfoPayload([
            {quote: 'abcd', eventlog: [], image_version: 'dstack-0.6.0-rc0'},
          ]),
          app_id: appId,
        })
      if (url.endsWith('/prpc/Info')) return Response.json(makeAppInfo())
      if (url.endsWith('/verify')) {
        verificationRequests++
        return Response.json(serviceResponse)
      }
      throw new Error(`Unexpected network request: ${url}`)
    }) as unknown as typeof fetch
    const result = await new VerificationService().verify(
      {appId: appId as AppId, domain: 'example.test'},
      {
        hardware: false,
        os: true,
        sourceCode: false,
        teeControlledKey: false,
        certificateKey: false,
        dnsCAA: false,
        ctLog: false,
      },
    )
    expect(result.errors).toEqual([])
    expect(result.success).toBe(true)
    expect(verificationRequests).toBe(1)
    expect(
      result.dataObjects.find((object) => object.id === 'app-os')?.fields
        .os_image_hash_verified,
    ).toBe(true)
  })

  test('surfaces the Rust quote failure during the hardware phase', async () => {
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input)
      if (url.endsWith('/attestations'))
        return Response.json({
          ...makeSystemInfoPayload([
            {quote: 'abcd', eventlog: [], image_version: 'dstack-0.6.0-rc0'},
          ]),
          app_id: appId,
        })
      if (url.endsWith('/prpc/Info')) return Response.json(makeAppInfo())
      if (url.endsWith('/verify'))
        return Response.json({
          ...serviceResponse,
          is_valid: false,
          details: {...serviceResponse.details, quote_verified: false},
          reason: 'Quote verification failed: invalid signature',
        })
      throw new Error(`Unexpected network request: ${url}`)
    }) as unknown as typeof fetch
    const info = await PhalaCloudVerifier.getSystemInfo(appId as AppId)
    const verifier = new PhalaCloudVerifier(
      info,
      'example.test',
      {
        osSource: {
          version: createImageVersion('dstack-0.6.0-rc0'),
          github_repo: 'https://github.com/Dstack-TEE/dstack',
          git_commit: '',
        },
        hardware: createDefaultHardwareInfo(),
        governance: {type: 'HostedBy', host: 'Phala'},
      },
      new DataObjectCollector(),
    )
    await expect(verifier.verifyHardware()).rejects.toThrow(
      'Quote verification failed: invalid signature',
    )
  })
})

describe('Rust verifier transport failures', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })
  test('rejects HTTP errors and malformed responses', async () => {
    globalThis.fetch = (async () =>
      new Response('unavailable', {status: 503})) as unknown as typeof fetch
    await expect(verifyDstackEvidence({attestation: 'abcd'})).rejects.toThrow(
      'HTTP 503',
    )
    mockCloudAttestationsResponse({is_valid: true})
    await expect(verifyDstackEvidence({attestation: 'abcd'})).rejects.toThrow()
  })
  test('propagates an aborted request without retrying or downgrading', async () => {
    let requests = 0
    globalThis.fetch = (async () => {
      requests++
      throw new DOMException('deadline exceeded', 'TimeoutError')
    }) as unknown as typeof fetch
    await expect(verifyDstackEvidence({attestation: 'abcd'})).rejects.toThrow(
      'deadline exceeded',
    )
    expect(requests).toBe(1)
  })
})

const integrationFixture = process.env.DSTACK_VERIFIER_TEST_FIXTURE

describe('pinned Rust verifier integration', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test.skipIf(!integrationFixture)(
    'verifies real lite evidence and rejects tampering without image downloads',
    async () => {
      const fixture = await Bun.file(integrationFixture!).json()
      const result = await verifyDstackEvidence(fixture)
      expect(result.is_valid).toBe(true)
      expect(result.details.os_image_hash_verified).toBe(true)
      expect(result.details.acpi_tables_verified).toBe(true)
      expect(result.details.os_image_version).toBeNull()
      const fullEvidence = await Bun.file(
        integrationFixture!.replace('getquote.json', 'attestation.json'),
      ).json()
      expect((await verifyDstackEvidence(fullEvidence)).is_valid).toBe(true)
      const config = JSON.parse(fixture.vm_config)
      for (const changed of [
        {...config, os_image_hash: '00'.repeat(32)},
        {...config, memory_size: config.memory_size + 1073741824},
        {...config, tdx_measurement: undefined},
        {...config, tdx_attestation_variant: 'legacy'},
        {
          ...config,
          tdx_measurement: {...config.tdx_measurement, measurement: 'AAAA'},
        },
      ]) {
        const response = await verifyDstackEvidence({
          ...fixture,
          vm_config: JSON.stringify(changed),
        })
        expect(response.is_valid).toBe(false)
        expect(response.reason).toBeTruthy()
      }
      const events = JSON.parse(fixture.event_log)
      const compose = events.find(
        (event: {event: string}) => event.event === 'compose-hash',
      )
      compose.event_payload = '00'.repeat(32)
      expect(
        (
          await verifyDstackEvidence({
            ...fixture,
            event_log: JSON.stringify(events),
          })
        ).is_valid,
      ).toBe(false)
      expect(
        (
          await verifyDstackEvidence({
            ...fixture,
            quote: '00' + fixture.quote.slice(2),
          })
        ).is_valid,
      ).toBe(false)
    },
    120_000,
  )

  test.skipIf(!integrationFixture)(
    'runs App/KMS/Gateway hardware and OS phases through the pinned service',
    async () => {
      const fixture = await Bun.file(integrationFixture!).json()
      const verified = await verifyDstackEvidence(fixture)
      const identity = verified.details.app_info!
      const quote = `0x${fixture.quote.replace(/^0x/, '')}` as const
      const decoded = await decodeQuote(quote, {hex: true})
      const td = decoded.report.TD10
      const events = JSON.parse(fixture.event_log)
      const info = {
        ...makeAppInfo(),
        app_id: identity.app_id,
        instance_id: identity.instance_id,
        compose_hash: identity.compose_hash,
        os_image_hash: identity.os_image_hash,
        vm_config: fixture.vm_config,
        tcb_info: JSON.stringify({
          mrtd: td.mr_td,
          rtmr0: td.rt_mr0,
          rtmr1: td.rt_mr1,
          rtmr2: td.rt_mr2,
          rtmr3: td.rt_mr3,
          mr_aggregated: '',
          device_id: '',
          os_image_hash: identity.os_image_hash,
          compose_hash: identity.compose_hash,
          app_compose: '{}',
          event_log: events,
        }),
      }
      const guest = {
        ...makeGuestInfo(),
        ...info,
        tcb_info: {...JSON.parse(info.tcb_info), rootfs_hash: null},
      }
      guest.app_certificates[0]!.quote = fixture.quote
      let serviceCalls = 0
      let outOfDate = false
      globalThis.fetch = (async (
        input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ) => {
        const url = String(input)
        if (url.endsWith('/verify')) {
          serviceCalls++
          const response = await originalFetch(input, init)
          const body = (await response.json()) as typeof serviceResponse
          if (outOfDate) body.details.tcb_status = 'OutOfDate'
          return Response.json(body)
        }
        if (url.endsWith('/attestations')) {
          const payload = makeSystemInfoPayload([
            {
              quote: fixture.quote,
              eventlog: events,
              vm_config: fixture.vm_config,
              instance_id: identity.instance_id,
              image_version: 'dstack-0.6.0-rc0',
            },
          ])
          payload.kms_info.version = 'v0.6.0-rc0 (git:abc123)'
          return Response.json({
            ...payload,
            app_id: identity.app_id,
            kms_guest_agent_info: guest,
            gateway_guest_agent_info: guest,
          })
        }
        if (url.endsWith('/prpc/Info')) return Response.json(info)
        if (url.endsWith('/.dstack/acme-info'))
          return Response.json({
            account_uri: 'https://acme.test/account',
            account_quote: JSON.stringify(fixture),
          })
        if (url.includes('redpill')) return Response.json({data: []})
        throw new Error(`Unexpected network request: ${url}`)
      }) as unknown as typeof fetch
      const flags = {
        hardware: true,
        os: true,
        sourceCode: false,
        teeControlledKey: false,
        certificateKey: false,
        dnsCAA: false,
        ctLog: false,
      }
      const app = {appId: identity.app_id as AppId, domain: 'example.test'}
      const result = await new VerificationService().verify(app, flags)
      expect(result.errors).toEqual([])
      expect(result.failures).toEqual([])
      expect(result.success).toBe(true)
      expect(serviceCalls).toBe(3)
      for (const kind of ['kms', 'gateway', 'app']) {
        expect(
          result.dataObjects.find((object) => object.id === `${kind}-os`)
            ?.fields.os_image_hash_verified,
        ).toBe(true)
        expect(
          result.dataObjects.find((object) => object.id === `${kind}-quote`)
            ?.fields.mrtd,
        ).toBe(td.mr_td)
      }
      outOfDate = true
      const rejected = await new VerificationService().verify(app, flags)
      expect(rejected.success).toBe(false)
      expect(
        rejected.failures.filter((failure) =>
          failure.error.includes('OutOfDate'),
        ),
      ).toHaveLength(3)
    },
    120_000,
  )
})

describe('KMS and Gateway OS metadata', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })
  test('does not infer either OS image from the KMS software version', async () => {
    const payload = makeSystemInfoPayload([
      {quote: 'abcd', eventlog: [], image_version: 'dstack-0.5.8'},
    ])
    payload.kms_info.version = 'v0.6.0-rc0 (git:abc123)'
    mockCloudAttestationsResponse({
      ...payload,
      kms_guest_agent_info: {
        ...makeGuestInfo(),
        vm_config: JSON.stringify({...liteVmConfig, image: 'dstack-0.5.8'}),
      },
      gateway_guest_agent_info: {
        ...makeGuestInfo(),
        vm_config: JSON.stringify({...liteVmConfig, image: 'dstack-0.5.7'}),
      },
    })
    const info = await PhalaCloudVerifier.getSystemInfo('abcd' as AppId)
    expect(String(createKmsMetadata(info).osSource.version)).toBe(
      'dstack-0.5.8',
    )
    expect(String(createGatewayMetadata(info).osSource.version)).toBe(
      'dstack-0.5.7',
    )
  })
})

describe('app instance evidence binding', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })
  for (const scenario of ['wrong-instance', 'os-rejected'] as const) {
    test(`does not create a report for ${scenario}`, async () => {
      let serviceCalls = 0
      globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
        const url = String(input)
        if (url.endsWith('/attestations'))
          return Response.json({
            ...makeSystemInfoPayload([
              {
                quote: 'abcd',
                eventlog: [],
                vm_config: JSON.stringify(liteVmConfig),
                instance_id:
                  scenario === 'wrong-instance' ? '11'.repeat(20) : instanceId,
                image_version: 'dstack-0.6.0-rc0',
              },
            ]),
            app_id: appId,
          })
        if (url.endsWith('/prpc/Info')) return Response.json(makeAppInfo())
        if (url.endsWith('/verify')) {
          serviceCalls++
          return Response.json(
            scenario === 'os-rejected'
              ? {
                  ...serviceResponse,
                  is_valid: false,
                  reason:
                    'OS image hash verification failed: missing measurement',
                }
              : serviceResponse,
          )
        }
        throw new Error(`Unexpected network request: ${url}`)
      }) as unknown as typeof fetch
      const systemInfo = await PhalaCloudVerifier.getSystemInfo(appId as AppId)
      expect(systemInfo.instances[0]?.vm_config).toBe(
        JSON.stringify(liteVmConfig),
      )
      const collector = new DataObjectCollector()
      const verifier = new PhalaCloudVerifier(
        systemInfo,
        'example.test',
        {
          osSource: {
            version: createImageVersion('dstack-0.6.0-rc0'),
            github_repo: 'https://github.com/Dstack-TEE/dstack',
            git_commit: '',
          },
          hardware: createDefaultHardwareInfo(),
          governance: {type: 'HostedBy', host: 'Phala'},
        },
        collector,
      )
      if (scenario === 'wrong-instance') {
        await expect(verifier.verifyOperatingSystem()).rejects.toThrow(
          'does not match the requested app instance',
        )
      } else {
        expect((await verifier.verifyOperatingSystem()).isValid).toBe(false)
        expect(
          (await verifier.verifyOperatingSystem()).failures[0]?.error,
        ).toContain('missing measurement')
      }
      expect(serviceCalls).toBe(1)
      expect(collector.getAllObjects()).toHaveLength(0)
    })
  }
})
