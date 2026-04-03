/**
 * Fetch wrapper that skips TLS certificate verification.
 *
 * dstack endpoints (app RPC, gateway ACME/app-info) use TEE-managed
 * certificates that may be self-signed (dstack internal CA) or have
 * incomplete chains. The verifier needs to connect to these endpoints
 * to retrieve data, then validates the certificates itself via
 * verifyCertificateKey/verifyTeeControlledKey.
 *
 * Uses Bun's native tls option. Falls back to NODE_TLS_REJECT_UNAUTHORIZED
 * for Node.js compatibility.
 */
export function fetchDstack(
  url: string | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(url, {
    ...init,
    tls: {rejectUnauthorized: false},
  })
}
