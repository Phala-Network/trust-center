import type {AppInfo} from './application'
import type {LogEntry} from './core'

/**
 * Types related to hardware attestation and GPU evidence.
 */

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
