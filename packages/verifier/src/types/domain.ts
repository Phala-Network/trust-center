/**
 * Types related to domain verification and Certificate Transparency.
 */

/**
 * Domain-specific quote structure containing historical keys and account information.
 */
export interface AcmeInfo {
  account_uri: string
  /** Derived from quoted_hist_keys if not provided by legacy API */
  hist_keys: string[]
  quoted_hist_keys: Array<{
    public_key: string
    quote: string
    attestation?: string
  }>
  account_quote: string
  account_attestation?: string
  /** Legacy field - only present in older gateway versions */
  active_cert?: string
  /** Legacy field - only present in older gateway versions */
  base_domain?: string
}

/**
 * Certificate Transparency Log structures.
 */
export interface CTLogEntry {
  issuer_ca_id: number
  issuer_name: string
  common_name: string
  name_value: string
  id: number
  entry_timestamp: string
  not_before: string
  not_after: string
  serial_number: string
  result_count: number
}

export interface CTResult {
  domain: string
  tee_controlled: boolean
  certificates: CTLogEntry[]
  public_keys_found: string[]
  verification_details: {
    certificates_checked: number
    tee_certificates: number
    non_tee_certificates: number
    earliest_certificate: string | null
    latest_certificate: string | null
  }
}
