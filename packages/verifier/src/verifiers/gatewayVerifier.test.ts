import {afterAll, afterEach, beforeAll, describe, expect, test} from 'bun:test'
import {access, chmod, mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {SystemInfoSchema} from '../schemas'
import {type SystemInfo, toAppId} from '../types'
import {DataObjectCollector} from '../utils/dataObjectCollector'
import {
  createDefaultHardwareInfo,
  createImageVersion,
  createKmsVersion,
} from '../utils/metadataUtils'
import type {DstackVerificationResponse} from '../verification/osVerification'
import fixture from './fixtures/gateway-current-and-acme.json'
import {GatewayVerifier} from './gatewayVerifier'

const originalFetch = globalThis.fetch
const originalPath = process.env.PATH
let qvlDirectory: string

// Stand in only for the external DCAP CLI, not an in-process verifier module.
// These tests exercise evidence selection/validation contracts, not cryptography.
beforeAll(async () => {
  // The runtime prefers these absolute locations over PATH. Do not silently
  // invoke a real networked CLI instead of this test's offline stand-in.
  for (const candidate of [
    '/usr/local/bin/dcap-qvl',
    new URL('../../bin/dcap-qvl', import.meta.url),
  ]) {
    try {
      await access(candidate)
    } catch {
      continue
    }
    throw new Error(
      `Offline Gateway tests require an isolated environment without ${candidate}`,
    )
  }
  qvlDirectory = await mkdtemp(join(tmpdir(), 'gateway-qvl-test-'))
  const report = Object.fromEntries(
    [
      'tee_tcb_svn',
      'mr_seam',
      'mr_signer_seam',
      'seam_attributes',
      'td_attributes',
      'xfam',
      'mr_td',
      'mr_config_id',
      'mr_owner',
      'mr_owner_config',
      'rt_mr0',
      'rt_mr1',
      'rt_mr2',
      'rt_mr3',
    ].map((field) => [field, '00']),
  )
  report.report_data = JSON.parse(fixture.acme_info.account_quote).report_data
  const result = {status: 'UpToDate', advisory_ids: [], report: {TD10: report}}
  const executable = join(qvlDirectory, 'dcap-qvl')
  await writeFile(
    executable,
    `#!/bin/sh\nprintf '%s\\n' '${JSON.stringify(result)}'\n`,
  )
  await chmod(executable, 0o755)
})

afterAll(async () => {
  if (qvlDirectory) await rm(qvlDirectory, {recursive: true, force: true})
})

function makeSystemInfo(): SystemInfo {
  const parsed = SystemInfoSchema.parse({
    app_id: fixture.app_id,
    contract_address: null,
    kms_info: fixture.kms_info,
    instances: [],
    gateway_guest_agent_info: structuredClone(fixture.gateway_guest_agent_info),
  })
  return {
    app_id: parsed.app_id,
    contract_address: parsed.contract_address,
    kms_info: {
      ...parsed.kms_info,
      version: createKmsVersion(parsed.kms_info.version),
    },
    instances: [],
    gateway_guest_agent_info: parsed.gateway_guest_agent_info ?? undefined,
  }
}

function makeVerifier(systemInfo = makeSystemInfo()) {
  const source = {
    version: createImageVersion('dstack-0.6.1'),
    github_repo: 'https://github.com/Dstack-TEE/dstack',
    git_commit: '7f143148cc49f4a09799958835d310e050137cb3',
  }
  const collector = new DataObjectCollector()
  const verifier = new GatewayVerifier(
    {
      osSource: source,
      appSource: source,
      hardware: createDefaultHardwareInfo(),
      governance: {type: 'HostedBy', host: 'Phala'},
    },
    systemInfo,
    collector,
    'dstack-pha-prod9.phala.network',
  )
  return {verifier, collector}
}

function verifiedGatewayResponse(): DstackVerificationResponse {
  return {
    is_valid: true,
    reason: null,
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
        app_id: fixture.gateway_guest_agent_info.app_id,
        instance_id: fixture.gateway_guest_agent_info.instance_id,
        compose_hash: fixture.expected_current_compose_hash,
        os_image_hash: fixture.gateway_guest_agent_info.os_image_hash!,
      },
    },
  }
}

function mockAccountAppraisal(
  response: DstackVerificationResponse,
  account = fixture.acme_info,
) {
  process.env.PATH = `${qvlDirectory}:${originalPath}`
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    if (String(input).endsWith('/.dstack/acme-info'))
      return Response.json(account)
    if (String(input).endsWith('/verify')) return Response.json(response)
    throw new Error(`Unexpected network request: ${input}`)
  }) as unknown as typeof fetch
}

function mockAcmeResponse() {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    if (String(input).endsWith('/.dstack/acme-info')) {
      return Response.json(fixture.acme_info)
    }
    throw new Error(`Unexpected network request: ${input}`)
  }) as unknown as typeof fetch
}

describe('Gateway current execution evidence', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
    process.env.PATH = originalPath
  })

  test('regression: verifies current Gateway compose independently of persisted ACME account evidence', async () => {
    mockAcmeResponse()
    const {verifier, collector} = makeVerifier()

    // These are captured public production inputs, not synthetic hash labels.
    const acme = await verifier.getAcmeInfo()
    const oldEvents = JSON.parse(JSON.parse(acme.account_quote).event_log)
    expect(
      oldEvents.find((entry: {event: string}) => entry.event === 'compose-hash')
        .event_payload,
    ).toBe(fixture.expected_acme_compose_hash)

    expect(await verifier.verifySourceCode()).toEqual({
      isValid: true,
      failures: [],
    })
    const objects = collector.getAllObjects()
    expect(
      objects.find((object) => object.id === 'gateway-main')?.fields
        .intel_attestation_report,
    ).toBe(`0x${fixture.gateway_guest_agent_info.app_certificates[0]!.quote}`)
    expect(
      objects.find((object) => object.id === 'gateway-code')?.fields
        .compose_file,
    ).toBe(fixture.gateway_guest_agent_info.tcb_info.app_compose)
  })

  test('regression: ACME account OS rejection cannot be masked by a valid current Gateway', async () => {
    process.env.PATH = `${qvlDirectory}:${originalPath}`
    const response = verifiedGatewayResponse()
    response.is_valid = false
    response.reason = 'ACME account OS measurement mismatch'
    response.details.os_image_hash_verified = false
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
      if (String(input).endsWith('/.dstack/acme-info'))
        return Response.json(fixture.acme_info)
      if (String(input).endsWith('/verify')) return Response.json(response)
      throw new Error(`Unexpected network request: ${input}`)
    }) as unknown as typeof fetch
    const {verifier} = makeVerifier()

    expect(await verifier.verifyTeeControlledKey()).toEqual({
      isValid: false,
      error:
        'TEE controlled key verification failed: ACME account OS measurement mismatch',
    })
  })

  test('regression: accepts separately appraised historical account evidence without requiring current compose or instance', async () => {
    const response = verifiedGatewayResponse()
    response.details.app_info!.compose_hash = fixture.expected_acme_compose_hash
    response.details.app_info!.instance_id = 'different-historical-instance'
    mockAccountAppraisal(response)
    const {verifier} = makeVerifier()

    expect(await verifier.verifySourceCode()).toEqual({
      isValid: true,
      failures: [],
    })
    expect(await verifier.verifyTeeControlledKey()).toEqual({isValid: true})
  })

  test.each([
    'wrong app',
    'outdated TCB',
    'invalid log',
    'incomplete result',
  ])('invariant: rejects independently invalid ACME evidence: %s', async (variant) => {
    const response = verifiedGatewayResponse()
    if (variant === 'wrong app')
      response.details.app_info!.app_id = '00'.repeat(20)
    if (variant === 'outdated TCB') response.details.tcb_status = 'OutOfDate'
    if (variant === 'invalid log') {
      response.is_valid = false
      response.details.event_log_verified = false
      response.reason = 'ACME event log mismatch'
    }
    if (variant === 'incomplete result')
      response.details.event_log_verified = false
    mockAccountAppraisal(response)
    const {verifier} = makeVerifier()

    const result = await verifier.verifyTeeControlledKey()
    expect(result.isValid).toBe(false)
    const reason = {
      'wrong app': 'does not match the Gateway app',
      'outdated TCB': 'not UpToDate',
      'invalid log': 'ACME event log mismatch',
      'incomplete result': 'incomplete successful result',
    }[variant]!
    expect(result.error).toContain(reason)
  })

  test('invariant: binds current and account identities to the expected Gateway ID', async () => {
    mockAccountAppraisal(verifiedGatewayResponse())
    const systemInfo = makeSystemInfo()
    systemInfo.kms_info.gateway_app_id = toAppId('00'.repeat(20))
    const {verifier} = makeVerifier(systemInfo)

    expect((await verifier.verifyTeeControlledKey()).error).toContain(
      'does not match the Gateway app',
    )
  })

  test.each([
    'missing config',
    'basic config',
  ])('invariant: current modern Gateway prevents ACME %s from downgrading to DCAP-only', async (variant) => {
    const quote = JSON.parse(fixture.acme_info.account_quote)
    if (variant === 'missing config') delete quote.vm_config
    else
      quote.vm_config = JSON.stringify({
        os_image_hash: '00'.repeat(32),
        cpu_count: 1,
        memory_size: 1024,
      })
    const account = {...fixture.acme_info, account_quote: JSON.stringify(quote)}
    const response = verifiedGatewayResponse()
    response.is_valid = false
    response.reason = 'ACME VM configuration mismatch'
    mockAccountAppraisal(response, account)
    const {verifier} = makeVerifier()

    const result = await verifier.verifyTeeControlledKey()
    expect(result.isValid).toBe(false)
    expect(result.error).toContain(
      variant === 'missing config'
        ? 'ACME account VM configuration is unavailable'
        : 'ACME VM configuration mismatch',
    )
  })

  test('invariant: retains DCAP and URI verification for explicitly basic legacy evidence', async () => {
    const basicConfig = JSON.stringify({
      os_image_hash: '00'.repeat(32),
      cpu_count: 1,
      memory_size: 1024,
    })
    const quote = {
      ...JSON.parse(fixture.acme_info.account_quote),
      vm_config: basicConfig,
    }
    const account = {...fixture.acme_info, account_quote: JSON.stringify(quote)}
    mockAccountAppraisal(verifiedGatewayResponse(), account)
    const systemInfo = makeSystemInfo()
    systemInfo.gateway_guest_agent_info!.vm_config = basicConfig
    expect(
      await makeVerifier(systemInfo).verifier.verifyTeeControlledKey(),
    ).toEqual({isValid: true})

    mockAccountAppraisal(verifiedGatewayResponse(), {
      ...account,
      account_uri: 'https://acme.test/wrong-account',
    })
    const rejected =
      await makeVerifier(systemInfo).verifier.verifyTeeControlledKey()
    expect(rejected.isValid).toBe(false)
    expect(rejected.error).toContain('Report data mismatch')
  })

  test('invariant: ACME appraisal transport failure does not fall back to DCAP-only', async () => {
    process.env.PATH = `${qvlDirectory}:${originalPath}`
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
      if (String(input).endsWith('/.dstack/acme-info'))
        return Response.json(fixture.acme_info)
      throw new DOMException('ACME appraisal deadline exceeded', 'TimeoutError')
    }) as unknown as typeof fetch
    const {verifier} = makeVerifier()

    const result = await verifier.verifyTeeControlledKey()
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('ACME appraisal deadline exceeded')
  })

  test('invariant: preserves a prefixed current quote without consulting ACME', async () => {
    globalThis.fetch = (async () => {
      throw new Error('No network request expected')
    }) as unknown as typeof fetch
    const systemInfo = makeSystemInfo()
    const leaf = systemInfo.gateway_guest_agent_info!.app_certificates![0]!
    leaf.quote = `0x${leaf.quote}`
    const {verifier, collector} = makeVerifier(systemInfo)

    expect(await verifier.verifySourceCode()).toEqual({
      isValid: true,
      failures: [],
    })
    expect(
      collector.getAllObjects().find((object) => object.id === 'gateway-main')
        ?.fields.intel_attestation_report,
    ).toBe(leaf.quote)
  })

  test('invariant: still rejects a modified current compose', async () => {
    mockAcmeResponse()
    const systemInfo = makeSystemInfo()
    systemInfo.gateway_guest_agent_info!.tcb_info.app_compose += '\n'
    const {verifier} = makeVerifier(systemInfo)

    expect(await verifier.verifySourceCode()).toEqual({
      isValid: false,
      failures: [
        {
          componentId: 'gateway-main',
          error:
            'Source code verification failed: Calculated compose hash does not match the hash in RTMR3 event log',
        },
      ],
    })
  })

  test('regression: OS verification sends the current quote, event log and VM config together', async () => {
    let submitted: unknown
    globalThis.fetch = (async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      if (!String(input).endsWith('/verify'))
        throw new Error(`Unexpected network request: ${input}`)
      submitted = JSON.parse(String(init?.body))
      return Response.json(verifiedGatewayResponse())
    }) as unknown as typeof fetch
    const {verifier, collector} = makeVerifier()

    expect(await verifier.verifyOperatingSystem()).toEqual({
      isValid: true,
      failures: [],
    })
    expect(submitted).toEqual({
      quote: fixture.gateway_guest_agent_info.app_certificates[0]!.quote,
      event_log: JSON.stringify(
        fixture.gateway_guest_agent_info.tcb_info.event_log,
      ),
      vm_config: fixture.gateway_guest_agent_info.vm_config,
    })
    expect(
      collector.getAllObjects().find((object) => object.id === 'gateway-os')
        ?.fields.os_image_hash_verified,
    ).toBe(true)
  })

  test.each([
    'quote',
    'event log',
    'OS',
  ])('invariant: preserves remote %s rejection in OS and hardware checks', async (rejected) => {
    const response = verifiedGatewayResponse()
    response.is_valid = false
    response.reason = `Rejected current ${rejected} evidence`
    if (rejected === 'quote') response.details.quote_verified = false
    if (rejected === 'event log') response.details.event_log_verified = false
    if (rejected === 'OS') response.details.os_image_hash_verified = false
    globalThis.fetch = (async () =>
      Response.json(response)) as unknown as typeof fetch
    const {verifier, collector} = makeVerifier()

    expect(await verifier.verifyOperatingSystem()).toEqual({
      isValid: false,
      failures: [{componentId: 'gateway-main', error: response.reason}],
    })
    await expect(verifier.verifyHardware()).rejects.toThrow(response.reason)
    expect(collector.getAllObjects()).toEqual([])
    expect(verifier.lastQuoteHex).toBeNull()
  })

  test('invariant: rejects a verified quote for another Gateway identity', async () => {
    const response = verifiedGatewayResponse()
    response.details.app_info!.app_id = '00'.repeat(20)
    globalThis.fetch = (async () =>
      Response.json(response)) as unknown as typeof fetch
    const {verifier, collector} = makeVerifier()

    await expect(verifier.verifyOperatingSystem()).rejects.toThrow(
      'evidence does not match the requested app instance',
    )
    expect(collector.getAllObjects()).toEqual([])
  })

  test.each([
    'missing guest',
    'missing certificates',
    'CA only',
    'null quote',
    'empty quote',
  ])('invariant: fails closed on %s instead of using ACME account evidence', async (variant) => {
    mockAcmeResponse()
    const systemInfo = makeSystemInfo()
    const guest = systemInfo.gateway_guest_agent_info!
    if (variant === 'missing guest')
      systemInfo.gateway_guest_agent_info = undefined
    if (variant === 'missing certificates') guest.app_certificates = undefined
    if (variant === 'CA only')
      guest.app_certificates = guest.app_certificates!.filter(
        (cert) => cert.is_ca,
      )
    if (variant === 'null quote') guest.app_certificates![0]!.quote = null
    if (variant === 'empty quote') guest.app_certificates![0]!.quote = ''
    const {verifier, collector} = makeVerifier(systemInfo)

    await expect(verifier.verifySourceCode()).rejects.toThrow(
      'Current Gateway attestation is unavailable',
    )
    expect(collector.getAllObjects()).toEqual([])
    // Missing execution evidence must not make the separate account proof unavailable.
    expect((await verifier.getAcmeInfo()).account_quote).toBe(
      fixture.acme_info.account_quote,
    )
  })
})
