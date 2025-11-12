import type {
  PhalaCloudConfig,
  RedpillConfig,
  VerificationResponse,
} from '@phala/dstack-verifier'
import {
  toAppId,
  toContractAddress,
  VerificationService,
} from '@phala/dstack-verifier'
import {
  and,
  eq,
  gte,
  type NewVerificationTask,
  verificationTasksTable,
} from '@phala/trust-center-db'
import {type Job, Queue, Worker} from 'bullmq'
import IORedis from 'ioredis'
import {isAddress} from 'viem'

import type {AppService} from './appService'
import type {S3Service} from './s3'
import type {VerificationTaskService} from './taskService'
import type {VijilService} from './vijil'

export interface QueueConfig {
  redisUrl: string
  queueName: string
  concurrency: number
  maxAttempts: number
  backoffDelay: number
}

export interface TaskData {
  postgresTaskId: string // PostgreSQL task ID for correlation
  appId: string // Internal UUID from apps table
  appMetadata?: any // Runtime metadata from systemInfo
  verificationFlags?: any // Verification configuration
}

// NewTaskData for queue
export type NewTaskData = {
  appId: string // Internal UUID from apps table
  appMetadata?: any
  verificationFlags?: any
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
  appService: AppService,
  vijilService: VijilService,
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
      // Auto-remove jobs from Redis after completion
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour (3600 seconds)
        count: 100, // Keep last 100 completed jobs
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours (86400 seconds)
        count: 1000, // Keep last 1000 failed jobs
      },
    },
  })

  const worker = new Worker(
    config.queueName,
    async (job: Job<TaskData>): Promise<TaskResult> => {
      const startTime = Date.now()
      const {postgresTaskId, appId, appMetadata, verificationFlags} = job.data

      try {
        // Get app data from apps table
        const app = await appService.getAppById(appId)
        if (!app) {
          throw new Error(`App not found with ID: ${appId}`)
        }

        console.log(
          `[QUEUE] Processing verification task ${postgresTaskId} for app ${app.id}/${app.appName}`,
        )

        // Note: App should already be validated by getValidApps() or getAppsNeedingVerification()
        // This is a final safety check
        if (!isAddress(app.contractAddress)) {
          throw new Error(
            `Invalid contract address: ${app.contractAddress}. This should have been filtered earlier.`,
          )
        }

        if (!app.modelOrDomain) {
          throw new Error(
            `Missing modelOrDomain for app ${app.id}. This should have been filtered earlier.`,
          )
        }

        // Note: 24h duplicate check is now handled at the database query level
        // in appService.getAppsNeedingVerification() - no need to check here

        // Create task in database when actually starting processing
        await verificationTaskService.createTask({
          id: postgresTaskId,
          appId,
          status: 'active' as const,
          bullJobId: job.id,
          appMetadata,
          verificationFlags,
          createdAt: new Date(),
          startedAt: new Date(),
        })

        console.log(
          `[QUEUE] Created DB record and started processing task ${postgresTaskId}`,
        )

        console.log(
          `[QUEUE] Processing verification for ${app.appConfigType} config:`,
          JSON.stringify(
            {
              contractAddress: app.contractAddress,
              modelOrDomain: app.modelOrDomain,
              metadata: appMetadata,
            },
            null,
            2,
          ),
        )
        console.log(`[QUEUE] Verification flags:`, verificationFlags)

        // Create app config for VerificationService
        // Note: VerificationService will generate complete metadata from systemInfo
        // if the provided metadata is incomplete
        const appConfig: RedpillConfig | PhalaCloudConfig =
          app.appConfigType === 'redpill'
            ? {
                contractAddress: toContractAddress(app.contractAddress),
                model: app.modelOrDomain,
                metadata: appMetadata,
              }
            : {
                appId: toAppId(app.id),
                domain: app.modelOrDomain,
                metadata: appMetadata,
              }

        // Create a new VerificationService instance for each task to avoid state pollution
        // This ensures complete isolation between concurrent verification tasks
        const verificationService = new VerificationService()

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

        // Check if this is an agent and query Vijil for evaluations
        if (app.appConfigType === 'phala_cloud' && vijilService.isWhitelistedAgent(appId)) {
          console.log(`[VIJIL] App ${appId} is whitelisted as agent, querying evaluations...`)

          try {
            const vijilInfo = await vijilService.getAgentEvaluationInfo(appId, app.modelOrDomain)

            if (vijilInfo.evaluations.length > 0) {
              console.log(`[VIJIL] Found ${vijilInfo.evaluations.length} evaluations for app ${appId}`)

              // Add Vijil evaluation links to verification result
              // Cast to any for demo purposes to extend the response
              const extendedResult = verificationResult as any
              if (!extendedResult.metadata) {
                extendedResult.metadata = {}
              }

              extendedResult.metadata.vijil = {
                isAgent: true,
                agentEndpoint: vijilInfo.agentEndpoint,
                evaluations: vijilInfo.evaluations.map((evaluation) => ({
                  id: evaluation.id,
                  status: evaluation.status,
                  reportUrl: evaluation.report_url,
                  webLink: vijilService.getEvaluationWebLink(evaluation.id),
                  createdAt: evaluation.created_at,
                })),
              }

              console.log(`[VIJIL] Added evaluation links to verification result`)
            } else {
              console.log(`[VIJIL] No evaluations found for app ${appId}`)
            }
          } catch (error) {
            console.error(`[VIJIL] Error querying evaluations for app ${appId}:`, error)
            // Don't fail the verification if Vijil query fails
          }
        }

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
        console.log(`[QUEUE] Extracted ${dataObjectIds.length} data object IDs`)
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
    // Validate app exists
    const app = await appService.getAppById(taskData.appId)
    if (!app) {
      throw new Error(`App not found with ID: ${taskData.appId}`)
    }

    // Create task ID
    const taskId = crypto.randomUUID()

    // Add to queue directly (worker will create DB record)
    const queueData: TaskData = {
      postgresTaskId: taskId,
      appId: taskData.appId,
      appMetadata: taskData.appMetadata,
      verificationFlags: taskData.verificationFlags,
    }

    const job = await queue.add('verification', queueData, {
      jobId: taskId,
    })

    console.log(
      `[QUEUE] Queued verification task ${taskId} for app ${app.id}/${app.appName}`,
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
