import {createDbConnection, type DbConnection} from '@phala/trust-center-db'
import {
  type VerificationTaskStatus,
  verificationTasksTable,
} from '@phala/trust-center-db/schema'
import {eq, sql} from 'drizzle-orm'

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

  return {
    updateVerificationTask,
    getDb: () => db,
  }
}

export type VerificationTaskService = ReturnType<
  typeof createVerificationTaskService
>
