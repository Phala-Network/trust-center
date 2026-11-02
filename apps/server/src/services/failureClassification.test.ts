import {describe, expect, test} from 'bun:test'

import {isPermanentFailure} from './failureClassification'

describe('isPermanentFailure', () => {
  test('matches each permanent failure pattern with App prefix', () => {
    const messages = [
      'App my-app: has no running instances on Phala Cloud',
      'App gateway-1: No CAA records found for domain example.com',
      'App tls-app: CAA records do not authorize ACME account for issuance',
      'App ghost: not found or is currently down on Phala Cloud',
      'App bad-vm: Invalid VM configuration in attestation evidence',
      'App gone: Phala Cloud guest-agent-info returned 404: unknown or deleted app or instance',
      'App cfg: Phala Cloud guest-agent-info returned 401: missing or invalid Phala Cloud API token',
    ]

    for (const message of messages) {
      expect(isPermanentFailure(message)).toBe(true)
    }
  })

  test('does not match transient errors', () => {
    const transientMessages = [
      'App my-app: fetch failed',
      'App my-app: ETIMEDOUT',
      'App my-app: OutOfDate: expected measurement ...',
      'App my-app: RTMR mismatch: RTMR0 differs',
      // 503 from the guest-agent-info proxy: CVM not running / unreachable
      'App down: Phala Cloud guest-agent-info request failed: 503 Service Unavailable',
      'some random error string',
    ]

    for (const message of transientMessages) {
      expect(isPermanentFailure(message)).toBe(false)
    }
  })

  test('does not match null or empty error message', () => {
    expect(isPermanentFailure(null)).toBe(false)
    expect(isPermanentFailure(undefined)).toBe(false)
    expect(isPermanentFailure('')).toBe(false)
  })
})
