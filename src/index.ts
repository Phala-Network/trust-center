/**
 * DStack Verifier - TEE Attestation Verification System
 *
 * This is the main entry point for the DStack Verifier project, which provides
 * comprehensive verification of TEE (Trusted Execution Environment) applications
 * including hardware attestation, operating system integrity, and source code authenticity.
 *
 * Key Components:
 * - KmsVerifier: Verifies Key Management Service attestations using smart contract data
 * - GatewayVerifier: Verifies Gateway service attestations with domain ownership verification
 * - DCAP-QVL: Intel TDX/SGX quote verification library
 * - Smart Contract Integration: Retrieves attestation data from blockchain
 * - Backend API Server: HTTP REST API for verification operations
 *
 * Usage:
 * - Server mode: `bun run index.ts` (starts API server)
 *
 * @example
 * ```typescript
 * import { KmsVerifier } from './src/kmsVerifier'
 *
 * const kmsVerifier = new KmsVerifier('0x...')
 * const isValid = await kmsVerifier.verifyHardware()
 * ```
 */

import { startServer } from './test-server'

export type {
  AcmeInfo,
  AppInfo,
  AppMetadata,
  AppSourceInfo,
  AttestationBundle,
  DataObject,
  DataObjectEvent,
  EventLog,
  GatewayMetadata,
  GovernanceInfo,
  HardwareInfo,
  KmsMetadata,
  ObjectRelationship,
  OSSourceInfo,
  Quote,
  QuoteData,
  QuoteResult,
  VerifyQuoteResult,
} from './types'
// Export DataObject utilities
export {
  addDataObjectEventListener,
  clearAllDataObjects,
  configureVerifierRelationships,
  getAllDataObjects,
} from './utils/dataObjectCollector'
// Verification Service
export { VerificationService } from './verificationService'
// Re-export main classes and types for external use
export { OwnDomain, Verifier } from './verifier'
// Verifier Chain System
export { createVerifiers, executeVerifiers } from './verifierChain'
// Gateway Verifier
export { GatewayVerifier } from './verifiers/gatewayVerifier'
// KMS Verifiers
export { KmsVerifier } from './verifiers/kmsVerifier'
export { PhalaCloudKmsVerifier } from './verifiers/phalaCloudKmsVerifier'
// Application Verifiers
export { PhalaCloudVerifier } from './verifiers/phalaCloudVerifier'
export { RedpillKmsVerifier } from './verifiers/redpillKmsVerifier'
export { RedpillVerifier } from './verifiers/redpillVerifier'

// Start the HTTP API server
await startServer()
console.log('[INIT] DStack Verifier API server is ready!')
