import bearer from '@elysiajs/bearer'
import type { Elysia } from 'elysia'

import { env } from '../../env'

// Token validation function
// In production, you would validate against a database, JWT, or external auth service
const validateToken = (token: string | undefined): boolean => {
  if (!token) {
    return false
  }

  // If BEARER_TOKEN is set in environment, validate against it
  if (env.BEARER_TOKEN) {
    return token === env.BEARER_TOKEN
  }

  // For development, accept any non-empty token when no env token is set
  // In production, implement proper token validation:
  // - Check against database of valid tokens
  // - Validate JWT signature and expiration
  // - Check against external auth service
  return token.length > 0
}

export const authMiddleware = (app: Elysia) =>
  app.use(bearer()).onBeforeHandle(({ bearer, set, status }) => {
    // Skip authentication in development mode
    if (env.NODE_ENV === 'development') {
      return
    }

    if (!validateToken(bearer)) {
      set.headers['WWW-Authenticate'] =
        `Bearer realm='sign', error="invalid_request"`

      return status(400, 'Unauthorized')
    }
  })
