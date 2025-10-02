import type { AppMetadata } from '@phala/dstack-verifier'
import type { AppConfigType } from '@phala/trust-center-db/schema'

export interface VerificationFlags {
  hardware?: boolean
  os?: boolean
  sourceCode?: boolean
  domainOwnership?: boolean
}

export interface TaskCreateRequest {
  appId: string
  appName: string
  appConfigType: AppConfigType
  contractAddress: string
  modelOrDomain: string
  metadata?: AppMetadata
  flags?: VerificationFlags
}
