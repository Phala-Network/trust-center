// Permanent failure classification for verification task backoff.
//
// Failed tasks are re-queued with a backoff interval that depends on the
// failure class:
// - permanent/config errors: retried only after 24 hours
// - transient errors: retried after 30 minutes
//
// Permanent errors match by substring because the stored errorMessage
// carries an `App xxx:` prefix added at the caller level.
export const PERMANENT_FAILURE_PATTERNS: readonly string[] = [
  'has no running instances on Phala Cloud',
  'No CAA records found for domain',
  'do not authorize ACME account',
  'not found or is currently down on Phala Cloud',
  'Invalid VM configuration in attestation evidence',
]

export function isPermanentFailure(
  errorMessage: string | null | undefined,
): boolean {
  if (!errorMessage) {
    return false
  }
  return PERMANENT_FAILURE_PATTERNS.some((pattern) =>
    errorMessage.includes(pattern),
  )
}
