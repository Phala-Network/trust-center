/**
 * Represents a single entry in the event log.
 */
export interface EventLogEntry {
  imr: number;
  event_type: number;
  digest: string;
  event: string;
  event_payload: string;
}

/**
 * Represents the entire event log, which is an array of entries.
 */
export type EventLog = EventLogEntry[];

/**
 * Represents a quote as a hexadecimal string.
 */
export type Quote = `0x${string}`;

/**
 * Combines the quote and event log into a single structure.
 */
export interface QuoteAndEventLog {
  quote: Quote;
  eventlog: EventLog;
}

/**
 * Represents the application composition configuration.
 */
export interface AppCompose {
  manifest_version: number;
  name: string;
  runner: string;
  docker_compose_file: string;
  kms_enabled: boolean;
  gateway_enabled: boolean;
  local_key_provider_enabled: boolean;
  key_provider_id: string;
  public_logs: boolean;
  public_sysinfo: boolean;
  allowed_envs: string[];
  no_instance_id: boolean;
  secure_time: boolean;
  pre_launch_script: string;
  launch_token_hash: string;
}

/**
 * Represents the TCB (Trusted Computing Base) information.
 */
export interface TcbInfo {
  mrtd: string;
  rtmr0: string;
  rtmr1: string;
  rtmr2: string;
  rtmr3: string;
  mr_aggregated: string;
  os_image_hash: string;
  compose_hash: string;
  device_id: string;
  event_log: EventLog;
  app_compose: AppCompose;
}

/**
 * Represents the key provider information.
 */
export interface KeyProviderInfo {
  name: string;
  id: string;
}

/**
 * Represents the virtual machine configuration.
 */
export interface VmConfig {
  spec_version: number;
  os_image_hash: string;
  cpu_count: number;
  memory_size: number;
  qemu_single_pass_add_pages: boolean;
  pic: boolean;
  pci_hole64_size: number;
  hugepages: boolean;
  num_gpus: number;
  num_nvswitches: number;
  hotplug_off: boolean;
}

/**
 * Represents the application information.
 */
export interface AppInfo {
  app_id: string;
  instance_id: string;
  app_cert: string;
  tcb_info: TcbInfo;
  app_name: string;
  device_id: string;
  mr_aggregated: string;
  os_image_hash: string;
  key_provider_info: KeyProviderInfo;
  compose_hash: string;
  vm_config: VmConfig;
}

export interface NvidiaEvidence {
  certificate: string;
  evidence: string;
  arch: string;
}

export interface NvidiaPayload {
  nonce: string;
  evidence_list: NvidiaEvidence[];
  arch: string;
}

export interface Attestation {
  signing_address: string;
  intel_quote: string;
  nvidia_payload: NvidiaPayload;
  event_log: EventLogEntry[];
  info: AppInfo;
}

export interface AttestationBundle extends Attestation {
  all_attestations: Attestation[];
}
