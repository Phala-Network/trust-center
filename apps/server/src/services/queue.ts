import {VerificationService} from '@phala/dstack-verifier'
import type {
  PhalaCloudConfig,
  RedpillConfig,
  VerificationResponse,
} from '@phala/dstack-verifier'
import {and, eq, gte, verificationTasksTable} from '@phala/trust-center-db'
import {type Job, Queue, Worker} from 'bullmq'
import IORedis from 'ioredis'
import {isAddress} from 'viem'

import type {TaskCreateRequest} from '../types/schemas'
import type {S3Service} from './s3'
import type {VerificationTaskService} from './taskService'

export interface QueueConfig {
  redisUrl: string
  queueName: string
  concurrency: number
  maxAttempts: number
  backoffDelay: number
}

export interface TaskData extends TaskCreateRequest {
  postgresTaskId: string // PostgreSQL task ID for correlation
  dstackVersion?: string
  isPublic?: boolean
}

export interface NewTaskData {
  appId: string
  appName: string
  appConfigType: 'phala_cloud' | 'redpill'
  contractAddress: string
  modelOrDomain: string
  dstackVersion?: string
  isPublic?: boolean
  metadata?: any
  flags?: any
  user?: string
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
        dstackVersion,
        isPublic,
        metadata,
        flags,
        user,
      } = job.data

      try {
        console.log(
          `[QUEUE] Processing verification task ${postgresTaskId} for app ${appId}/${appName}`,
        )
        if (!isAddress(contractAddress)) {
          throw new Error('Invalid contract address')
        }

        // Check if app has a recent completed report (within last 24 hours)
        const oneDayAgo = new Date()
        oneDayAgo.setDate(oneDayAgo.getDate() - 1)

        const db = verificationTaskService.getDb()
        const recentReports = await db
          .select({id: verificationTasksTable.id})
          .from(verificationTasksTable)
          .where(
            and(
              eq(verificationTasksTable.appId, appId),
              eq(verificationTasksTable.status, 'completed'),
              gte(verificationTasksTable.createdAt, oneDayAgo),
            ),
          )
          .limit(1)

        if (recentReports.length > 0) {
          console.log(
            `[QUEUE] Skipping task ${postgresTaskId} - app ${appId} has a report within last 24 hours`,
          )
          return {
            postgresTaskId,
            success: true,
            processingTimeMs: Date.now() - startTime,
          }
        }

        // Create task in database when starting processing
        await verificationTaskService.createTask({
          id: postgresTaskId,
          appId,
          appName,
          appConfigType,
          contractAddress,
          modelOrDomain,
          dstackVersion: dstackVersion || null,
          isPublic: isPublic ?? false,
          user: user || null,
          status: 'active' as const,
          bullJobId: job.id,
          createdAt: new Date(),
          startedAt: new Date(),
        })

        console.log(`[QUEUE] Created DB record for task ${postgresTaskId}`)

        console.log(
          `[QUEUE] Processing verification for ${appConfigType} config:`,
          JSON.stringify({contractAddress, modelOrDomain, metadata}, null, 2),
        )
        console.log(`[QUEUE] Verification flags:`, flags)

        // Create app config for VerificationService
        // Note: VerificationService will generate complete metadata from systemInfo
        // if the provided metadata is incomplete
        let appConfig: RedpillConfig | PhalaCloudConfig
        if (appConfigType === 'redpill') {
          appConfig = {
            contractAddress: contractAddress,
            model: modelOrDomain,
            metadata,
          }
        } else {
          // phala_cloud config
          appConfig = {
            contractAddress: contractAddress,
            domain: modelOrDomain,
            metadata,
          }
        }

        // Create a new VerificationService instance for each task to avoid state pollution
        // This ensures complete isolation between concurrent verification tasks
        const verificationService = new VerificationService()

        // Execute verification using VerificationService
        // verificationFlags can be partial - VerificationService will merge with defaults
        const verificationResult = await verificationService.verify(
          appConfig,
          flags,
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
    const {postgresTaskId} = result

    try {
      console.log(`[QUEUE] Job ${job.id} completed for task ${postgresTaskId}`)

      let uploadResult: {
        s3Filename?: string
        s3Key?: string
        s3Bucket?: string
        dataObjects?: string[]
      } = {}

      // Store result in R2 if successful
      if (result.success && result.verificationResult) {
        const upload = await s3Service.uploadJson(result.verificationResult)

        // Extract data object IDs from verification result
        const dataObjectIds =
          result.verificationResult.dataObjects?.map((obj) => obj.id) || []

        uploadResult = {
          s3Filename: upload.s3Filename,
          s3Key: upload.s3Key,
          s3Bucket: upload.s3Bucket,
          dataObjects: dataObjectIds,
        }

        console.log(
          `[QUEUE] Uploaded verification result to S3: ${upload.s3Filename}`,
        )
        console.log(
          `[QUEUE] Extracted ${dataObjectIds.length} data object IDs`,
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
        dataObjects?: string[]
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

    const {postgresTaskId} = job.data

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
    const {postgresTaskId} = job.data
    const progressValue = typeof progress === 'number' ? progress : 0
    console.log(
      `[QUEUE] Job ${job.id} progress for task ${postgresTaskId}: ${progressValue}%`,
    )
  }

  // Event listeners
  worker.on('completed', handleJobCompleted)
  worker.on('failed', handleJobFailed)
  worker.on('progress', handleJobProgress)

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

  // Add new task (only adds to queue, worker will create DB record)
  const addTask = async (taskData: NewTaskData): Promise<string> => {
    // Create task ID
    const taskId = crypto.randomUUID()

    // Add to queue directly (worker will create DB record)
    const queueData: TaskData = {
      postgresTaskId: taskId,
      appId: taskData.appId,
      appName: taskData.appName,
      appConfigType: taskData.appConfigType,
      contractAddress: taskData.contractAddress,
      modelOrDomain: taskData.modelOrDomain,
      dstackVersion: taskData.dstackVersion,
      isPublic: taskData.isPublic,
      metadata: taskData.metadata,
      flags: taskData.flags,
      user: taskData.user,
    }

    const job = await queue.add('verification', queueData, {
      jobId: taskId,
    })

    console.log(
      `[QUEUE] Queued verification task ${taskId} for app ${taskData.appId}/${taskData.appName}`,
    )

    return taskId
  }

  const close = async () => {
    await worker.close()
    await queue.close()
    await redis.quit()
  }

  return {
    addTask,
    getStats,
    healthCheck,
    close,
  }
}

export type QueueService = ReturnType<typeof createQueueService>
