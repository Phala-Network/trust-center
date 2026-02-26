import {createHash} from 'node:crypto'

import IORedis from 'ioredis'
import {RateLimiterMemory, RateLimiterRedis} from 'rate-limiter-flexible'

import type {QuoteData, VerifyQuoteResult} from '../types'
import {verifyQuote} from '../utils/dcap-qvl'

const ITA_APPRAISAL_URL =
  'https://api.trustauthority.intel.com/appraisal/v2/attest'

// Intel Trust Authority quota: 2 req / 1s
const ITA_RATE_LIMIT_MAX_REQUESTS = 2
const ITA_RATE_LIMIT_WINDOW_SECONDS = 1
const ITA_RATE_LIMIT_KEY = 'global'

// Retry policy: first attempt + retries
const ITA_MAX_ATTEMPTS = 4
const ITA_BASE_RETRY_DELAY_MS = 250
const ITA_MAX_RETRY_DELAY_MS = 3000
const ITA_REQUEST_TIMEOUT_MS = 15_000

// Cache policy
const ITA_SUCCESS_FALLBACK_TTL_MS = 10 * 60 * 1000
const ITA_SUCCESS_MAX_TTL_MS = 60 * 60 * 1000
const ITA_FAILURE_CACHE_TTL_MS = 20 * 1000
const ITA_CACHE_MAX_ENTRIES = 500
const ITA_REDIS_CONNECT_TIMEOUT_MS = 2_000
const ITA_REDIS_RETRY_INTERVAL_MS = 30_000
const ITA_REDIS_CACHE_PREFIX = 'ita:cache:v1'
const ITA_REDIS_RL_PREFIX = 'ita:rl:v1'

type ItaResult = Record<string, unknown> | null

interface ItaCacheEntry {
  value: ItaResult
  expiresAt: number
}

const itaCache = new Map<string, ItaCacheEntry>()
const itaInFlight = new Map<string, Promise<ItaResult>>()

const localRateLimiter = new RateLimiterMemory({
  keyPrefix: `${ITA_REDIS_RL_PREFIX}:local`,
  points: ITA_RATE_LIMIT_MAX_REQUESTS,
  duration: ITA_RATE_LIMIT_WINDOW_SECONDS,
})

let redisClient: IORedis | null = null
let redisClientInitPromise: Promise<IORedis | null> | null = null
let redisRetryAfterMs = 0
let redisUnavailableLogged = false
let redisCacheWarningLogged = false
let redisRateLimitWarningLogged = false
let distributedRateLimiter: RateLimiterRedis | null = null

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function quoteCacheKey(quoteHex: string): string {
  return createHash('sha256').update(quoteHex).digest('hex')
}

function getRedisUrl(): string | undefined {
  return process.env.ITA_REDIS_URL || process.env.REDIS_URL
}

function logRedisUnavailableOnce(message: string, error?: unknown): void {
  if (redisUnavailableLogged) {
    return
  }
  redisUnavailableLogged = true
  console.warn(
    `[ITA] ${message}${error ? `: ${error instanceof Error ? error.message : String(error)}` : ''}`,
  )
}

async function getRedisClient(): Promise<IORedis | null> {
  if (redisClient) {
    return redisClient
  }

  const redisUrl = getRedisUrl()
  if (!redisUrl) {
    return null
  }

  const now = Date.now()
  if (now < redisRetryAfterMs) {
    return null
  }

  if (redisClientInitPromise) {
    return redisClientInitPromise
  }

  redisClientInitPromise = (async () => {
    let candidateClient: IORedis | null = null
    try {
      candidateClient = new IORedis(redisUrl, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: ITA_REDIS_CONNECT_TIMEOUT_MS,
        retryStrategy: () => null,
      })

      candidateClient.on('close', () => {
        redisClient = null
        distributedRateLimiter = null
      })

      await candidateClient.connect()
      redisClient = candidateClient
      redisUnavailableLogged = false
      return candidateClient
    } catch (error) {
      if (candidateClient) {
        candidateClient.disconnect()
      }
      redisRetryAfterMs = Date.now() + ITA_REDIS_RETRY_INTERVAL_MS
      logRedisUnavailableOnce(
        'Redis unavailable for ITA cache/rate limiter, falling back to in-memory controls',
        error,
      )
      return null
    } finally {
      redisClientInitPromise = null
    }
  })()

  return redisClientInitPromise
}

async function getRateLimiter(): Promise<RateLimiterMemory | RateLimiterRedis> {
  const client = await getRedisClient()
  if (!client) {
    return localRateLimiter
  }

  if (!distributedRateLimiter) {
    distributedRateLimiter = new RateLimiterRedis({
      storeClient: client,
      keyPrefix: ITA_REDIS_RL_PREFIX,
      points: ITA_RATE_LIMIT_MAX_REQUESTS,
      duration: ITA_RATE_LIMIT_WINDOW_SECONDS,
      insuranceLimiter: localRateLimiter,
    })
  }

  return distributedRateLimiter
}

function extractMsBeforeNext(error: unknown): number | null {
  if (typeof error !== 'object' || !error) {
    return null
  }

  if (!('msBeforeNext' in error)) {
    return null
  }

  const value = (error as {msBeforeNext?: unknown}).msBeforeNext
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return Math.max(1, Math.floor(value))
}

async function waitForItaRateLimitSlot(): Promise<void> {
  const limiter = await getRateLimiter()

  while (true) {
    try {
      await limiter.consume(ITA_RATE_LIMIT_KEY, 1)
      return
    } catch (error) {
      const waitMs = extractMsBeforeNext(error)
      if (waitMs !== null) {
        await sleep(waitMs)
        continue
      }

      if (!redisRateLimitWarningLogged) {
        redisRateLimitWarningLogged = true
        console.warn(
          `[ITA] Distributed limiter unavailable, falling back to local limiter: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }

      try {
        await localRateLimiter.consume(ITA_RATE_LIMIT_KEY, 1)
        return
      } catch (localError) {
        const localWaitMs = extractMsBeforeNext(localError)
        if (localWaitMs !== null) {
          await sleep(localWaitMs)
          continue
        }
        // ITA is optional; fail-open to avoid blocking verification forever.
        console.warn(
          `[ITA] Local limiter error, proceeding without limiter gate: ${
            localError instanceof Error
              ? localError.message
              : String(localError)
          }`,
        )
        return
      }
    }
  }
}

function pruneLocalItaCache(now: number): void {
  for (const [key, entry] of itaCache.entries()) {
    if (entry.expiresAt <= now) {
      itaCache.delete(key)
    }
  }

  while (itaCache.size > ITA_CACHE_MAX_ENTRIES) {
    const oldestKey = itaCache.keys().next().value
    if (!oldestKey) {
      break
    }
    itaCache.delete(oldestKey)
  }
}

function readLocalItaCache(key: string): ItaResult | undefined {
  const now = Date.now()
  pruneLocalItaCache(now)
  const cached = itaCache.get(key)
  if (!cached) {
    return undefined
  }
  if (cached.expiresAt <= now) {
    itaCache.delete(key)
    return undefined
  }
  return cached.value
}

function getResultExpUnixSeconds(result: ItaResult): number | undefined {
  if (!result || typeof result !== 'object') {
    return undefined
  }

  const exp = (result as {exp?: unknown}).exp
  if (typeof exp !== 'number' || !Number.isFinite(exp)) {
    return undefined
  }

  return exp
}

function getItaCacheTtlMs(result: ItaResult, now: number): number {
  if (!result) {
    return ITA_FAILURE_CACHE_TTL_MS
  }

  const expUnixSeconds = getResultExpUnixSeconds(result)
  if (expUnixSeconds === undefined) {
    return ITA_SUCCESS_FALLBACK_TTL_MS
  }

  const expMs = expUnixSeconds * 1000
  const remainingMs = expMs - now
  if (remainingMs <= 0) {
    return ITA_FAILURE_CACHE_TTL_MS
  }

  return Math.min(remainingMs, ITA_SUCCESS_MAX_TTL_MS)
}

function writeLocalItaCache(
  key: string,
  value: ItaResult,
  ttlMs?: number,
): number {
  const now = Date.now()
  const effectiveTtl = ttlMs ?? getItaCacheTtlMs(value, now)
  itaCache.set(key, {
    value,
    expiresAt: now + effectiveTtl,
  })
  pruneLocalItaCache(now)
  return effectiveTtl
}

function redisCacheKey(key: string): string {
  return `${ITA_REDIS_CACHE_PREFIX}:${key}`
}

async function readItaCache(key: string): Promise<ItaResult | undefined> {
  const localCached = readLocalItaCache(key)
  if (localCached !== undefined) {
    return localCached
  }

  const client = await getRedisClient()
  if (!client) {
    return undefined
  }

  const keyName = redisCacheKey(key)
  try {
    const [raw, ttlMs] = await Promise.all([client.get(keyName), client.pttl(keyName)])
    if (raw === null) {
      return undefined
    }

    const parsed = JSON.parse(raw) as ItaResult
    if (ttlMs > 0) {
      writeLocalItaCache(key, parsed, ttlMs)
    } else {
      writeLocalItaCache(key, parsed)
    }
    return parsed
  } catch (error) {
    if (!redisCacheWarningLogged) {
      redisCacheWarningLogged = true
      console.warn(
        `[ITA] Redis cache read failed, using in-memory cache only: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
    return undefined
  }
}

async function writeItaCache(key: string, value: ItaResult): Promise<void> {
  const ttlMs = writeLocalItaCache(key, value)
  const client = await getRedisClient()
  if (!client) {
    return
  }

  try {
    await client.set(redisCacheKey(key), JSON.stringify(value), 'PX', ttlMs)
  } catch (error) {
    if (!redisCacheWarningLogged) {
      redisCacheWarningLogged = true
      console.warn(
        `[ITA] Redis cache write failed, using in-memory cache only: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
}

function parseRetryAfterMs(retryAfter: string | null): number | null {
  if (!retryAfter) {
    return null
  }

  const seconds = Number.parseInt(retryAfter, 10)
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return seconds * 1000
  }

  const asDate = Date.parse(retryAfter)
  if (Number.isNaN(asDate)) {
    return null
  }

  return Math.max(0, asDate - Date.now())
}

function isRetriableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function getRetryDelayMs(attempt: number): number {
  const backoff = Math.min(
    ITA_MAX_RETRY_DELAY_MS,
    ITA_BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attempt - 1),
  )
  const jitter = Math.floor(Math.random() * 120)
  return backoff + jitter
}

function decodeJwtPayload(token: string): ItaResult {
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) {
    return null
  }

  const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const padded =
    normalized.length % 4 === 0
      ? normalized
      : normalized + '='.repeat(4 - (normalized.length % 4))

  try {
    const payload = Buffer.from(padded, 'base64').toString('utf-8')
    return JSON.parse(payload) as Record<string, unknown>
  } catch {
    return null
  }
}

async function tryFetchIta(
  quoteBase64: string,
  apiKey: string,
): Promise<{result: ItaResult; retryable: boolean; retryAfterMs?: number}> {
  await waitForItaRateLimitSlot()

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ITA_REQUEST_TIMEOUT_MS)

  const response = await fetch(ITA_APPRAISAL_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tdx: {quote: quoteBase64},
    }),
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timeoutId)
  })

  if (!response.ok) {
    const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'))
    const body = await response.text()
    const bodySummary = body ? ` body=${body.slice(0, 240)}` : ''
    console.warn(
      `[ITA] Appraisal failed: status=${response.status}${bodySummary}`,
    )
    return {
      result: null,
      retryable: isRetriableStatus(response.status),
      retryAfterMs: retryAfterMs ?? undefined,
    }
  }

  const data = (await response.json()) as {token?: string}
  if (!data.token) {
    console.warn('[ITA] Appraisal succeeded but token is missing')
    return {result: null, retryable: false}
  }

  const payload = decodeJwtPayload(data.token)
  if (!payload) {
    console.warn('[ITA] Failed to decode appraisal token payload')
  }
  return {result: payload, retryable: false}
}

async function fetchItaWithRetry(
  quoteBase64: string,
  apiKey: string,
): Promise<ItaResult> {
  for (let attempt = 1; attempt <= ITA_MAX_ATTEMPTS; attempt += 1) {
    try {
      const {result, retryable, retryAfterMs} = await tryFetchIta(
        quoteBase64,
        apiKey,
      )

      if (result) {
        return result
      }

      if (!retryable || attempt === ITA_MAX_ATTEMPTS) {
        return null
      }

      const delayMs = retryAfterMs ?? getRetryDelayMs(attempt)
      console.warn(
        `[ITA] Retrying after response failure in ${delayMs}ms (attempt ${attempt + 1}/${ITA_MAX_ATTEMPTS})`,
      )
      await sleep(delayMs)
    } catch (error) {
      if (attempt === ITA_MAX_ATTEMPTS) {
        break
      }

      const delayMs = getRetryDelayMs(attempt)
      console.warn(
        `[ITA] Request error: ${error instanceof Error ? error.message : String(error)}. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${ITA_MAX_ATTEMPTS})`,
      )
      await sleep(delayMs)
    }
  }

  return null
}

/**
 * Verifies TEE hardware attestation using DCAP-QVL.
 *
 * @param quoteData - The quote and event log data
 * @returns Promise resolving to verification result
 */
export async function verifyTeeQuote(
  quoteData: QuoteData,
): Promise<VerifyQuoteResult> {
  return verifyQuote(quoteData.quote, {hex: true})
}

/**
 * Checks if verification result indicates hardware is up-to-date.
 *
 * @param verificationResult - Result from DCAP-QVL verification
 * @returns True if hardware attestation is valid and up-to-date
 */
export function isUpToDate(verificationResult: VerifyQuoteResult): boolean {
  return verificationResult.status === 'UpToDate'
}

/**
 * Optional: Intel Trust Authority appraisal
 */
export async function verifyWithIntelTrustAuthority(
  quoteHex: string,
  apiKey?: string,
): Promise<Record<string, unknown> | null> {
  if (!apiKey) {
    console.log(
      '[ITA] Skipping Intel Trust Authority appraisal: API key not provided',
    )
    return null
  }

  const normalizedQuoteHex = quoteHex.replace(/^0x/, '').toLowerCase()
  const cacheKey = quoteCacheKey(normalizedQuoteHex)

  const cached = await readItaCache(cacheKey)
  if (cached !== undefined) {
    console.log('[ITA] Using cached Intel Trust Authority appraisal result')
    return cached
  }

  const inFlight = itaInFlight.get(cacheKey)
  if (inFlight) {
    console.log('[ITA] Reusing in-flight Intel Trust Authority appraisal')
    return inFlight
  }

  console.log('[ITA] Starting Intel Trust Authority appraisal...')

  const appraisalPromise = (async (): Promise<ItaResult> => {
    const quoteBytes = Buffer.from(normalizedQuoteHex, 'hex')
    const quoteBase64 = quoteBytes.toString('base64')

    const result = await fetchItaWithRetry(quoteBase64, apiKey)
    await writeItaCache(cacheKey, result)
    return result
  })()

  itaInFlight.set(cacheKey, appraisalPromise)

  try {
    return await appraisalPromise
  } catch (err) {
    // Silent failure for optional ITA verification
    console.warn(
      `ITA Verification failed: ${err instanceof Error ? err.message : String(err)}`,
    )
    return null
  } finally {
    itaInFlight.delete(cacheKey)
  }
}
