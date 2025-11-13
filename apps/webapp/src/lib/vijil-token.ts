/**
 * Vijil Token Manager
 * Handles automatic token refresh for Vijil API
 *
 * Tokens are fetched from Vijil's /v1/auth/token endpoint using client credentials
 * and cached until they expire (with a 5-minute buffer for safety).
 */

import { env } from '@/env'

interface TokenCache {
  accessToken: string
  expiresAt: number // Unix timestamp in milliseconds
}

interface GetJWTResponse {
  access_token: string
  expires_in: number // Seconds until expiration
}

// In-memory token cache (survives across requests in the same process)
let tokenCache: TokenCache | null = null

// Lock to prevent multiple simultaneous token refresh requests
let refreshPromise: Promise<string> | null = null

/**
 * Get a valid Vijil API token
 * Automatically refreshes if expired or about to expire
 */
export async function getVijilToken(): Promise<string | null> {
  const {
    VIJIL_API_URL,
    VIJIL_CLIENT_ID,
    VIJIL_CLIENT_SECRET,
    VIJIL_CLIENT_TOKEN,
    VIJIL_API_TOKEN,
  } = env

  // Check if we have client credentials for auto-refresh
  const hasCredentials =
    VIJIL_CLIENT_ID && VIJIL_CLIENT_SECRET && VIJIL_CLIENT_TOKEN

  // If no credentials, fall back to the static token (deprecated)
  if (!hasCredentials) {
    if (VIJIL_API_TOKEN) {
      console.warn(
        '[VIJIL] Using deprecated static API token. Consider using client credentials for auto-refresh.',
      )
      return VIJIL_API_TOKEN
    }
    console.warn('[VIJIL] No Vijil credentials configured')
    return null
  }

  // Check if we have a valid cached token
  if (tokenCache) {
    const now = Date.now()
    const timeUntilExpiry = tokenCache.expiresAt - now
    const fiveMinutes = 5 * 60 * 1000

    // If token is still valid with at least 5 minutes remaining, use it
    if (timeUntilExpiry > fiveMinutes) {
      return tokenCache.accessToken
    }
  }

  // If a refresh is already in progress, wait for it
  if (refreshPromise) {
    try {
      return await refreshPromise
    } catch (error) {
      // If refresh failed, fall back to static token if available
      console.error(
        '[VIJIL] Token refresh failed, falling back to static token:',
        error,
      )
      if (VIJIL_API_TOKEN) {
        return VIJIL_API_TOKEN
      }
      return null
    }
  }

  // Start a new token refresh
  refreshPromise = refreshToken()

  try {
    const token = await refreshPromise
    return token
  } catch (error) {
    // If refresh failed, fall back to static token if available
    console.error(
      '[VIJIL] Token refresh failed, falling back to static token:',
      error,
    )
    if (VIJIL_API_TOKEN) {
      return VIJIL_API_TOKEN
    }
    return null
  } finally {
    // Clear the lock after completion
    refreshPromise = null
  }
}

/**
 * Refresh the Vijil API token
 * Internal function - use getVijilToken() instead
 */
async function refreshToken(): Promise<string> {
  const {
    VIJIL_API_URL,
    VIJIL_CLIENT_ID,
    VIJIL_CLIENT_SECRET,
    VIJIL_CLIENT_TOKEN,
  } = env

  console.log('[VIJIL] Refreshing API token...')

  const response = await fetch(`${VIJIL_API_URL}/v1/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: VIJIL_CLIENT_ID,
      client_secret: VIJIL_CLIENT_SECRET,
      client_token: VIJIL_CLIENT_TOKEN,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(
      '[VIJIL] Token refresh failed:',
      response.status,
      response.statusText,
      errorText,
    )
    // Clear the cache on error
    tokenCache = null
    throw new Error(
      `Token refresh failed: ${response.status} ${response.statusText}`,
    )
  }

  const data: GetJWTResponse = await response.json()

  // Cache the new token
  const expiresAt = Date.now() + data.expires_in * 1000
  tokenCache = {
    accessToken: data.access_token,
    expiresAt,
  }

  const expiresInMinutes = Math.floor(data.expires_in / 60)
  console.log(
    `[VIJIL] Token refreshed successfully. Expires in ${expiresInMinutes} minutes`,
  )

  console.log('[VIJIL] New token acquired:', data.access_token)

  return data.access_token
}

/**
 * Clear the token cache (useful for testing or forcing a refresh)
 */
export function clearVijilTokenCache(): void {
  tokenCache = null
  console.log('[VIJIL] Token cache cleared')
}
