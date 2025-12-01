import {createHash} from 'node:crypto'

import type {EventLog} from '../types'

/**
 * Replays the RTMR hash calculation from a history of event digests.
 * Reference implementation: https://github.com/Dstack-TEE/dstack/blob/2ccc6a74e9dbf15ce299b437e1d156c573896dd0/sdk/js/src/index.ts#L106
 */
export function replayRtmr(history: string[]): string {
  const INIT_MR =
    '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
  if (history.length === 0) {
    return INIT_MR
  }
  let mr = Buffer.from(INIT_MR, 'hex')
  for (const content of history) {
    // Convert hex string to buffer
    let contentBuffer = Buffer.from(content, 'hex')
    // Pad content with zeros if shorter than 48 bytes
    if (contentBuffer.length < 48) {
      const padding = Buffer.alloc(48 - contentBuffer.length, 0)
      contentBuffer = Buffer.concat([contentBuffer, padding])
    }
    mr = createHash('sha384')
      .update(Buffer.concat([mr, contentBuffer]))
      .digest()
  }
  return mr.toString('hex')
}

export interface EventLogVerificationResult {
  isValid: boolean
  failures: string[]
}

/**
 * Verifies that the event log replays to the expected RTMR values.
 */
export function verifyEventLog(
  eventLog: EventLog,
  rtmrs: {
    rtmr0: string
    rtmr1: string
    rtmr2: string
    rtmr3: string
  },
): EventLogVerificationResult {
  const failures: string[] = []
  const expectedRtmrs = [rtmrs.rtmr0, rtmrs.rtmr1, rtmrs.rtmr2, rtmrs.rtmr3]

  for (let idx = 0; idx < 4; idx++) {
    const history = eventLog
      .filter((event) => event.imr === idx)
      .map((event) => event.digest)
    const calculatedRtmr = replayRtmr(history)

    if (calculatedRtmr !== expectedRtmrs[idx]) {
      failures.push(
        `Event log verification failed for RTMR${idx}: calculated ${calculatedRtmr} does not match expected ${expectedRtmrs[idx]}`,
      )
    }
  }

  return {
    isValid: failures.length === 0,
    failures,
  }
}
