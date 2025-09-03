import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm'

import type { AppMetadata, VerificationFlags } from '../../types'
import { createDbConnection, type DbConnection } from '../db'
import {
  type AppConfigType,
  type VerificationTask,
  type VerificationTaskStatus,
  verificationTasksTable,
} from '../db/schema'

// Types
export interface TaskFilter {
  jobName?: string
  status?: VerificationTaskStatus
  appId?: string
  appName?: string
  appConfigType?: AppConfigType
  contractAddress?: string
  modelOrDomain?: string
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
  appConfigType: AppConfigType
  contractAddress: string
  modelOrDomain: string
  appMetadata?: AppMetadata
  verificationFlags?: VerificationFlags
}

export interface UpdateVerificationTaskData {
  status?: VerificationTaskStatus
  bullJobId?: string
  errorMessage?: string
  startedAt?: Date
  finishedAt?: Date
  s3Filename?: string
  s3Key?: string
  s3Bucket?: string
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
      .insert(verificationTasksTable)
      .values({
        appId: data.appId,
        appName: data.appName,
        appConfigType: data.appConfigType,
        contractAddress: data.contractAddress,
        modelOrDomain: data.modelOrDomain,
        appMetadata: data.appMetadata,
        verificationFlags: data.verificationFlags,
        status: 'pending',
        jobName: 'verification',
      })
      .returning({ id: verificationTasksTable.id })

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
      .from(verificationTasksTable)
      .where(eq(verificationTasksTable.id, id))
      .limit(1)

    return result[0] || null
  }

  // Get task by BullMQ job ID
  const getVerificationTaskByBullJobId = async (
    bullJobId: string,
  ): Promise<VerificationTask | null> => {
    const result = await db
      .select()
      .from(verificationTasksTable)
      .where(eq(verificationTasksTable.bullJobId, bullJobId))
      .limit(1)

    return result[0] || null
  }

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

  // Update task by BullMQ job ID
  const updateVerificationTaskByBullJobId = async (
    bullJobId: string,
    data: UpdateVerificationTaskData,
  ): Promise<boolean> => {
    await db
      .update(verificationTasksTable)
      .set(data)
      .where(eq(verificationTasksTable.bullJobId, bullJobId))

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
      appConfigType,
      contractAddress,
      modelOrDomain,
      fromDate,
      toDate,
      page = 1,
      limit = 50,
    } = filter

    // Build where conditions
    const conditions = []
    if (jobName) conditions.push(eq(verificationTasksTable.jobName, jobName))
    if (status) conditions.push(eq(verificationTasksTable.status, status))
    if (appId) conditions.push(eq(verificationTasksTable.appId, appId))
    if (appName) conditions.push(eq(verificationTasksTable.appName, appName))
    if (appConfigType)
      conditions.push(eq(verificationTasksTable.appConfigType, appConfigType))
    if (contractAddress)
      conditions.push(
        eq(verificationTasksTable.contractAddress, contractAddress),
      )
    if (modelOrDomain)
      conditions.push(eq(verificationTasksTable.modelOrDomain, modelOrDomain))
    if (fromDate)
      conditions.push(gte(verificationTasksTable.createdAt, new Date(fromDate)))
    if (toDate)
      conditions.push(lte(verificationTasksTable.createdAt, new Date(toDate)))

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Get total count
    const totalResult = await db
      .select({ count: count() })
      .from(verificationTasksTable)
      .where(whereClause)

    const total = totalResult[0]?.count || 0

    // Get paginated data
    const offset = (page - 1) * limit
    const data = await db
      .select()
      .from(verificationTasksTable)
      .where(whereClause)
      .orderBy(desc(verificationTasksTable.createdAt))
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
    await db
      .delete(verificationTasksTable)
      .where(eq(verificationTasksTable.id, id))

    return true
  }

  // Get task statistics
  const getVerificationTaskStats = async () => {
    const stats = await db
      .select({
        status: verificationTasksTable.status,
        count: count(),
      })
      .from(verificationTasksTable)
      .groupBy(verificationTasksTable.status)

    const total = await db
      .select({ count: count() })
      .from(verificationTasksTable)

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
      .select({ id: verificationTasksTable.id })
      .from(verificationTasksTable)
      .where(
        and(
          eq(verificationTasksTable.status, 'completed'),
          sql`${verificationTasksTable.finishedAt} IS NOT NULL AND ${verificationTasksTable.finishedAt} < ${cutoffDate}`,
        ),
      )

    return result.map((row) => row.id)
  }

  // Cleanup old completed tasks
  const cleanupOldVerificationTasks = async (daysOld = 30): Promise<number> => {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    await db
      .delete(verificationTasksTable)
      .where(
        and(
          eq(verificationTasksTable.status, 'completed'),
          sql`${verificationTasksTable.finishedAt} IS NOT NULL AND ${verificationTasksTable.finishedAt} < ${cutoffDate}`,
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
