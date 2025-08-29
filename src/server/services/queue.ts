import { type Job, Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'

import type { VerificationService } from '../../verificationService'
import type { VerifierType } from '../db'
import type { R2Service } from './r2'
import type { VerificationTaskService } from './taskService'

export interface QueueConfig {
  redisUrl: string
  queueName: string
  concurrency: number
  maxAttempts: number
  backoffDelay: number
}

export interface TaskData {
  postgresTaskId: string // PostgreSQL task ID for correlation
  appId: string
  appName: string
  verifierType: VerifierType
  config?: Record<string, unknown>
  flags?: Record<string, boolean>
  metadata?: Record<string, unknown>
}

export interface TaskResult {
  postgresTaskId: string // Include this for correlation
  success: boolean
  error?: string
  processingTimeMs: number
  verificationResult?: unknown // The actual verification result
}

// Default configuration for verification
const DEFAULT_CONFIG = {
  kms: {
    contractAddress:
      '0x0000000000000000000000000000000000000000' as `0x${string}`,
  },
  gateway: {
    contractAddress:
      '0x0000000000000000000000000000000000000000' as `0x${string}`,
    rpcEndpoint: 'http://localhost:8545',
  },
  redpill: {
    contractAddress:
      '0x0000000000000000000000000000000000000000' as `0x${string}`,
    model: 'default',
  },
}

// Default verification flags
const DEFAULT_VERIFICATION_FLAGS = {
  hardware: true,
  os: true,
  sourceCode: true,
  teeControlledKey: true,
  certificateKey: true,
  dnsCAA: false,
  ctLog: false,
}

export const createQueueService = (
  config: QueueConfig,
  verificationService: VerificationService,
  verificationTaskService: VerificationTaskService,
  r2Service: R2Service,
) => {
  const redis = new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
  })

  const queue = new Queue(config.queueName, {
    connection: redis,
    defaultJobOptions: {
      attempts: config.maxAttempts,
      backoff: {
        type: 'exponential',
        delay: config.backoffDelay,
      },
    },
  })

  const worker = new Worker(
    config.queueName,
    async (job: Job<TaskData>): Promise<TaskResult> => {
      const startTime = Date.now()
      const {
        postgresTaskId,
        appId,
        appName,
        verifierType,
        config,
        flags,
        metadata,
      } = job.data

      try {
        console.log(
          `[QUEUE] Processing verification task ${postgresTaskId} for app ${appId}/${appName}`,
        )

        // Update task status to active
        await verificationTaskService.updateVerificationTask(postgresTaskId, {
          status: 'active',
          startedAt: new Date(),
        })

        // Merge task config with DEFAULT_CONFIG
        const mergedConfigs = {
          kms: {
            ...DEFAULT_CONFIG.kms,
            ...(config?.kms as Record<string, unknown>),
            metadata: { appId, appName, ...metadata },
          },
          gateway: {
            ...DEFAULT_CONFIG.gateway,
            ...(config?.gateway as Record<string, unknown>),
            metadata: { appId, appName, ...metadata },
          },
          redpill: {
            ...DEFAULT_CONFIG.redpill,
            ...(config?.redpill as Record<string, unknown>),
            metadata: { appId, appName, ...metadata },
          },
        }

        // Merge verification flags with defaults
        const verificationFlags = {
          ...DEFAULT_VERIFICATION_FLAGS,
          ...flags,
        }

        console.log(
          `[QUEUE] Merged config:`,
          JSON.stringify(mergedConfigs, null, 2),
        )
        console.log(`[QUEUE] Verification flags:`, verificationFlags)

        // Process the verification and capture the result
        const verificationResult = await verificationService.verify(
          verifierType,
          mergedConfigs,
          verificationFlags,
        )

        const processingTimeMs = Date.now() - startTime

        console.log(
          `[QUEUE] Verification completed for task ${postgresTaskId} in ${processingTimeMs}ms`,
        )

        return {
          postgresTaskId,
          success: true,
          processingTimeMs,
          verificationResult,
        }
      } catch (error) {
        const processingTimeMs = Date.now() - startTime
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'

        console.error(
          `[QUEUE] Verification failed for task ${postgresTaskId}: ${errorMessage}`,
        )

        return {
          postgresTaskId,
          success: false,
          error: errorMessage,
          processingTimeMs,
        }
      }
    },
    {
      connection: redis,
      concurrency: config.concurrency,
    },
  )

  // Handle job completion
  const handleJobCompleted = async (job: Job<TaskData>, result: TaskResult) => {
    const { postgresTaskId } = result

    try {
      console.log(`[QUEUE] Job ${job.id} completed for task ${postgresTaskId}`)

      let uploadResult: {
        fileName?: string
        r2Key?: string
        r2Bucket?: string
      } = {}

      // Store result in R2 if successful
      if (result.success) {
        const upload = await r2Service.uploadJson(result.verificationResult)

        uploadResult = {
          fileName: upload.fileName,
          r2Key: upload.r2Key,
          r2Bucket: upload.r2Bucket,
        }

        console.log(
          `[QUEUE] Uploaded verification result to R2: ${upload.fileName}`,
        )
      }

      // Update PostgreSQL task status
      await verificationTaskService.updateVerificationTask(postgresTaskId, {
        status: 'completed',
        finishedAt: new Date(),
        ...uploadResult,
      })

      console.log(`[QUEUE] Task ${postgresTaskId} completed successfully`)
    } catch (error) {
      console.error(
        `[QUEUE] Failed to handle completion for task ${postgresTaskId}:`,
        error,
      )

      // Try to mark task as failed if update failed
      try {
        await verificationTaskService.updateVerificationTask(postgresTaskId, {
          status: 'failed',
          errorMessage:
            error instanceof Error ? error.message : 'Post-processing failed',
          finishedAt: new Date(),
        })
      } catch (updateError) {
        console.error(
          `[QUEUE] Failed to update task ${postgresTaskId} status:`,
          updateError,
        )
      }
    }
  }

  // Handle job failure
  const handleJobFailed = async (
    job: Job<TaskData> | undefined,
    error: Error,
  ) => {
    if (!job) {
      console.error('[QUEUE] Job failure handler called with undefined job')
      return
    }

    const { postgresTaskId } = job.data

    try {
      console.error(
        `[QUEUE] Job ${job.id} failed for task ${postgresTaskId}: ${error.message}`,
      )

      // Update PostgreSQL task status
      await verificationTaskService.updateVerificationTask(postgresTaskId, {
        status: 'failed',
        errorMessage: error.message,
        finishedAt: new Date(),
      })

      console.log(`[QUEUE] Marked task ${postgresTaskId} as failed`)
    } catch (updateError) {
      console.error(
        `[QUEUE] Failed to update task ${postgresTaskId} status:`,
        updateError,
      )
    }
  }

  // Handle job progress
  const handleJobProgress = async (job: Job<TaskData>, progress: unknown) => {
    const { postgresTaskId } = job.data
    const progressValue = typeof progress === 'number' ? progress : 0
    console.log(
      `[QUEUE] Job ${job.id} progress for task ${postgresTaskId}: ${progressValue}%`,
    )
  }

  // Event listeners
  worker.on('completed', handleJobCompleted)
  worker.on('failed', handleJobFailed)
  worker.on('progress', handleJobProgress)

  // Add task to queue
  const addTask = async (
    taskData: Omit<TaskData, 'postgresTaskId'>,
  ): Promise<string> => {
    // 1. Create task in PostgreSQL first
    const postgresTaskId = await verificationTaskService.createVerificationTask(
      {
        appId: taskData.appId,
        appName: taskData.appName,
        verifierType: taskData.verifierType,
        payload: JSON.stringify({
          config: taskData.config,
          flags: taskData.flags,
          metadata: taskData.metadata,
        }),
      },
    )

    // 2. Add to queue with PostgreSQL ID
    const fullTaskData: TaskData = { ...taskData, postgresTaskId }
    const job = await queue.add('verification', fullTaskData, {
      jobId: postgresTaskId,
    })

    // 3. Update PostgreSQL task with job ID
    await verificationTaskService.updateVerificationTask(postgresTaskId, {
      bullJobId: job.id,
    })

    console.log(
      `[QUEUE] Added verification task ${postgresTaskId} for app ${taskData.appId}/${taskData.appName}`,
    )
    return postgresTaskId
  }

  const getJob = async (jobId: string): Promise<Job | null> => {
    return await queue.getJob(jobId)
  }

  const removeJob = async (jobId: string): Promise<boolean> => {
    const job = await queue.getJob(jobId)
    if (!job) return false

    await job.remove()
    return true
  }

  const retryJob = async (jobId: string): Promise<boolean> => {
    const job = await queue.getJob(jobId)
    if (!job) return false

    await job.retry()
    return true
  }

  const getStats = async () => {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ])

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: await queue.isPaused(),
    }
  }

  const pause = async (): Promise<void> => {
    await queue.pause()
  }

  const resume = async (): Promise<void> => {
    await queue.resume()
  }

  const clean = async (opts: {
    grace: number
    status: 'completed' | 'failed' | 'delayed'
    limit: number
  }): Promise<number> => {
    const jobs = await queue.clean(opts.grace, opts.limit, opts.status)
    return jobs.length
  }

  const healthCheck = async () => {
    try {
      await redis.ping()
      const stats = await getStats()
      return {
        status: 'healthy',
        redis: 'connected',
        queue: stats,
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        redis: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  const isHealthy = async (): Promise<boolean> => {
    try {
      await redis.ping()
      return true
    } catch {
      return false
    }
  }

  const close = async () => {
    await worker.close()
    await queue.close()
    await redis.quit()
  }

  return {
    addTask,
    getJob,
    removeJob,
    retryJob,
    getStats,
    pause,
    resume,
    clean,
    healthCheck,
    isHealthy,
    close,
  }
}

export type QueueService = ReturnType<typeof createQueueService>
