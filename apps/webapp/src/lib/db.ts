'use server'

import {
  createDbConnection,
  type Task,
  type VerificationFlags,
} from '@phala/trust-center-db'
import {verificationTasksTable} from '@phala/trust-center-db/schema'
import {and, desc, eq, sql} from 'drizzle-orm'

import {env} from '@/env'

// Create database connection
const db = createDbConnection(env.DATABASE_POSTGRES_URL)

export interface App extends Task {}

// Get all unique apps (latest task per app)
export async function getApps(params?: {
  keyword?: string
  appConfigType?: string
  sortBy?: 'appName' | 'taskCount' | 'lastCreated'
  sortOrder?: 'asc' | 'desc'
  page?: number
  perPage?: number
}): Promise<App[]> {
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
      params?.sortOrder === 'desc'
        ? desc(verificationTasksTable.appName)
        : verificationTasksTable.appName,
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
  }))
}

// Get a single app by ID (latest task for this app)
export async function getApp(appId: string): Promise<App | null> {
  const results = await db
    .select()
    .from(verificationTasksTable)
    .where(eq(verificationTasksTable.appId, appId))
    .orderBy(desc(verificationTasksTable.createdAt))
    .limit(1)

  if (results.length === 0) {
    return null
  }

  const task = results[0]
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
  }))
}

// Get task by ID
export async function getTaskById(taskId: string): Promise<Task | null> {
  const results = await db
    .select()
    .from(verificationTasksTable)
    .where(eq(verificationTasksTable.id, taskId))
    .limit(1)

  if (results.length === 0) {
    return null
  }

  const task = results[0]
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
  }
}

// Get task by app and task ID
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

  if (results.length === 0) {
    return null
  }

  const task = results[0]
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
  }
}
