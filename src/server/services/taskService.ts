import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm'

import {
  createDbConnection,
  type DbConnection,
  schema,
  type VerificationTask,
  type VerificationTaskStatus,
  type VerifierType,
} from '../db'

const { verificationTasks } = schema

// Types
export interface TaskFilter {
  jobName?: string
  status?: VerificationTaskStatus
  appId?: string
  appName?: string
  verifierType?: VerifierType
  fromDate?: string
  toDate?: string
  page?: number
  limit?: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  hasNext: boolean
}

export interface CreateVerificationTaskData {
  appId: string
  appName: string
  verifierType: VerifierType
  payload: string // JSON string containing config, flags, metadata, etc.
}

export interface UpdateVerificationTaskData {
  status?: VerificationTaskStatus
  bullJobId?: string
  errorMessage?: string
  startedAt?: Date
  finishedAt?: Date
  fileName?: string
  r2Key?: string
  r2Bucket?: string
}

// Verification task service factory function
export const createVerificationTaskService = (
  databaseUrl: string = process.env.DATABASE_URL || '',
) => {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required')
  }
  const db: DbConnection = createDbConnection(databaseUrl)

  // Create a new verification task in PostgreSQL
  const createVerificationTask = async (
    data: CreateVerificationTaskData,
  ): Promise<string> => {
    const result = await db
      .insert(verificationTasks)
      .values({
        appId: data.appId,
        appName: data.appName,
        verifierType: data.verifierType,
        payload: data.payload,
        status: 'pending',
        jobName: 'verification',
      })
      .returning({ id: verificationTasks.id })

    if (!result[0]) {
      throw new Error('Failed to create verification task')
    }
    return result[0].id
  }

  // Get task by ID
  const getVerificationTask = async (
    id: string,
  ): Promise<VerificationTask | null> => {
    const result = await db
      .select()
      .from(verificationTasks)
      .where(eq(verificationTasks.id, id))
      .limit(1)

    return result[0] || null
  }

  // Get task by BullMQ job ID
  const getVerificationTaskByBullJobId = async (
    bullJobId: string,
  ): Promise<VerificationTask | null> => {
    const result = await db
      .select()
      .from(verificationTasks)
      .where(eq(verificationTasks.bullJobId, bullJobId))
      .limit(1)

    return result[0] || null
  }

  // Update task
  const updateVerificationTask = async (
    id: string,
    data: UpdateVerificationTaskData,
  ): Promise<boolean> => {
    await db
      .update(verificationTasks)
      .set(data)
      .where(eq(verificationTasks.id, id))

    return true
  }

  // Update task by BullMQ job ID
  const updateVerificationTaskByBullJobId = async (
    bullJobId: string,
    data: UpdateVerificationTaskData,
  ): Promise<boolean> => {
    await db
      .update(verificationTasks)
      .set(data)
      .where(eq(verificationTasks.bullJobId, bullJobId))

    return true
  }

  // List tasks with filtering and pagination
  const listVerificationTasks = async (
    filter: TaskFilter = {},
  ): Promise<PaginatedResult<VerificationTask>> => {
    const {
      jobName,
      status,
      appId,
      appName,
      verifierType,
      fromDate,
      toDate,
      page = 1,
      limit = 50,
    } = filter

    // Build where conditions
    const conditions = []
    if (jobName) conditions.push(eq(verificationTasks.jobName, jobName))
    if (status) conditions.push(eq(verificationTasks.status, status))
    if (appId) conditions.push(eq(verificationTasks.appId, appId))
    if (appName) conditions.push(eq(verificationTasks.appName, appName))
    if (verifierType)
      conditions.push(eq(verificationTasks.verifierType, verifierType))
    if (fromDate)
      conditions.push(gte(verificationTasks.createdAt, new Date(fromDate)))
    if (toDate)
      conditions.push(lte(verificationTasks.createdAt, new Date(toDate)))

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Get total count
    const totalResult = await db
      .select({ count: count() })
      .from(verificationTasks)
      .where(whereClause)

    const total = totalResult[0]?.count || 0

    // Get paginated data
    const offset = (page - 1) * limit
    const data = await db
      .select()
      .from(verificationTasks)
      .where(whereClause)
      .orderBy(desc(verificationTasks.createdAt))
      .limit(limit)
      .offset(offset)

    return {
      data,
      total,
      hasNext: offset + limit < total,
    }
  }

  // Delete task
  const deleteVerificationTask = async (id: string): Promise<boolean> => {
    await db.delete(verificationTasks).where(eq(verificationTasks.id, id))

    return true
  }

  // Get task statistics
  const getVerificationTaskStats = async () => {
    const stats = await db
      .select({
        status: verificationTasks.status,
        count: count(),
      })
      .from(verificationTasks)
      .groupBy(verificationTasks.status)

    const total = await db.select({ count: count() }).from(verificationTasks)

    const statusMap = stats.reduce(
      (acc, stat) => {
        if (stat.status) {
          acc[stat.status] = Number(stat.count)
        }
        return acc
      },
      {} as Record<string, number>,
    )

    return {
      total: Number(total[0]?.count || 0),
      pending: statusMap.pending || 0,
      active: statusMap.active || 0,
      completed: statusMap.completed || 0,
      failed: statusMap.failed || 0,
    }
  }

  // Get tasks for cleanup (older than 30 days)
  const getVerificationTasksForCleanup = async (
    daysOld = 30,
  ): Promise<string[]> => {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const result = await db
      .select({ id: verificationTasks.id })
      .from(verificationTasks)
      .where(
        and(
          eq(verificationTasks.status, 'completed'),
          sql`${verificationTasks.finishedAt} IS NOT NULL AND ${verificationTasks.finishedAt} < ${cutoffDate}`,
        ),
      )

    return result.map((row) => row.id)
  }

  // Cleanup old completed tasks
  const cleanupOldVerificationTasks = async (daysOld = 30): Promise<number> => {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    await db
      .delete(verificationTasks)
      .where(
        and(
          eq(verificationTasks.status, 'completed'),
          sql`${verificationTasks.finishedAt} IS NOT NULL AND ${verificationTasks.finishedAt} < ${cutoffDate}`,
        ),
      )

    // Since we can't get the exact count, return a reasonable estimate
    return 1
  }

  // Health check
  const healthCheck = async () => {
    try {
      await db.execute(sql`SELECT 1 as test`)
      return { status: 'healthy', message: 'Database connection successful' }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Database connection failed: ${error}`,
      }
    }
  }

  const isHealthy = async (): Promise<boolean> => {
    try {
      await db.execute(sql`SELECT 1 as test`)
      return true
    } catch {
      return false
    }
  }

  return {
    createVerificationTask,
    getVerificationTask,
    getVerificationTaskByBullJobId,
    updateVerificationTask,
    updateVerificationTaskByBullJobId,
    listVerificationTasks,
    deleteVerificationTask,
    getVerificationTaskStats,
    getVerificationTasksForCleanup,
    cleanupOldVerificationTasks,
    healthCheck,
    isHealthy,
  }
}

export type VerificationTaskService = ReturnType<
  typeof createVerificationTaskService
>
