import type {z} from 'zod'

/**
 * Parses JSON fields in an object based on configuration using Zod validation.
 *
 * @template T - The expected return type after parsing
 * @param rawObject - The raw object containing potential JSON strings
 * @param parseConfig - Configuration object mapping field names to Zod schemas for validation
 * @returns The object with specified fields parsed and validated from JSON strings
 */
export function parseJsonFields<T>(
  rawObject: Record<string, unknown>,
  parseConfig: Record<string, z.ZodSchema> = {},
): T {
  const result = {...rawObject}

  Object.keys(parseConfig).forEach((fieldName) => {
    if (parseConfig[fieldName] && typeof result[fieldName] === 'string') {
      try {
        const parsed = JSON.parse(result[fieldName] as string)
        result[fieldName] = parseConfig[fieldName].parse(parsed)
      } catch (parseError) {
        console.error(`Failed to parse JSON field '${fieldName}':`, parseError)
        throw new Error(
          `Invalid JSON format in field '${fieldName}': ${parseError}`,
        )
      }
    }
  })

  return result as T
}

/**
 * Selectively parses known JSON string fields within the AppInfo structure
 */
function parseAppInfoJsonFields(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj

  const result = {...(obj as Record<string, unknown>)}

  // Parse vm_config if it's a JSON string
  if (typeof result.vm_config === 'string') {
    try {
      result.vm_config = JSON.parse(result.vm_config)
    } catch {
      // Keep as string if parsing fails
    }
  }

  // Parse tcb_info if it's a JSON string
  if (typeof result.tcb_info === 'string') {
    try {
      const tcbData = JSON.parse(result.tcb_info)

      // Parse event_log within tcb_info if it's a JSON string
      if (typeof tcbData.event_log === 'string') {
        try {
          tcbData.event_log = JSON.parse(tcbData.event_log)
        } catch {
          // Keep as string if parsing fails
        }
      }

      result.tcb_info = tcbData
    } catch {
      // Keep as string if parsing fails
    }
  }

  // Parse key_provider_info if it's a JSON string
  if (typeof result.key_provider_info === 'string') {
    try {
      result.key_provider_info = JSON.parse(result.key_provider_info)
    } catch {
      // Keep as string if parsing fails
    }
  }

  return result
}

/**
 * Elegantly parses AttestationBundle with automatic nested JSON handling
 */
export function parseAttestationBundle(
  rawData: Record<string, unknown>,
  schemas: {
    nvidiaPayloadSchema: z.ZodSchema
    eventLogSchema: z.ZodSchema
    appInfoSchema: z.ZodSchema
  },
): AttestationBundle {
  // First, parse the top-level JSON fields
  const parsed = parseJsonFields<AttestationBundle>(rawData, {
    nvidia_payload: schemas.nvidiaPayloadSchema,
    event_log: schemas.eventLogSchema,
  })

  // Then selectively parse the info field's known JSON strings
  if (parsed.info) {
    const parsedInfo = parseAppInfoJsonFields(parsed.info)
    parsed.info = schemas.appInfoSchema.parse(parsedInfo) as AppInfo
  }

  return parsed
}

/**
 * Represents a single entry in the TEE event log containing measurement data.
 */
export interface LogEntry {
  /** Index Measurement Register (IMR) number */
  imr: number
  /** Type of the event being logged */
  event_type: number
  /** Cryptographic digest/hash of the event */
  digest: string
  /** Event description or identifier */
  event: string
  /** Additional payload data for the event */
  event_payload: string
}

/**
 * Represents the complete event log as an array of measurement entries.
 */
export type EventLog = LogEntry[]

/**
 * Represents a cryptographic quote as a hexadecimal string with 0x prefix.
 */
export type Quote = `0x${string}`

/**
 * Combines a TEE quote with its corresponding event log for attestation.
 */
export interface QuoteData {
  /** The cryptographic quote from the TEE */
  quote: Quote
  /** The complete event log with all measurements */
  eventlog: EventLog
}

/**
 * Represents the application composition configuration for DStack deployment.
 */
export interface AppCompose {
  /** Version of the manifest format */
  manifest_version: number
  /** Application name */
  name: string
  /** Container runtime configuration */
  runner: string
  /** Path to the Docker Compose file */
  docker_compose_file: string
  /** Whether KMS (Key Management Service) is enabled */
  kms_enabled: boolean
  /** Whether Gateway service is enabled */
  gateway_enabled: boolean
  /** Whether local key provider is enabled */
  local_key_provider_enabled: boolean
  /** Identifier for the key provider */
  key_provider_id: string
  /** Whether logs are publicly accessible */
  public_logs: boolean
  /** Whether system information is publicly accessible */
  public_sysinfo: boolean
  /** List of allowed environment variables */
  allowed_envs: string[]
  /** Whether to disable instance ID generation */
  no_instance_id: boolean
  /** Whether secure time synchronization is enabled */
  secure_time: boolean
  /** Script to run before launch */
  pre_launch_script: string
  /** Hash of the launch token */
  launch_token_hash: string
}

/**
 * Represents the TCB (Trusted Computing Base) information containing measurement registers.
 */
export interface TcbInfo {
  /** Measurement Register for Trust Domain (MRTD) */
  mrtd: string
  /** Runtime Measurement Register 0 */
  rtmr0: string
  /** Runtime Measurement Register 1 */
  rtmr1: string
  /** Runtime Measurement Register 2 */
  rtmr2: string
  /** Runtime Measurement Register 3 */
  rtmr3: string
  /** Aggregated measurement register value */
  mr_aggregated: string
  /** Hash of the operating system image */
  os_image_hash: string
  /** Hash of the Docker Compose configuration */
  compose_hash: string
  /** Unique identifier for the device */
  device_id: string
  /** Complete event log for this TCB */
  event_log: EventLog
  /** Application composition configuration as JSON string */
  app_compose: string
}

/**
 * Represents the key provider information for cryptographic operations.
 */
export interface KeyProvider {
  /** Human-readable name of the key provider */
  name: string
  /** Unique identifier for the key provider */
  id: string
}

/**
 * Represents the virtual machine configuration for TEE deployment.
 */
export interface VmConfig {
  /** Specification version for the VM configuration */
  spec_version: number
  /** Hash of the operating system image */
  os_image_hash: string
  /** Number of CPU cores allocated */
  cpu_count: number
  /** Memory size in bytes */
  memory_size: number
  /** Whether QEMU uses single-pass page addition */
  qemu_single_pass_add_pages: boolean
  /** Whether Programmable Interrupt Controller is enabled */
  pic: boolean
  /** Size of the 64-bit PCI memory hole */
  pci_hole64_size: number
  /** Whether huge pages are enabled */
  hugepages: boolean
  /** Number of GPUs allocated */
  num_gpus: number
  /** Number of NVSwitches allocated */
  num_nvswitches: number
  /** Whether hotplug functionality is disabled */
  hotplug_off: boolean
}

/**
 * Represents comprehensive application information for TEE attestation.
 */
export interface AppInfo {
  /** Unique application identifier */
  app_id: string
  /** Unique instance identifier for this deployment */
  instance_id: string
  /** Application certificate for authentication */
  app_cert: string
  /** Trusted Computing Base information */
  tcb_info: TcbInfo
  /** Human-readable application name */
  app_name: string
  /** Device identifier where the app is running */
  device_id: string
  /** Aggregated measurement register value */
  mr_aggregated: string
  /** Hash of the operating system image */
  os_image_hash: string
  /** Key provider configuration */
  key_provider_info: KeyProvider
  /** Hash of the Docker Compose configuration */
  compose_hash: string
  /** Virtual machine configuration */
  vm_config: VmConfig
}

/**
 * Represents NVIDIA GPU attestation evidence.
 */
export interface NvidiaEvidence {
  /** X.509 certificate for the GPU */
  certificate: string
  /** Cryptographic evidence from the GPU */
  evidence: string
  /** GPU architecture identifier */
  arch: string
}

/**
 * Represents NVIDIA attestation payload containing multiple GPU evidence.
 */
export interface NvidiaPayload {
  /** Random nonce for replay protection */
  nonce: string
  /** List of evidence from multiple GPUs */
  evidence_list: NvidiaEvidence[]
  /** Target architecture for the attestation */
  arch: string
}

/**
 * Represents a complete attestation containing both Intel and NVIDIA evidence.
 */
export interface Attestation {
  /** Ethereum address that signed this attestation */
  signing_address: string
  /** Intel TDX/SGX quote as hex string */
  intel_quote: string
  /** NVIDIA GPU attestation payload */
  nvidia_payload: NvidiaPayload
  /** Event log entries for this attestation */
  event_log: LogEntry[]
  /** Application information */
  info: AppInfo
}

/**
 * Represents a bundle of attestations with historical data.
 */
export interface AttestationBundle extends Attestation {
  /** Complete history of all attestations */
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

export interface QuoteHeader {
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

export interface CertData {
  cert_type: number
  body: string
}

export interface AuthData {
  V4: {
    ecdsa_signature: string
    ecdsa_attestation_key: string
    certification_data: CertData
    qe_report_data: QEReportCert
  }
}

export interface QEReportCert {
  qe_report: string
  qe_report_signature: string
  qe_auth_data: string
  certification_data: CertData
}

export interface QuoteResult {
  header: QuoteHeader
  report: Report
  auth_data: AuthData
}

/**
 * Types for calculation and measurement operations with event emission
 */
export interface CalcEvent {
  inputRef: string
  outputRef: string
  calcFunc: string
}

export interface MeasureEvent {
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
