import {createHash} from 'node:crypto'
import type {AppInfo, EventLog, QuoteData} from '../types'
import type {DstackApp} from '../utils/dstackContract'
import {calculate, measure} from '../utils/operations'

/**
 * Verifies source code authenticity by validating compose hash.
 *
 * @param appInfo - Application information containing compose config
 * @param quoteData - Quote data containing event log
 * @param registryContract - Optional registry contract for hash validation
 * @param objectId - Object ID for measurement tracking
 * @returns Promise resolving to verification result with calculated hash
 */
export async function verifyComposeHash(
  appInfo: AppInfo,
  quoteData: QuoteData,
  registryContract?: DstackApp,
  objectId?: string,
): Promise<{isValid: boolean; calculatedHash: string; isRegistered?: boolean}> {
  const appComposeConfig = appInfo.tcb_info.app_compose
  const composeHashEvent = findComposeHashEvent(quoteData.eventlog)

  if (!composeHashEvent) {
    return {isValid: false, calculatedHash: ''}
  }

  // Check if hash is registered on-chain (if registry provided)
  let isRegistered: boolean | undefined
  if (registryContract) {
    isRegistered = await registryContract.isComposeHashRegistered(
      `0x${composeHashEvent.event_payload}`,
    )
  }

  const calculatedHash = calculate(
    'appInfo.tcb_info.app_compose',
    appComposeConfig,
    'compose_hash',
    'sha256',
    () => createHash('sha256').update(appComposeConfig).digest('hex'),
    objectId,
  )

  const hashMatches = measure(
    composeHashEvent.event_payload,
    calculatedHash,
    () => calculatedHash === composeHashEvent.event_payload,
    objectId,
    'compose_hash',
  )

  const isValid = registryContract ? (isRegistered ?? false) && hashMatches : hashMatches

  return {
    isValid,
    calculatedHash,
    isRegistered,
  }
}

/**
 * Finds the compose hash event in the event log.
 *
 * @param eventlog - The complete event log
 * @returns The compose hash event entry, or undefined if not found
 */
function findComposeHashEvent(eventlog: EventLog) {
  return eventlog.find((entry) => entry.event === 'compose-hash')
}
