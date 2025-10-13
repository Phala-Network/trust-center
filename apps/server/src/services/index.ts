import {VerificationService} from '@phala/dstack-verifier'

import {env} from '../env'
import {
  createDbMonitorService,
  type DbMonitorConfig,
  type DbMonitorService,
} from './dbMonitor'
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

// Types
export interface Services {
  queue: QueueService
  s3: S3Service
  verificationTask: VerificationTaskService
  dbMonitor: DbMonitorService
  sync: SyncService | null
}

export interface ServiceConfig {
  databaseUrl: string
  s3: S3Config
  queue: QueueConfig
  dbMonitor: DbMonitorConfig
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

const buildDbMonitorConfig = (): DbMonitorConfig => ({
  pollIntervalMs: Number(env.DB_MONITOR_POLL_INTERVAL) || 5000, // Poll every 5 seconds by default
})

const buildSyncConfig = (): SyncServiceConfig | null => {
  if (!env.METABASE_URL || !env.METABASE_API_KEY) {
    return null
  }
  return {
    metabaseUrl: env.METABASE_URL,
    metabaseApiKey: env.METABASE_API_KEY,
  }
}

const buildServiceConfig = (): ServiceConfig => ({
  databaseUrl: env.DATABASE_URL,
  s3: buildS3Config(),
  queue: buildQueueConfig(),
  dbMonitor: buildDbMonitorConfig(),
  sync: buildSyncConfig(),
})

// Functional service composition
const composeServices = (config: ServiceConfig): Services => {
  const s3 = createS3Service(config.s3)
  const verificationTask = createVerificationTaskService(config.databaseUrl)
  // Note: VerificationService is now created per-task in queue worker
  // to avoid state pollution between concurrent verifications
  const queue = createQueueService(config.queue, verificationTask, s3)
  const db = verificationTask.getDb()
  const dbMonitor = createDbMonitorService(db, queue, config.dbMonitor)
  const sync = config.sync
    ? createSyncService(config.sync, verificationTask)
    : null

  return {queue, s3, verificationTask, dbMonitor, sync}
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
}
export type {
  QueueConfig,
  S3Config,
  SyncService,
  SyncServiceConfig,
  QueueService,
  S3Service,
  VerificationTaskService,
}
