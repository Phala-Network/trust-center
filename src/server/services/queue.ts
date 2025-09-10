import { type Job, Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'

import type {
  PhalaCloudConfig,
  RedpillConfig,
  VerificationFlags,
} from '../../config'
import type { AppMetadata, VerificationResponse } from '../../types'
import type { VerificationService } from '../../verificationService'
import type { AppConfigType } from '../db/schema'
import type { S3Service } from './s3'
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
  appConfigType: AppConfigType
  contractAddress: string
  modelOrDomain: string
  appMetadata?: AppMetadata
  verificationFlags?: Partial<VerificationFlags>
}

export interface TaskResult {
  postgresTaskId: string // Include this for correlation
  success: boolean
  error?: string
  processingTimeMs: number
  verificationResult?: VerificationResponse
}

export const createQueueService = (
  config: QueueConfig,
  verificationService: VerificationService,
  verificationTaskService: VerificationTaskService,
  s3Service: S3Service,
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
        appConfigType,
        contractAddress,
        modelOrDomain,
        appMetadata,
        verificationFlags,
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

        console.log(
          `[QUEUE] Processing verification for ${appConfigType} config:`,
          JSON.stringify(
            { contractAddress, modelOrDomain, appMetadata },
            null,
            2,
          ),
        )
        console.log(`[QUEUE] Verification flags:`, verificationFlags)

        // Create app config for VerificationService
        // Note: VerificationService will generate complete metadata from systemInfo
        // if the provided metadata is incomplete
        let appConfig: RedpillConfig | PhalaCloudConfig
        if (appConfigType === 'redpill') {
          appConfig = {
            contractAddress: contractAddress as `0x${string}`,
            model: modelOrDomain,
            metadata: appMetadata,
          }
        } else {
          // phala_cloud config
          appConfig = {
            contractAddress: contractAddress as `0x${string}`,
            domain: modelOrDomain,
            metadata: appMetadata,
          }
        }

        // Execute verification using VerificationService
        // verificationFlags can be partial - VerificationService will merge with defaults
        const verificationResult = await verificationService.verify(
          appConfig,
          verificationFlags,
        )
        if (!verificationResult.success) {
          throw new Error(
            verificationResult.errors.map((error) => error.message).join(', '),
          )
        }

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
        s3Filename?: string
        s3Key?: string
        s3Bucket?: string
      } = {}

      // Store result in R2 if successful
      if (result.success) {
        const upload = await s3Service.uploadJson(result.verificationResult)

        uploadResult = {
          s3Filename: upload.s3Filename,
          s3Key: upload.s3Key,
          s3Bucket: upload.s3Bucket,
        }

        console.log(
          `[QUEUE] Uploaded verification result to S3: ${upload.s3Filename}`,
        )
      }

      // Update PostgreSQL task status based on verification result
      const taskStatus = result.success ? 'completed' : 'failed'
      const updateData: {
        status: 'completed' | 'failed'
        finishedAt: Date
        s3Filename?: string
        s3Key?: string
        s3Bucket?: string
        errorMessage?: string
      } = {
        status: taskStatus,
        finishedAt: new Date(),
        ...uploadResult,
      }

      // Add error message if verification failed
      if (!result.success && result.error) {
        updateData.errorMessage = result.error
      }

      await verificationTaskService.updateVerificationTask(
        postgresTaskId,
        updateData,
      )

      if (result.success) {
        console.log(`[QUEUE] Task ${postgresTaskId} completed successfully`)
      } else {
        console.log(`[QUEUE] Task ${postgresTaskId} failed: ${result.error}`)
      }
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
    // Generate default values if not provided
    const appMetadata = taskData.appMetadata || ({} as AppMetadata)
    const verificationFlags = taskData.verificationFlags

    // 1. Create task in PostgreSQL first
    const postgresTaskId = await verificationTaskService.createVerificationTask(
      {
        appId: taskData.appId,
        appName: taskData.appName,
        appConfigType: taskData.appConfigType,
        contractAddress: taskData.contractAddress,
        modelOrDomain: taskData.modelOrDomain,
        appMetadata,
        verificationFlags,
      },
    )

    // 2. Add to queue with PostgreSQL ID and generated defaults
    const fullTaskData: TaskData = {
      ...taskData,
      postgresTaskId,
      appMetadata,
      verificationFlags,
    }
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

  // Add existing task back to queue (for retry functionality)
  const addExistingTask = async (taskData: TaskData): Promise<string> => {
    const job = await queue.add('verification', taskData, {
      jobId: taskData.postgresTaskId,
    })

    // Update PostgreSQL task with job ID
    await verificationTaskService.updateVerificationTask(
      taskData.postgresTaskId,
      {
        bullJobId: job.id,
      },
    )

    console.log(
      `[QUEUE] Re-added verification task ${taskData.postgresTaskId} for app ${taskData.appId}/${taskData.appName}`,
    )
    return taskData.postgresTaskId
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
    addExistingTask,
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
