import type {EventLog} from './core'

/**
 * Types related to application configuration and deployment.
 */

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
