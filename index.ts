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
import type {
  DataObjectEvent,
  ObjectRelationship,
  VerifierMetadata,
} from './src/types'
import {
  addDataObjectEventListener,
  clearAllDataObjects,
  configureVerifierRelationships,
  getAllDataObjects,
} from './src/utils/dataObjectCollector'

export {GatewayVerifier} from './src/gatewayVerifier'
export {KmsVerifier} from './src/kmsVerifier'
export {RedpillVerifier} from './src/redpillVerifier'
export type {
  AcmeInfo,
  AppInfo,
  AttestationBundle,
  DataObject,
  DataObjectEvent,
  EventLog,
  ObjectRelationship,
  Quote,
  QuoteData,
  QuoteResult,
  VerifierMetadata,
  VerifyQuoteResult,
} from './src/types'
// Export UI interface for easy consumption
export {
  createUIInterface,
  type DataObjectEventCallback,
  default as defaultUIInterface,
  UIDataInterface,
} from './src/ui-exports'
// Export DataObject utilities
export {
  addDataObjectEventListener,
  clearAllDataObjects,
  configureVerifierRelationships,
  getAllDataObjects,
} from './src/utils/dataObjectCollector'
// Re-export main classes and types for external use
export {OwnDomain, Verifier} from './src/verifier'

console.log('[INIT] DStack Verifier initialized successfully!')

// Clear any existing DataObjects
clearAllDataObjects()

// Set up real-time DataObject event listener
addDataObjectEventListener((event: DataObjectEvent) => {
  console.log(
    `[DataObject ${event.type.toUpperCase()}] ${event.objectId}: ${event.data.name}`,
  )
})

// Create verifiers with metadata
const metadata: VerifierMetadata = {
  osVersion: '0.5.3',
  gitRevision: 'c06e524bd460fd9c9add835b634d155d4b08d7e7',
}

const kmsVerifier = new KmsVerifier(
  '0xbfd2d557118fc650ea25a0e7d85355d335f259d8',
  metadata,
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
  metadata,
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
  {
    osVersion: '0.5.3',
    gitRevision: '92aa6f0b03337949e3e41618a4f9a65c7648bae6',
  },
)

// Configure relationships between verifiers
const relationships: ObjectRelationship[] = [
  // KMS -> Gateway relationships
  {
    sourceObjectId: 'kms-main',
    targetObjectId: 'gateway-main',
    sourceField: 'gateway_app_id',
    targetField: 'app_id',
  },
  {
    sourceObjectId: 'kms-main',
    targetObjectId: 'gateway-main',
    sourceField: 'cert_pubkey',
    targetField: 'app_cert',
  },
  // Gateway -> App relationships
  {
    sourceObjectId: 'gateway-main',
    targetObjectId: 'app-main',
    sourceField: 'registered_apps',
    targetField: 'app_id',
  },
  // KMS -> App relationships (through Gateway)
  {
    sourceObjectId: 'kms-main',
    targetObjectId: 'app-main',
    sourceField: 'cert_pubkey',
    targetField: 'app_cert',
  },
]

configureVerifierRelationships({relationships})

console.log(await redpillVerifier.verifyHardware())
console.log(await redpillVerifier.verifyOperatingSystem())
console.log(await redpillVerifier.verifySourceCode())

// Show final DataObject results
console.log('\n[DATAOBJECTS] Final verification objects generated:')
const allDataObjects = getAllDataObjects()
console.log(`Total objects: ${allDataObjects.length}`)
allDataObjects.forEach((obj, index) => {
  console.log(
    `${index + 1}. [${obj.kind?.toUpperCase()}] ${obj.name} (Layer ${obj.layer})`,
  )
})

// Export the collected DataObjects for UI consumption
export const generatedDataObjects = allDataObjects

// Write DataObjects to JSON file
const fs = await import('node:fs')
await fs.promises.writeFile(
  'verification-data-objects.json',
  JSON.stringify(generatedDataObjects, null, 2),
  'utf8',
)
console.log('\n[EXPORT] DataObjects exported to verification-data-objects.json')
