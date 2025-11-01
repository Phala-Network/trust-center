'use server'

import {
  and,
  createDbConnection,
  desc,
  eq,
  gte,
  sql,
  type Task,
  type VerificationFlags,
  verificationTasksTable,
} from '@phala/trust-center-db'
import {subDays} from 'date-fns'

import {env} from '@/env'

// Create database connection
const db = createDbConnection(env.DATABASE_POSTGRES_URL)

export interface App extends Task {
  dstackVersion?: string
  dataObjectsCount?: number
  dataObjects?: string[]
}

// Get all unique apps (latest task per app)
export async function getApps(params?: {
  keyword?: string
  appConfigType?: string
  dstackVersions?: string[]
  users?: string[]
  sortBy?: 'appName' | 'taskCount' | 'lastCreated'
  sortOrder?: 'asc' | 'desc'
  page?: number
  perPage?: number
}): Promise<App[]> {
  // Build where conditions - only show public apps from last 2 days
  const twoDaysAgo = subDays(new Date(), 2)

  const whereConditions = [
    eq(verificationTasksTable.status, 'completed'),
    eq(verificationTasksTable.isPublic, true),
    gte(verificationTasksTable.createdAt, twoDaysAgo),
  ]

  if (params?.keyword) {
    whereConditions.push(
      sql`(${verificationTasksTable.appName} ILIKE ${`%${params.keyword}%`} OR ${verificationTasksTable.appId} ILIKE ${`%${params.keyword}%`})`,
    )
  }

  if (params?.dstackVersions && params.dstackVersions.length > 0) {
    whereConditions.push(
      sql`${verificationTasksTable.dstackVersion} IN (${sql.join(
        params.dstackVersions.map((v) => sql`${v}`),
        sql`, `,
      )})`,
    )
  }

  if (params?.users && params.users.length > 0) {
    whereConditions.push(
      sql`${verificationTasksTable.user} IN (${sql.join(
        params.users.map((u) => sql`${u}`),
        sql`, `,
      )})`,
    )
  }

  // Get latest task for each unique appId
  const latestTasks = db.$with('latest_tasks').as(
    db
      .select({
        appId: verificationTasksTable.appId,
        maxCreatedAt: sql<string>`max(${verificationTasksTable.createdAt})`.as(
          'maxCreatedAt',
        ),
      })
      .from(verificationTasksTable)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(verificationTasksTable.appId),
  )

  const results = await db
    .with(latestTasks)
    .select()
    .from(verificationTasksTable)
    .innerJoin(
      latestTasks,
      and(
        eq(verificationTasksTable.appId, latestTasks.appId),
        eq(verificationTasksTable.createdAt, latestTasks.maxCreatedAt),
      ),
    )
    .orderBy(
      // Sort apps with user/owner first, then by creation time descending
      sql`CASE WHEN ${verificationTasksTable.user} IS NULL THEN 1 ELSE 0 END`,
      desc(verificationTasksTable.createdAt),
    )

  return results.map((r) => ({
    id: r.verification_tasks.id,
    appId: r.verification_tasks.appId,
    appName: r.verification_tasks.appName,
    appConfigType: r.verification_tasks.appConfigType as
      | 'redpill'
      | 'phala_cloud',
    contractAddress: r.verification_tasks.contractAddress,
    modelOrDomain: r.verification_tasks.modelOrDomain,
    verificationFlags: r.verification_tasks
      .verificationFlags as VerificationFlags | null,
    status: r.verification_tasks.status,
    errorMessage: r.verification_tasks.errorMessage || undefined,
    s3Filename: r.verification_tasks.s3Filename || undefined,
    s3Key: r.verification_tasks.s3Key || undefined,
    s3Bucket: r.verification_tasks.s3Bucket || undefined,
    createdAt: r.verification_tasks.createdAt.toISOString(),
    startedAt: r.verification_tasks.startedAt?.toISOString(),
    finishedAt: r.verification_tasks.finishedAt?.toISOString(),
    user: r.verification_tasks.user || undefined,
    dstackVersion: r.verification_tasks.dstackVersion || undefined,
    dataObjectsCount: Array.isArray(r.verification_tasks.dataObjects)
      ? r.verification_tasks.dataObjects.length
      : 0,
    dataObjects: Array.isArray(r.verification_tasks.dataObjects)
      ? (r.verification_tasks.dataObjects as string[])
      : undefined,
  }))
}

// Get all unique dstack versions from latest completed tasks (apps) with app counts
export async function getDstackVersions(params?: {
  keyword?: string
}): Promise<Array<{version: string; count: number}>> {
  // Build where conditions for completed public tasks
  const whereConditions = [
    eq(verificationTasksTable.status, 'completed'),
    eq(verificationTasksTable.isPublic, true),
  ]

  if (params?.keyword) {
    whereConditions.push(
      sql`(${verificationTasksTable.appName} ILIKE ${`%${params.keyword}%`} OR ${verificationTasksTable.appId} ILIKE ${`%${params.keyword}%`})`,
    )
  }

  // Get latest task for each unique appId
  const latestTasks = db.$with('latest_tasks').as(
    db
      .select({
        appId: verificationTasksTable.appId,
        dstackVersion: verificationTasksTable.dstackVersion,
        maxCreatedAt: sql<string>`max(${verificationTasksTable.createdAt})`.as(
          'maxCreatedAt',
        ),
      })
      .from(verificationTasksTable)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(
        verificationTasksTable.appId,
        verificationTasksTable.dstackVersion,
      ),
  )

  // Count apps per dstack version
  const results = await db
    .with(latestTasks)
    .select({
      version: latestTasks.dstackVersion,
      count: sql<number>`count(distinct ${latestTasks.appId})`.as('count'),
    })
    .from(latestTasks)
    .where(sql`${latestTasks.dstackVersion} IS NOT NULL`)
    .groupBy(latestTasks.dstackVersion)
    .orderBy(latestTasks.dstackVersion)

  return results
    .map((r) => ({
      version: r.version as string,
      count: r.count,
    }))
    .filter((v): v is {version: string; count: number} => v.version !== null)
}

// Get all unique users from latest completed tasks (apps) with app counts
export async function getUsers(params?: {
  keyword?: string
}): Promise<Array<{user: string; count: number}>> {
  // Build where conditions for completed public tasks
  const whereConditions = [
    eq(verificationTasksTable.status, 'completed'),
    eq(verificationTasksTable.isPublic, true),
  ]

  if (params?.keyword) {
    whereConditions.push(
      sql`(${verificationTasksTable.appName} ILIKE ${`%${params.keyword}%`} OR ${verificationTasksTable.appId} ILIKE ${`%${params.keyword}%`})`,
    )
  }

  // Get latest task for each unique appId
  const latestTasks = db.$with('latest_tasks').as(
    db
      .select({
        appId: verificationTasksTable.appId,
        user: verificationTasksTable.user,
        maxCreatedAt: sql<string>`max(${verificationTasksTable.createdAt})`.as(
          'maxCreatedAt',
        ),
      })
      .from(verificationTasksTable)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(verificationTasksTable.appId, verificationTasksTable.user),
  )

  // Count apps per user
  const results = await db
    .with(latestTasks)
    .select({
      user: latestTasks.user,
      count: sql<number>`count(distinct ${latestTasks.appId})`.as('count'),
    })
    .from(latestTasks)
    .where(sql`${latestTasks.user} IS NOT NULL`)
    .groupBy(latestTasks.user)
    .orderBy(latestTasks.user)

  return results
    .map((r) => ({
      user: r.user as string,
      count: r.count,
    }))
    .filter((u): u is {user: string; count: number} => u.user !== null)
}

// Get a single app by ID (latest task for this app)
// checkPublic: if true, only return public apps (for app/[app-id] and embed routes)
export async function getApp(
  appId: string,
  checkPublic = false,
): Promise<App | null> {
  const whereConditions = [eq(verificationTasksTable.appId, appId)]

  // Add public check if required
  if (checkPublic) {
    whereConditions.push(eq(verificationTasksTable.isPublic, true))
  }

  const results = await db
    .select()
    .from(verificationTasksTable)
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .orderBy(desc(verificationTasksTable.createdAt))
    .limit(1)

  const task = results[0]
  if (!task) {
    return null
  }
  return {
    id: task.id,
    appId: task.appId,
    appName: task.appName,
    appConfigType: task.appConfigType,
    contractAddress: task.contractAddress,
    modelOrDomain: task.modelOrDomain,
    verificationFlags: task.verificationFlags as VerificationFlags | null,
    status: task.status,
    errorMessage: task.errorMessage || undefined,
    s3Filename: task.s3Filename || undefined,
    s3Key: task.s3Key || undefined,
    s3Bucket: task.s3Bucket || undefined,
    createdAt: task.createdAt.toISOString(),
    startedAt: task.startedAt?.toISOString(),
    finishedAt: task.finishedAt?.toISOString(),
    user: task.user || undefined,
    dstackVersion: task.dstackVersion || undefined,
    dataObjects: Array.isArray(task.dataObjects)
      ? (task.dataObjects as string[])
      : undefined,
  }
}

// Get all tasks for a specific app
export async function getAppTasks(
  appId: string,
  params?: {
    status?: string
    page?: number
    perPage?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    createdAfter?: string
    createdBefore?: string
  },
): Promise<Task[]> {
  const results = await db
    .select()
    .from(verificationTasksTable)
    .where(eq(verificationTasksTable.appId, appId))
    .orderBy(desc(verificationTasksTable.createdAt))

  return results.map((task) => ({
    id: task.id,
    appId: task.appId,
    appName: task.appName,
    appConfigType: task.appConfigType as 'redpill' | 'phala_cloud',
    contractAddress: task.contractAddress,
    modelOrDomain: task.modelOrDomain,
    verificationFlags: task.verificationFlags as VerificationFlags | null,
    status: task.status,
    errorMessage: task.errorMessage || undefined,
    s3Filename: task.s3Filename || undefined,
    s3Key: task.s3Key || undefined,
    s3Bucket: task.s3Bucket || undefined,
    createdAt: task.createdAt.toISOString(),
    startedAt: task.startedAt?.toISOString(),
    finishedAt: task.finishedAt?.toISOString(),
    user: task.user || undefined,
    dstackVersion: task.dstackVersion || undefined,
    dataObjects: Array.isArray(task.dataObjects)
      ? (task.dataObjects as string[])
      : undefined,
  }))
}

// Get task by ID
export async function getTaskById(taskId: string): Promise<Task | null> {
  const results = await db
    .select()
    .from(verificationTasksTable)
    .where(eq(verificationTasksTable.id, taskId))
    .limit(1)

  const task = results[0]
  if (!task) {
    return null
  }
  return {
    id: task.id,
    appId: task.appId,
    appName: task.appName,
    appConfigType: task.appConfigType as 'redpill' | 'phala_cloud',
    contractAddress: task.contractAddress,
    modelOrDomain: task.modelOrDomain,
    verificationFlags: task.verificationFlags as VerificationFlags | null,
    status: task.status,
    errorMessage: task.errorMessage || undefined,
    s3Filename: task.s3Filename || undefined,
    s3Key: task.s3Key || undefined,
    s3Bucket: task.s3Bucket || undefined,
    createdAt: task.createdAt.toISOString(),
    startedAt: task.startedAt?.toISOString(),
    finishedAt: task.finishedAt?.toISOString(),
    user: task.user || undefined,
    dstackVersion: task.dstackVersion || undefined,
    dataObjects: Array.isArray(task.dataObjects)
      ? (task.dataObjects as string[])
      : undefined,
  }
}

// Get task by app and task ID
// Note: No isPublic check - allows direct access via URL even if not listed publicly
export async function getTask(
  appId: string,
  taskId: string,
): Promise<Task | null> {
  const results = await db
    .select()
    .from(verificationTasksTable)
    .where(
      and(
        eq(verificationTasksTable.id, taskId),
        eq(verificationTasksTable.appId, appId),
      ),
    )
    .limit(1)

  const task = results[0]
  if (!task) {
    return null
  }
  return {
    id: task.id,
    appId: task.appId,
    appName: task.appName,
    appConfigType: task.appConfigType as 'redpill' | 'phala_cloud',
    contractAddress: task.contractAddress,
    modelOrDomain: task.modelOrDomain,
    verificationFlags: task.verificationFlags as VerificationFlags | null,
    status: task.status,
    errorMessage: task.errorMessage || undefined,
    s3Filename: task.s3Filename || undefined,
    s3Key: task.s3Key || undefined,
    s3Bucket: task.s3Bucket || undefined,
    createdAt: task.createdAt.toISOString(),
    startedAt: task.startedAt?.toISOString(),
    finishedAt: task.finishedAt?.toISOString(),
    user: task.user || undefined,
    dstackVersion: task.dstackVersion || undefined,
    dataObjects: Array.isArray(task.dataObjects)
      ? (task.dataObjects as string[])
      : undefined,
  }
}
