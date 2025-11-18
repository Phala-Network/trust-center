import {
  and,
  createDbConnection,
  type DbConnection,
  desc,
  eq,
  isNotNull,
  lt,
  or,
  type VerificationTaskStatus,
  verificationTasksTable,
} from '@phala/trust-center-db'

// Types
export interface UpdateVerificationTaskData {
  status?: VerificationTaskStatus
  bullJobId?: string
  errorMessage?: string
  startedAt?: Date
  finishedAt?: Date
  s3Filename?: string
  s3Key?: string
  s3Bucket?: string
  dataObjects?: string[]
  dstackVersion?: string
}

// Verification task service factory function
export const createVerificationTaskService = (
  databaseUrl: string = process.env.DATABASE_URL || '',
) => {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required')
  }
  const db: DbConnection = createDbConnection(databaseUrl)

  // Update task
  const updateVerificationTask = async (
    id: string,
    data: UpdateVerificationTaskData,
  ): Promise<boolean> => {
    const result = await db
      .update(verificationTasksTable)
      .set(data)
      .where(eq(verificationTasksTable.id, id))
      .returning({id: verificationTasksTable.id})

    if (result.length === 0) {
      console.warn(`[TASK] Task ${id} not found for update`)
      return false
    }

    return true
  }

  // Create a single task
  const createTask = async (taskData: {
    id: string
    appId: string // References apps.id (dstack app ID string)
    status: 'pending' | 'active'
    bullJobId?: string | null
    appMetadata?: any
    verificationFlags?: any
    createdAt: Date
    startedAt?: Date | null
  }): Promise<void> => {
    try {
      await db.insert(verificationTasksTable).values(taskData)
    } catch (error) {
      // Handle duplicate key error gracefully
      if (error instanceof Error && error.message.includes('duplicate key')) {
        console.warn(
          `[TASK] Task ${taskData.id} already exists, skipping creation`,
        )
        return
      }
      throw error
    }
  }

  // Delete old failed/cancelled tasks (older than specified hours)
  const cleanupFailedTasks = async (olderThanHours = 24): Promise<number> => {
    const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000)

    const result = await db
      .delete(verificationTasksTable)
      .where(
        and(
          or(
            eq(verificationTasksTable.status, 'failed'),
            eq(verificationTasksTable.status, 'cancelled'),
          ),
          lt(verificationTasksTable.createdAt, cutoffDate),
        ),
      )
      .returning({id: verificationTasksTable.id})

    return result.length
  }

  // Get latest completed task finish time
  const getLatestCompletedTask = async (): Promise<Date | null> => {
    const result = await db
      .select({
        finishedAt: verificationTasksTable.finishedAt,
      })
      .from(verificationTasksTable)
      .where(
        and(
          eq(verificationTasksTable.status, 'completed'),
          isNotNull(verificationTasksTable.finishedAt),
        ),
      )
      .orderBy(desc(verificationTasksTable.finishedAt))
      .limit(1)

    return result[0]?.finishedAt ?? null
  }

  return {
    updateVerificationTask,
    createTask,
    cleanupFailedTasks,
    getLatestCompletedTask,
    getDb: () => db,
  }
}

export type VerificationTaskService = ReturnType<
  typeof createVerificationTaskService
>

export type TaskService = VerificationTaskService
