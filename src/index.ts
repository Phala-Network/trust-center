/**
 * DStack Verifier - TEE Attestation Verification System
 *
 * This is the main entry point for the DStack Verifier project, which provides
 * comprehensive verification of TEE (Trusted Execution Environment) applications
 * including hardware attestation, operating system integrity, and source code authenticity.
 *
 * Key Components:
 * - Verifier Chain: Automated verifier creation and execution with typed configurations
 * - Multiple Verifiers: KMS, Gateway, Redpill, and Phala Cloud verifiers
 * - Structured Metadata: Type-safe metadata system with utility functions
 * - Simple REST API: Lightweight HTTP server using Bun's built-in server
 * - Data Objects: Structured verification data generation with event system
 * - DCAP-QVL: Intel TDX/SGX quote verification library
 * - Smart Contract Integration: Retrieves attestation data from Base blockchain
 *
 * Usage:
 * - Simple server: `bun run start` or `bun run src/index.ts`
 * - Advanced server: `bun run server` (with database and queue support)
 *
 * @example
 * ```typescript
 * import { createVerifiers, executeVerifiers } from './verifierChain'
 *
 * const verifiers = createVerifiers(appConfig, systemInfo)
 * const result = await executeVerifiers(verifiers, flags)
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
