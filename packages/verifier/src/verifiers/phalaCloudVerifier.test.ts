import {afterEach, describe, expect, test} from 'bun:test'

import {DstackInstanceSchema} from '../schemas'
import type {AppId} from '../types'
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
