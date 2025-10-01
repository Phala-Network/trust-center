// Core verifier exports
export { VerificationService } from './verificationService'

// Config types
export type {
  RedpillConfig,
  PhalaCloudConfig,
  VerificationFlags,
} from './config'

// API types
export type { VerificationResponse, VerificationError } from './types/api'

// Metadata types
export type {
  AppMetadata,
  CompleteAppMetadata,
  OSSourceInfo,
  AppSourceInfo,
  HardwareInfo,
  GovernanceInfo,
} from './types/metadata'

// Schemas
export { AppMetadataSchema } from './types/metadata'
