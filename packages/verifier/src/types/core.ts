/**
 * Core types for TEE attestation and quotes.
 */

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
