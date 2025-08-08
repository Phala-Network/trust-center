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
 *
 * @example
 * ```typescript
 * import { KmsVerifier } from './src/kmsVerifier'
 *
 * const kmsVerifier = new KmsVerifier('0x...')
 * const isValid = await kmsVerifier.verifyHardware()
 * ```
 */

import {GatewayVerifier} from './src/gatewayVerifier'
import {KmsVerifier} from './src/kmsVerifier'
import {RedpillVerifier} from './src/redpillVerifier'

export {GatewayVerifier} from './src/gatewayVerifier'
export {KmsVerifier} from './src/kmsVerifier'
export type {
  AcmeInfo,
  AppInfo,
  AttestationBundle,
  CTVerificationResult,
  DataObject,
  DecodedQuoteResult,
  EventLog,
  EventLogEntry,
  Quote,
  QuoteAndEventLog,
  VerifyQuoteResult,
} from './src/types'
// Re-export main classes and types for external use
export {OwnDomain, Verifier} from './src/verifier'

console.log('[INIT] DStack Verifier initialized successfully!')

const kmsVerifier = new KmsVerifier(
  '0xbfd2d557118fc650ea25a0e7d85355d335f259d8',
)

console.log(
  '[KMS] Hardware verification result:',
  await kmsVerifier.verifyHardware(),
)
console.log(
  '[KMS] Operating system verification result:',
  await kmsVerifier.verifyOperatingSystem(),
)
console.log(
  '[KMS] Source code verification result:',
  await kmsVerifier.verifySourceCode(),
)

const gatewayVerifier = new GatewayVerifier(
  (await kmsVerifier.getGatewatyAppId()) as `0x${string}`,
  'https://gateway.llm-04.phala.network:9204/',
)

console.log(
  '[GATEWAY] Hardware verification result:',
  await gatewayVerifier.verifyHardware(),
)
console.log(
  '[GATEWAY] Operating system verification result:',
  await gatewayVerifier.verifyOperatingSystem(),
)
console.log(
  '[GATEWAY] Source code verification result:',
  await gatewayVerifier.verifySourceCode(),
)

console.log(
  '[GATEWAY] TEE controlled key verification result:',
  await gatewayVerifier.verifyTeeControlledKey(),
)
console.log(
  '[GATEWAY] Certificate key verification result:',
  await gatewayVerifier.verifyCertificateKey(),
)
console.log(
  '[GATEWAY] DNS CAA verification result:',
  await gatewayVerifier.verifyDnsCAA(),
)
console.log(
  '[GATEWAY] Certificate Transparency log verification result:',
  await gatewayVerifier.verifyCTLog(),
)

const redpillVerifier = new RedpillVerifier(
  '0x78601222ada762fa7cdcbc167aa66dd7a5f57ece',
  'phala/deepseek-chat-v3-0324',
)

console.log(await redpillVerifier.verifyHardware())
console.log(await redpillVerifier.verifyOperatingSystem())
console.log(await redpillVerifier.verifySourceCode())
