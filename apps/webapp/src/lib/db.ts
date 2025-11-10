'use server'

import {
  and,
  createDbConnection,
  desc,
  eq,
  gte,
  profilesTable,
  sql,
  type Task,
  type VerificationFlags,
  verificationTasksTable,
} from '@phala/trust-center-db'
import {subDays} from 'date-fns'

import {env} from '@/env'

// Create database connection
const db = createDbConnection(env.DATABASE_POSTGRES_URL)

// Avatar base URL for Phala Cloud R2
const AVATAR_BASE_URL = 'https://cloud-r2.phala.com'

export interface App {
  id: string
  appId: string
  appName: string
  appConfigType: 'redpill' | 'phala_cloud'
  contractAddress: string
  modelOrDomain: string
  verificationFlags: VerificationFlags | null
  status: string
  errorMessage?: string
  s3Filename?: string
  s3Key?: string
  s3Bucket?: string
  createdAt: string
  startedAt?: string
  finishedAt?: string
  user?: string
  dstackVersion?: string
  dataObjectsCount?: number
  dataObjects?: string[]
  isPublic: boolean
  profile?: AppProfile | null
  workspaceProfile?: WorkspaceProfile | null
}

// Common filter parameters
interface BaseFilterParams {
  keyword?: string
  includeDateFilter?: boolean // If false, no date restriction
}

// Build base where conditions for public completed tasks
// By default includes 2-day filter for app list, but can be disabled for detail pages
function buildBaseWhereConditions(params?: BaseFilterParams) {
  const conditions = [
    eq(verificationTasksTable.status, 'completed'),
    eq(verificationTasksTable.isPublic, true),
  ]

  // Only add date filter if explicitly requested (default true for backwards compatibility)
  if (params?.includeDateFilter !== false) {
    const twoDaysAgo = subDays(new Date(), 2)
    conditions.push(gte(verificationTasksTable.createdAt, twoDaysAgo))
  }

  if (params?.keyword) {
    conditions.push(
      sql`(${verificationTasksTable.appName} ILIKE ${`%${params.keyword}%`} OR ${verificationTasksTable.appId} ILIKE ${`%${params.keyword}%`})`,
    )
  }

  return conditions
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
  // Build base where conditions (status, isPublic, time filter, keyword)
  const whereConditions = buildBaseWhereConditions(params)

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

  // Join with profiles tables for app, workspace, and user avatars
  const results = await db
    .with(latestTasks)
    .select({
      task: verificationTasksTable,
      appProfile: profilesTable,
      workspaceProfile: sql<{
        display_name: string | null
        avatar_url: string | null
      }>`(SELECT display_name, avatar_url FROM ${profilesTable} WHERE entity_type = 'workspace' AND entity_id = ${verificationTasksTable.workspaceId} LIMIT 1)`.as(
        'workspace_profile',
      ),
      userProfile: sql<{
        avatar_url: string | null
      }>`(SELECT avatar_url FROM ${profilesTable} WHERE entity_type = 'user' AND entity_id = ${verificationTasksTable.creatorId} LIMIT 1)`.as(
        'user_profile',
      ),
    })
    .from(verificationTasksTable)
    .innerJoin(
      latestTasks,
      and(
        eq(verificationTasksTable.appId, latestTasks.appId),
        eq(verificationTasksTable.createdAt, latestTasks.maxCreatedAt),
      ),
    )
    .leftJoin(
      profilesTable,
      and(
        eq(profilesTable.entityType, 'app'),
        eq(profilesTable.entityId, verificationTasksTable.appProfileId),
      ),
    )
    .orderBy(
      // Sort apps with user/owner first, then by creation time descending
      sql`CASE WHEN ${verificationTasksTable.user} IS NULL THEN 1 ELSE 0 END`,
      desc(verificationTasksTable.createdAt),
    )

  // Map results to App objects with profiles
  const apps = results.map((r) => {
    const task = r.task
    const appProfile = r.appProfile
    const workspaceProfile = r.workspaceProfile as unknown as {
      display_name: string | null
      avatar_url: string | null
    } | null
    const userProfile = r.userProfile as unknown as {
      avatar_url: string | null
    } | null

    // Avatar priority: app → workspace → user
    let avatarUrl: string | null = null
    if (appProfile?.avatarUrl) {
      avatarUrl = appProfile.avatarUrl
    } else if (workspaceProfile?.avatar_url) {
      avatarUrl = workspaceProfile.avatar_url
    } else if (userProfile?.avatar_url) {
      avatarUrl = userProfile.avatar_url
    }

    const fullAvatarUrl = avatarUrl ? `${AVATAR_BASE_URL}/${avatarUrl}` : null

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
      dataObjectsCount: Array.isArray(task.dataObjects)
        ? task.dataObjects.length
        : 0,
      dataObjects: Array.isArray(task.dataObjects)
        ? (task.dataObjects as string[])
        : undefined,
      isPublic: task.isPublic,
      profile: appProfile
        ? {
            displayName: appProfile.displayName,
            avatarUrl,
            fullAvatarUrl,
            description: appProfile.description || undefined,
            customDomain: appProfile.customDomain || undefined,
          }
        : null,
      workspaceProfile: workspaceProfile?.display_name
        ? {
            displayName: workspaceProfile.display_name,
            avatarUrl: workspaceProfile.avatar_url,
            fullAvatarUrl: workspaceProfile.avatar_url
              ? `${AVATAR_BASE_URL}/${workspaceProfile.avatar_url}`
              : null,
          }
        : null,
    }
  })

  return apps
}

// Get all unique dstack versions from latest completed tasks (apps) with app counts
export async function getDstackVersions(params?: {
  keyword?: string
}): Promise<Array<{version: string; count: number}>> {
  // Build base where conditions (status, isPublic, time filter, keyword)
  const whereConditions = buildBaseWhereConditions(params)

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
  // Build base where conditions (status, isPublic, time filter, keyword)
  const whereConditions = buildBaseWhereConditions(params)

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
    .select({
      task: verificationTasksTable,
      appProfile: profilesTable,
      workspaceProfile: sql<{
        display_name: string | null
        avatar_url: string | null
      }>`(SELECT display_name, avatar_url FROM ${profilesTable} WHERE entity_type = 'workspace' AND entity_id = ${verificationTasksTable.workspaceId} LIMIT 1)`.as(
        'workspace_profile',
      ),
      userProfile: sql<{
        avatar_url: string | null
      }>`(SELECT avatar_url FROM ${profilesTable} WHERE entity_type = 'user' AND entity_id = ${verificationTasksTable.creatorId} LIMIT 1)`.as(
        'user_profile',
      ),
    })
    .from(verificationTasksTable)
    .leftJoin(
      profilesTable,
      and(
        eq(profilesTable.entityType, 'app'),
        eq(profilesTable.entityId, verificationTasksTable.appProfileId),
      ),
    )
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .orderBy(desc(verificationTasksTable.createdAt))
    .limit(1)

  const result = results[0]
  if (!result) {
    return null
  }

  const task = result.task
  const appProfile = result.appProfile
  const workspaceProfile = result.workspaceProfile as unknown as {
    display_name: string | null
    avatar_url: string | null
  } | null
  const userProfile = result.userProfile as unknown as {
    avatar_url: string | null
  } | null

  // Avatar priority: app → workspace → user
  let avatarUrl: string | null = null
  if (appProfile?.avatarUrl) {
    avatarUrl = appProfile.avatarUrl
  } else if (workspaceProfile?.avatar_url) {
    avatarUrl = workspaceProfile.avatar_url
  } else if (userProfile?.avatar_url) {
    avatarUrl = userProfile.avatar_url
  }

  const fullAvatarUrl = avatarUrl ? `${AVATAR_BASE_URL}/${avatarUrl}` : null

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
    isPublic: task.isPublic,
    profile: appProfile
      ? {
          displayName: appProfile.displayName,
          avatarUrl,
          fullAvatarUrl,
          description: appProfile.description || undefined,
          customDomain: appProfile.customDomain || undefined,
        }
      : null,
    workspaceProfile: workspaceProfile?.display_name
      ? {
          displayName: workspaceProfile.display_name,
          avatarUrl: workspaceProfile.avatar_url,
          fullAvatarUrl: workspaceProfile.avatar_url
            ? `${AVATAR_BASE_URL}/${workspaceProfile.avatar_url}`
            : null,
        }
      : null,
  }
}

// Get all tasks for a specific app
export async function getAppTasks(
  appId: string,
  _params?: {
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
    appProfileId: null, // Internal ID, not exposed to frontend
    workspaceId: null, // Internal ID, not exposed to frontend
    creatorId: null, // Internal ID, not exposed to frontend
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
    isPublic: task.isPublic,
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
    appProfileId: null, // Internal ID, not exposed to frontend
    workspaceId: null, // Internal ID, not exposed to frontend
    creatorId: null, // Internal ID, not exposed to frontend
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
    isPublic: task.isPublic,
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
    appProfileId: null, // Internal ID, not exposed to frontend
    workspaceId: null, // Internal ID, not exposed to frontend
    creatorId: null, // Internal ID, not exposed to frontend
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
    isPublic: task.isPublic,
  }
}

// Profile types for frontend
export interface AppProfile {
  displayName: string | null
  avatarUrl: string | null
  fullAvatarUrl: string | null // Full URL with CDN prefix
  description?: string
  customDomain?: string
}

export interface WorkspaceProfile {
  displayName: string | null
  avatarUrl: string | null
  fullAvatarUrl: string | null
}
