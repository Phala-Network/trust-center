import {VerificationService} from '@phala/dstack-verifier'

import {env} from '../env'
import {type AppService, createAppService} from './appService'
import {createProfileService, type ProfileService} from './profileService'
import {createQueueService, type QueueConfig, type QueueService} from './queue'
import {createS3Service, type S3Config, type S3Service} from './s3'
import {
  createSyncService,
  type SyncService,
  type SyncServiceConfig,
} from './syncService'
import {
  createVerificationTaskService,
  type VerificationTaskService,
} from './taskService'
import {createVijilService, type VijilService} from './vijil'

// Types
export interface Services {
  queue: QueueService
  s3: S3Service
  verificationTask: VerificationTaskService
  profile: ProfileService
  app: AppService
  sync: SyncService | null
  vijil: VijilService
}

export interface ServiceConfig {
  databaseUrl: string
  s3: S3Config
  queue: QueueConfig
  sync: SyncServiceConfig | null
}

// Pure configuration builders
const buildS3Config = (): S3Config => ({
  endpoint: env.S3_ENDPOINT,
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  bucketName: env.S3_BUCKET,
})

const buildQueueConfig = (): QueueConfig => ({
  redisUrl: env.REDIS_URL,
  queueName: env.QUEUE_NAME || 'verification-queue',
  concurrency: Number(env.QUEUE_CONCURRENCY) || 5,
  maxAttempts: Number(env.QUEUE_MAX_ATTEMPTS) || 3,
  backoffDelay: Number(env.QUEUE_BACKOFF_DELAY) || 2000,
})

const buildSyncConfig = (): SyncServiceConfig | null => {
  if (
    !env.METABASE_APP_QUERY ||
    !env.METABASE_PROFILE_QUERY ||
    !env.METABASE_API_KEY
  ) {
    return null
  }
  return {
    metabaseAppQuery: env.METABASE_APP_QUERY,
    metabaseProfileQuery: env.METABASE_PROFILE_QUERY,
    metabaseApiKey: env.METABASE_API_KEY,
  }
}

const buildServiceConfig = (): ServiceConfig => ({
  databaseUrl: env.DATABASE_URL,
  s3: buildS3Config(),
  queue: buildQueueConfig(),
  sync: buildSyncConfig(),
})

// Functional service composition
const composeServices = (config: ServiceConfig): Services => {
  const s3 = createS3Service(config.s3)
  const verificationTask = createVerificationTaskService(config.databaseUrl)
  const profile = createProfileService(config.databaseUrl)
  const app = createAppService(config.databaseUrl)
  const vijil = createVijilService({
    apiUrl: env.VIJIL_API_URL,
    apiToken: env.VIJIL_API_TOKEN,
    whitelistString: env.VIJIL_AGENT_WHITELIST,
    agentModelName: env.VIJIL_AGENT_MODEL_NAME,
  })
  // Note: VerificationService is now created per-task in queue worker
  // to avoid state pollution between concurrent verifications
  const queue = createQueueService(config.queue, verificationTask, s3, app, vijil)
  const sync = config.sync
    ? createSyncService(config.sync, queue, profile, app)
    : null

  return {queue, s3, verificationTask, profile, app, sync, vijil}
}

// Service lifecycle management with functional approach
let servicesInstance: Services | null = null

export const createServices = (): Services => {
  if (servicesInstance) {
    return servicesInstance
  }

  console.log('[SERVICES] Initializing services...')

  const config = buildServiceConfig()
  servicesInstance = composeServices(config)

  console.log('[SERVICES] All services initialized successfully')
  return servicesInstance
}

export const getServices = (): Services => {
  if (!servicesInstance) {
    throw new Error('Services not initialized. Call createServices() first.')
  }
  return servicesInstance
}

// Functional service cleanup
const closeService = async (service: {close?: () => Promise<void>}) => {
  if (service.close) {
    await service.close()
  }
}

export const closeServices = async (): Promise<void> => {
  if (!servicesInstance) return

  console.log('[SERVICES] Closing services...')

  const closeOperations = [closeService(servicesInstance.queue)]

  await Promise.all(closeOperations)
  servicesInstance = null

  console.log('[SERVICES] All services closed')
}

// Export types and factory functions
export {
  createQueueService,
  createS3Service,
  createSyncService,
  createVerificationTaskService,
  createProfileService,
  createAppService,
  createVijilService,
}
export type {
  QueueConfig,
  S3Config,
  SyncService,
  SyncServiceConfig,
  QueueService,
  S3Service,
  VerificationTaskService,
  ProfileService,
  AppService,
  VijilService,
}
