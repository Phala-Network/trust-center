import {type DbConnection} from '@phala/trust-center-db'
import {verificationTasksTable} from '@phala/trust-center-db/schema'
import {and, eq, isNull} from 'drizzle-orm'

import type {QueueService, TaskData} from './queue'

export interface DbMonitorConfig {
  pollIntervalMs: number
}

export const createDbMonitorService = (
  db: DbConnection,
  queueService: QueueService,
  config: DbMonitorConfig,
) => {
  let isRunning = false
  let intervalId: NodeJS.Timeout | null = null

  const pollPendingTasks = async () => {
    try {
      // Find all pending tasks that don't have a bullJobId yet (to prevent duplicates)
      const pendingTasks = await db
        .select()
        .from(verificationTasksTable)
        .where(
          and(
            eq(verificationTasksTable.status, 'pending'),
            isNull(verificationTasksTable.bullJobId),
          ),
        )
        .limit(100) // Process in batches

      if (pendingTasks.length > 0) {
        console.log(
          `[DB_MONITOR] Found ${pendingTasks.length} pending tasks to queue`,
        )
      }

      for (const task of pendingTasks) {
        try {
          // Add task to queue
          const taskData: TaskData = {
            postgresTaskId: task.id,
            appId: task.appId,
            appName: task.appName,
            appConfigType: task.appConfigType as 'redpill' | 'phala_cloud',
            contractAddress: task.contractAddress,
            modelOrDomain: task.modelOrDomain,
            metadata: task.appMetadata || undefined,
            flags: task.verificationFlags || undefined,
          }

          await queueService.addExistingTask(taskData)

          console.log(
            `[DB_MONITOR] Queued task ${task.id} for app ${task.appId}/${task.appName}`,
          )
        } catch (error) {
          console.error(
            `[DB_MONITOR] Failed to queue task ${task.id}:`,
            error instanceof Error ? error.message : error,
          )

          // Mark task as failed if we can't queue it
          try {
            await db
              .update(verificationTasksTable)
              .set({
                status: 'failed',
                errorMessage: `Failed to queue task: ${error instanceof Error ? error.message : 'Unknown error'}`,
                finishedAt: new Date(),
              })
              .where(eq(verificationTasksTable.id, task.id))
          } catch (updateError) {
            console.error(
              `[DB_MONITOR] Failed to update task ${task.id} status:`,
              updateError,
            )
          }
        }
      }
    } catch (error) {
      console.error(
        '[DB_MONITOR] Error polling pending tasks:',
        error instanceof Error ? error.message : error,
      )
    }
  }

  const start = () => {
    if (isRunning) {
      console.log('[DB_MONITOR] Already running')
      return
    }

    isRunning = true
    console.log(
      `[DB_MONITOR] Starting database monitor (polling every ${config.pollIntervalMs}ms)`,
    )

    // Poll immediately on start
    pollPendingTasks()

    // Then poll on interval
    intervalId = setInterval(pollPendingTasks, config.pollIntervalMs)
  }

  const stop = () => {
    if (!isRunning) {
      return
    }

    isRunning = false
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }

    console.log('[DB_MONITOR] Stopped database monitor')
  }

  return {
    start,
    stop,
    isRunning: () => isRunning,
  }
}

export type DbMonitorService = ReturnType<typeof createDbMonitorService>
