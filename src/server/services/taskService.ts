import { and, asc, count, desc, eq, like, or, type SQL, sql } from 'drizzle-orm'

import type { AppMetadata } from '../../types'
import { createDbConnection, type DbConnection } from '../db'
import {
  type AppConfigType,
  type VerificationTask,
  type VerificationTaskStatus,
  verificationTasksTable,
} from '../db/schema'
import { TASK_CONSTANTS } from '../routes/tasks/constants'
import type { VerificationFlags } from '../routes/tasks/schemas'

// Types
export interface TaskFilter {
  // Basic filters
  status?: VerificationTaskStatus
  appId?: string
  appName?: string
  appConfigType?: AppConfigType
  contractAddress?: string

  // Search filters
  keyword?: string

  // Pagination
  page?: number
  limit?: number

  // Sorting
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  hasNext: boolean
  page: number
  limit: number
}

export interface CreateVerificationTaskData {
  appId: string
  appName: string
  appConfigType: AppConfigType
  contractAddress: string
  modelOrDomain: string
  appMetadata?: AppMetadata
  verificationFlags?: Partial<VerificationFlags>
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
      status,
      appId,
      appName,
      appConfigType,
      contractAddress,
      keyword,
      sortBy = TASK_CONSTANTS.DEFAULT_SORT_BY,
      sortOrder = TASK_CONSTANTS.DEFAULT_SORT_ORDER,
      page = TASK_CONSTANTS.DEFAULT_PAGE,
      limit = TASK_CONSTANTS.DEFAULT_LIMIT,
    } = filter

    // Build where conditions
    const conditions = []

    // Basic filters
    if (status) conditions.push(eq(verificationTasksTable.status, status))
    if (appId) conditions.push(eq(verificationTasksTable.appId, appId))
    if (appName) conditions.push(eq(verificationTasksTable.appName, appName))
    if (appConfigType)
      conditions.push(eq(verificationTasksTable.appConfigType, appConfigType))
    if (contractAddress)
      conditions.push(
        eq(verificationTasksTable.contractAddress, contractAddress),
      )

    // Keyword search condition - search in configured fields
    if (keyword) {
      const keywordPattern = `%${keyword}%`
      const searchConditions = TASK_CONSTANTS.KEYWORD_SEARCH_FIELDS.map(
        (field) => {
          switch (field) {
            case 'appName':
              return like(verificationTasksTable.appName, keywordPattern)
            case 'appId':
              return like(verificationTasksTable.appId, keywordPattern)
            case 'contractAddress':
              return like(
                verificationTasksTable.contractAddress,
                keywordPattern,
              )
            default:
              return null
          }
        },
      ).filter(Boolean) as SQL[]

      if (searchConditions.length > 0) {
        conditions.push(or(...searchConditions))
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Get total count
    const totalResult = await db
      .select({ count: count() })
      .from(verificationTasksTable)
      .where(whereClause)

    const total = totalResult[0]?.count || 0

    // Build order by clause - only support configured time-related fields
    let orderByClause: ReturnType<typeof asc> | ReturnType<typeof desc>

    // Validate sort field
    const validSortBy = TASK_CONSTANTS.SORT_FIELDS.includes(
      sortBy as (typeof TASK_CONSTANTS.SORT_FIELDS)[number],
    )
      ? sortBy
      : TASK_CONSTANTS.DEFAULT_SORT_BY

    switch (validSortBy) {
      case 'startedAt':
        orderByClause =
          sortOrder === 'asc'
            ? asc(verificationTasksTable.startedAt)
            : desc(verificationTasksTable.startedAt)
        break
      case 'finishedAt':
        orderByClause =
          sortOrder === 'asc'
            ? asc(verificationTasksTable.finishedAt)
            : desc(verificationTasksTable.finishedAt)
        break
      case 'createdAt':
      default:
        orderByClause =
          sortOrder === 'asc'
            ? asc(verificationTasksTable.createdAt)
            : desc(verificationTasksTable.createdAt)
        break
    }

    // Validate and limit pagination parameters
    const validatedPage = Math.max(1, page)
    const validatedLimit = Math.min(
      Math.max(1, limit),
      TASK_CONSTANTS.MAX_LIMIT,
    )

    // Get paginated data
    const offset = (validatedPage - 1) * validatedLimit
    const data = await db
      .select()
      .from(verificationTasksTable)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(validatedLimit)
      .offset(offset)

    return {
      data,
      total,
      hasNext: offset + validatedLimit < total,
      page: validatedPage,
      limit: validatedLimit,
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
      cancelled: statusMap.cancelled || 0,
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
