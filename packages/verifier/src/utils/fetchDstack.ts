/**
 * Fetch wrapper that skips TLS certificate verification for dstack endpoints.
 *
 * dstack endpoints (app RPC, gateway ACME/app-info) use TEE-managed
 * certificates that may be self-signed (dstack internal CA) or have
 * incomplete chains. The verifier needs to connect to retrieve data,
 * then validates certificates itself (verifyCertificateKey / verifyTeeControlledKey).
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
