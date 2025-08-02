export function parseJsonFields<T>(
  raw: any,
  config: Record<string, boolean> = {},
): T {
  const result = {...raw}

  Object.keys(config).forEach((key) => {
    if (config[key] && typeof result[key] === 'string') {
      try {
        result[key] = JSON.parse(result[key])
      } catch (error) {
        console.error(`Failed to parse field ${key}:`, error)
      }
    }
  })

  return result as T
}

/**
 * Represents a single entry in the event log.
 */
export interface EventLogEntry {
  imr: number
  event_type: number
  digest: string
  event: string
  event_payload: string
}

/**
 * Represents the entire event log, which is an array of entries.
 */
export type EventLog = EventLogEntry[]

/**
 * Represents a quote as a hexadecimal string.
 */
export type Quote = `0x${string}`

/**
 * Combines the quote and event log into a single structure.
 */
export interface QuoteAndEventLog {
  quote: Quote
  eventlog: EventLog
}

/**
 * Represents the application composition configuration.
 */
export interface AppCompose {
  manifest_version: number
  name: string
  runner: string
  docker_compose_file: string
  kms_enabled: boolean
  gateway_enabled: boolean
  local_key_provider_enabled: boolean
  key_provider_id: string
  public_logs: boolean
  public_sysinfo: boolean
  allowed_envs: string[]
  no_instance_id: boolean
  secure_time: boolean
  pre_launch_script: string
  launch_token_hash: string
}

/**
 * Represents the TCB (Trusted Computing Base) information.
 */
export interface TcbInfo {
  mrtd: string
  rtmr0: string
  rtmr1: string
  rtmr2: string
  rtmr3: string
  mr_aggregated: string
  os_image_hash: string
  compose_hash: string
  device_id: string
  event_log: EventLog
  app_compose: string
}

/**
 * Represents the key provider information.
 */
export interface KeyProviderInfo {
  name: string
  id: string
}

/**
 * Represents the virtual machine configuration.
 */
export interface VmConfig {
  spec_version: number
  os_image_hash: string
  cpu_count: number
  memory_size: number
  qemu_single_pass_add_pages: boolean
  pic: boolean
  pci_hole64_size: number
  hugepages: boolean
  num_gpus: number
  num_nvswitches: number
  hotplug_off: boolean
}

/**
 * Represents the application information.
 */
export interface AppInfo {
  app_id: string
  instance_id: string
  app_cert: string
  tcb_info: TcbInfo
  app_name: string
  device_id: string
  mr_aggregated: string
  os_image_hash: string
  key_provider_info: KeyProviderInfo
  compose_hash: string
  vm_config: VmConfig
}

export interface NvidiaEvidence {
  certificate: string
  evidence: string
  arch: string
}

export interface NvidiaPayload {
  nonce: string
  evidence_list: NvidiaEvidence[]
  arch: string
}

export interface Attestation {
  signing_address: string
  intel_quote: string
  nvidia_payload: NvidiaPayload
  event_log: EventLogEntry[]
  info: AppInfo
}

export interface AttestationBundle extends Attestation {
  all_attestations: Attestation[]
}

// defined in https://github.com/Phala-Network/dcap-qvl/blob/a1b725dbeacc78125c7024e63e4d9a9293570a46/src/quote.rs
export interface TDReport10 {
  tee_tcb_svn: string
  mr_seam: string
  mr_signer_seam: string
  seam_attributes: string
  td_attributes: string
  xfam: string
  mr_td: string
  mr_config_id: string
  mr_owner: string
  mr_owner_config: string
  rt_mr0: string
  rt_mr1: string
  rt_mr2: string
  rt_mr3: string
  report_data: string
}

export interface VerifyQuoteResult {
  status: 'UpToDate' | string
  advisory_ids: string[]
  report: {
    TD10: TDReport10
  }
}

export interface DecodedQuoteHeader {
  version: number
  attestation_key_type: number
  tee_type: number
  qe_svn: number
  pce_svn: number
  qe_vendor_id: string
  user_data: string
}

export interface Report {
  TD10: TDReport10
}

export interface CertificationData {
  cert_type: number
  body: string
}

export interface AuthData {
  V4: {
    ecdsa_signature: string
    ecdsa_attestation_key: string
    certification_data: CertificationData
    qe_report_data: QEReportCertificationData
  }
}

export interface QEReportCertificationData {
  qe_report: string
  qe_report_signature: string
  qe_auth_data: string
  certification_data: CertificationData
}

export interface DecodedQuoteResult {
  header: DecodedQuoteHeader
  report: Report
  auth_data: AuthData
}

/**
 * Types for calculation and measurement operations with event emission
 */
export interface CalculationEvent {
  inputRef: string
  outputRef: string
  calcFunc: string
}

export interface MeasurementEvent {
  passed: boolean
  expected: unknown
  actual: unknown
}

/**
 * Domain-specific quote structure containing historical keys and account information
 */
export interface AcmeInfo {
  account_uri: string
  hist_keys: string[]
  quoted_hist_keys: Array<{
    public_key: string
    quote: string
  }>
  account_quote: string
  active_cert: string
  base_domain: string
}

/**
 * Certificate Transparency Log structures
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

export interface CTVerificationResult {
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

/**
 * DataObject interface for report generation
 */
export interface DataObject {
  id: string
  name: string
  description?: string
  fields: Record<string, unknown>
  layer: number
  type: string
  kind?: 'gateway' | 'kms' | 'app'
  measuredBy?: {
    objectId: string
    fieldName?: string
    selfFieldName?: string
    calcOutputName?: string
    selfCalcOutputName?: string
  }[]
  calculations?: Array<{
    inputs: string[]
    calcFunc: string
    outputs: string[]
  }>
}
