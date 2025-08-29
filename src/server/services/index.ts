import { env } from '../../env'
import { VerificationService } from '../../verificationService'
import {
  createQueueService,
  type QueueConfig,
  type QueueService,
} from './queue'
import { createR2Service, type R2Config, type R2Service } from './r2'
import {
  createVerificationTaskService,
  type VerificationTaskService,
} from './taskService'

// Types
export interface Services {
  verification: VerificationService
  queue: QueueService
  r2: R2Service
  verificationTask: VerificationTaskService
}

export interface ServiceConfig {
  databaseUrl: string
  r2: R2Config
  queue: QueueConfig
}

// Pure configuration builders
const buildR2Config = (): R2Config => ({
  endpoint: env.R2_ENDPOINT,
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  bucketName: env.R2_BUCKET,
})

const buildQueueConfig = (): QueueConfig => ({
  redisUrl: env.REDIS_URL,
  queueName: env.QUEUE_NAME || 'verification-queue',
  concurrency: Number(env.QUEUE_CONCURRENCY) || 5,
  maxAttempts: Number(env.QUEUE_MAX_ATTEMPTS) || 3,
  backoffDelay: Number(env.QUEUE_BACKOFF_DELAY) || 2000,
})

const buildServiceConfig = (): ServiceConfig => ({
  databaseUrl: env.DATABASE_URL,
  r2: buildR2Config(),
  queue: buildQueueConfig(),
})

// Functional service composition
const composeServices = (config: ServiceConfig): Services => {
  const verification = new VerificationService()
  const r2 = createR2Service(config.r2)
  const verificationTask = createVerificationTaskService(config.databaseUrl)
  const queue = createQueueService(
    config.queue,
    verification,
    verificationTask,
    r2,
  )

  return { verification, queue, r2, verificationTask }
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
const closeService = async (service: { close?: () => Promise<void> }) => {
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
export { createQueueService, createR2Service, createVerificationTaskService }
export type {
  QueueConfig,
  R2Config,
  QueueService,
  R2Service,
  VerificationTaskService,
}
