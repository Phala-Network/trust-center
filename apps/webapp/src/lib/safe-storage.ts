'use client'

import Cookies from 'js-cookie'

/**
 * Storage guards for sandboxed (opaque-origin) iframes.
 *
 * When Trust Center runs inside an iframe sandboxed without
 * `allow-same-origin`, the frame gets an opaque origin and every access to
 * `localStorage`, `sessionStorage`, or `document.cookie` throws a
 * SecurityError. Throwing from a React effect tears the whole tree down into
 * Next.js' "Application error" screen, so all persistence must be defensive.
 *
 * Every helper here fails silently when storage is unavailable.
 */

function getStorage(kind: 'local' | 'session'): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    const storage =
      kind === 'local' ? window.localStorage : window.sessionStorage
    // Probe: property access alone doesn't throw until first use in some
    // browsers, so exercise a real operation.
    const probe = '__tc_storage_probe__'
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return storage
  } catch {
    return null
  }
}

export function getLocalStorage(): Storage | null {
  return getStorage('local')
}

export function getSessionStorage(): Storage | null {
  return getStorage('session')
}

/**
 * Guarded wrapper around `Cookies.set` (js-cookie). The `document.cookie`
 * setter throws SecurityError in opaque-origin documents; layout persistence
 * is best-effort and must never crash the page.
 */
export function safeSetCookie(
  name: string,
  value: string,
  options?: Cookies.CookieAttributes,
): void {
  try {
    Cookies.set(name, value, options)
  } catch {
    // Storage unavailable (sandboxed iframe, blocked cookies) — ignore.
  }
}
