import {
  and,
  createDbConnection,
  type DbConnection,
  eq,
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
    await db
      .update(verificationTasksTable)
      .set(data)
      .where(eq(verificationTasksTable.id, id))

    return true
  }

  // Create a single task (new tasks always have these IDs from Metabase)
  const createTask = async (taskData: {
    id: string
    appId: string
    appProfileId: number // Required for new tasks
    appName: string
    appConfigType: 'redpill' | 'phala_cloud'
    contractAddress: string
    modelOrDomain: string
    dstackVersion?: string | null
    isPublic?: boolean
    user?: string | null
    workspaceId: number // Required for new tasks
    creatorId: number // Required for new tasks
    status: 'pending' | 'active'
    bullJobId?: string | null
    createdAt: Date
    startedAt?: Date | null
  }): Promise<void> => {
    await db.insert(verificationTasksTable).values(taskData)
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
      .returning({ id: verificationTasksTable.id })

    return result.length
  }

  return {
    updateVerificationTask,
    createTask,
    cleanupFailedTasks,
    getDb: () => db,
  }
}

export type VerificationTaskService = ReturnType<
  typeof createVerificationTaskService
>

export type TaskService = VerificationTaskService
