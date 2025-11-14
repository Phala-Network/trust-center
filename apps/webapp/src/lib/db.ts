'use server'

import {
  alias,
  and,
  appsTable,
  createDbConnection,
  desc,
  eq,
  profilesTable,
  sql,
  type Task,
  type VerificationFlags,
  verificationTasksTable,
} from '@phala/trust-center-db'

import {env} from '@/env'

// Create database connection
const db = createDbConnection(env.DATABASE_POSTGRES_URL)

// Avatar base URL for Phala Cloud R2
const AVATAR_BASE_URL = 'https://cloud-r2.phala.com'

// Whitelist of app IDs that should always be accessible regardless of isPublic flag
const WHITELISTED_APP_IDS = [
  '22b30e8e1b01d732e7dae67d7b0c2dfd67dfeb53',
  '88b5c6a7c5f2975e5851f311fba51dc995c0736f',
]

// Unified profile display type used for all entity types (app, workspace, user)
export interface ProfileDisplay {
  displayName: string | null
  avatarUrl: string | null
  fullAvatarUrl: string | null
  description?: string
  customDomain?: string // Only used for app profiles
}

// App with profile information (from apps table + profiles)
export interface App {
  // From apps table
  id: string // dstack app ID
  profileId: number
  appName: string
  appConfigType: 'redpill' | 'phala_cloud'
  contractAddress: string
  modelOrDomain: string
  dstackVersion: string | null
  workspaceId: number
  creatorId: number
  isPublic: boolean
  deleted: boolean
  customUser: string | null
  createdAt: string
  updatedAt: string | null
  lastSyncedAt: string | null

  // Profile information from profiles table (editable display info)
  profile?: ProfileDisplay | null
  workspaceProfile?: ProfileDisplay | null
  userProfile?: ProfileDisplay | null
}

// Task with verification results (from verification_tasks table)
export interface TaskWithCounts extends Task {
  dataObjectsCount?: number
}

// Combined App + Task for list views (app with its latest completed task)
export interface AppWithTask extends App {
  // Latest completed task
  task: TaskWithCounts
}

// Create aliases for the three profile tables using Drizzle's alias()
const appProfileTable = alias(profilesTable, 'app_profile')
const workspaceProfileTable = alias(profilesTable, 'workspace_profile')
const userProfileTable = alias(profilesTable, 'user_profile')

// Helper: Profile selection object with JOINs for all profiles and apps table
const profileSelection = {
  task: verificationTasksTable,
  app: appsTable,
  appProfile: appProfileTable,
  workspaceProfile: workspaceProfileTable,
  userProfile: userProfileTable,
}

// Helper: Build ProfileDisplay from profile record
function buildProfileDisplay(
  profile: typeof profilesTable.$inferSelect | null,
  overrideAvatarUrl?: string | null,
): ProfileDisplay | null {
  if (!profile) return null

  const avatarUrl = overrideAvatarUrl ?? profile.avatarUrl
  return {
    displayName: profile.displayName,
    avatarUrl,
    fullAvatarUrl: avatarUrl ? `${AVATAR_BASE_URL}/${avatarUrl}` : null,
    description: profile.description || undefined,
    customDomain: profile.customDomain || undefined,
  }
}

// Helper: Resolve owner from App (priority: workspace > customUser)
function resolveOwner(app: App): string | null {
  return app.workspaceProfile?.displayName || app.customUser || null
}

// Helper: Convert query result to AppWithTask with profile data
function resultToAppWithTask(result: {
  task: typeof verificationTasksTable.$inferSelect
  app: typeof appsTable.$inferSelect
  appProfile: typeof profilesTable.$inferSelect | null
  workspaceProfile: typeof profilesTable.$inferSelect | null
  userProfile: typeof profilesTable.$inferSelect | null
}): AppWithTask {
  const taskData = result.task
  const appData = result.app
  const appProfile = result.appProfile
  const workspaceProfile = result.workspaceProfile
  const userProfile = result.userProfile

  // Avatar priority: app → workspace → user (for app profile override)
  const avatarUrl =
    appProfile?.avatarUrl ||
    workspaceProfile?.avatarUrl ||
    userProfile?.avatarUrl ||
    null

  // Build App object
  const app: App = {
    id: appData.id,
    profileId: appData.profileId,
    appName: appData.appName,
    appConfigType: appData.appConfigType as 'redpill' | 'phala_cloud',
    contractAddress: appData.contractAddress,
    modelOrDomain: appData.modelOrDomain,
    dstackVersion: appData.dstackVersion,
    workspaceId: appData.workspaceId,
    creatorId: appData.creatorId,
    isPublic: appData.isPublic,
    deleted: appData.deleted,
    customUser: appData.customUser,
    createdAt: appData.createdAt.toISOString(),
    updatedAt: appData.updatedAt?.toISOString() ?? null,
    lastSyncedAt: appData.lastSyncedAt?.toISOString() ?? null,
    profile: buildProfileDisplay(appProfile, avatarUrl),
    workspaceProfile: buildProfileDisplay(workspaceProfile),
    userProfile: buildProfileDisplay(userProfile),
  }

  // Build Task object
  const task: TaskWithCounts = {
    id: taskData.id,
    appId: taskData.appId,
    appName: appData.appName,
    appConfigType: appData.appConfigType as 'redpill' | 'phala_cloud',
    contractAddress: appData.contractAddress,
    modelOrDomain: appData.modelOrDomain,
    verificationFlags: taskData.verificationFlags as VerificationFlags | null,
    status: taskData.status,
    errorMessage: taskData.errorMessage ?? null,
    s3Filename: taskData.s3Filename ?? null,
    s3Key: taskData.s3Key ?? null,
    s3Bucket: taskData.s3Bucket ?? null,
    createdAt: taskData.createdAt.toISOString(),
    startedAt: taskData.startedAt?.toISOString() ?? null,
    finishedAt: taskData.finishedAt?.toISOString() ?? null,
    user: null,
    dstackVersion: appData.dstackVersion ?? null,
    dataObjectsCount: Array.isArray(taskData.dataObjects)
      ? taskData.dataObjects.length
      : 0,
    dataObjects: Array.isArray(taskData.dataObjects)
      ? (taskData.dataObjects as string[])
      : null,
    isPublic: appData.isPublic,
  }

  return {...app, task}
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
}): Promise<AppWithTask[]> {
  // Build base conditions for apps
  const appConditions = [
    eq(appsTable.isPublic, true),
    eq(appsTable.deleted, false),
  ]

  // Add dstackVersion filter if specified
  if (params?.dstackVersions && params.dstackVersions.length > 0) {
    appConditions.push(
      sql`${appsTable.dstackVersion} IN (${sql.join(
        params.dstackVersions.map((v) => sql`${v}`),
        sql`, `,
      )})`,
    )
  }

  // Add appConfigType filter if specified
  if (params?.appConfigType) {
    appConditions.push(
      eq(
        appsTable.appConfigType,
        params.appConfigType as 'redpill' | 'phala_cloud',
      ),
    )
  }

  // Get latest task for each app (subquery)
  const latestTasks = db.$with('latest_tasks').as(
    db
      .select({
        appId: verificationTasksTable.appId,
        maxCreatedAt: sql<string>`max(${verificationTasksTable.createdAt})`.as(
          'maxCreatedAt',
        ),
      })
      .from(verificationTasksTable)
      .where(eq(verificationTasksTable.status, 'completed'))
      .groupBy(verificationTasksTable.appId),
  )

  // Start from apps table, JOIN to latest tasks, then profiles
  const results = await db
    .with(latestTasks)
    .select(profileSelection)
    .from(appsTable)
    .innerJoin(latestTasks, eq(appsTable.id, latestTasks.appId))
    .innerJoin(
      verificationTasksTable,
      and(
        eq(verificationTasksTable.appId, latestTasks.appId),
        eq(verificationTasksTable.createdAt, latestTasks.maxCreatedAt),
      ),
    )
    .leftJoin(
      appProfileTable,
      and(
        eq(appProfileTable.entityType, 'app'),
        eq(appProfileTable.entityId, appsTable.profileId),
      ),
    )
    .leftJoin(
      workspaceProfileTable,
      and(
        eq(workspaceProfileTable.entityType, 'workspace'),
        eq(workspaceProfileTable.entityId, appsTable.workspaceId),
      ),
    )
    .leftJoin(
      userProfileTable,
      and(
        eq(userProfileTable.entityType, 'user'),
        eq(userProfileTable.entityId, appsTable.creatorId),
      ),
    )
    .where(appConditions.length > 0 ? and(...appConditions) : undefined)
    .orderBy(
      // Priority: apps with profile/custom user info first
      sql`CASE
        WHEN ${appsTable.customUser} IS NOT NULL THEN 0
        WHEN ${workspaceProfileTable.displayName} IS NOT NULL THEN 1
        WHEN ${appProfileTable.displayName} IS NOT NULL THEN 2
        WHEN ${userProfileTable.displayName} IS NOT NULL THEN 3
        ELSE 4
      END`,
      // Secondary: most recent tasks
      desc(verificationTasksTable.createdAt),
    )

  // Convert to AppWithTask and apply post-JOIN filters
  const appsWithTasks = results.map(resultToAppWithTask)
  let filteredApps = appsWithTasks

  // Apply owner filter after JOIN (so we can match workspace/user displayNames)
  if (params?.users && params.users.length > 0) {
    filteredApps = filteredApps.filter((app: AppWithTask) => {
      const owner = resolveOwner(app)
      return owner && params.users!.includes(owner)
    })
  }

  // Apply keyword filter after JOIN (so we can match profile displayNames)
  if (params?.keyword) {
    const keyword = params.keyword.toLowerCase()
    filteredApps = filteredApps.filter(
      (app: AppWithTask) =>
        app.appName.toLowerCase().includes(keyword) ||
        app.id.toLowerCase().includes(keyword) ||
        app.profile?.displayName?.toLowerCase().includes(keyword),
    )
  }

  return filteredApps
}

// Get all unique dstack versions from latest completed tasks (apps) with app counts
export async function getDstackVersions(params?: {
  keyword?: string
}): Promise<Array<{version: string; count: number}>> {
  // Get latest task for each app (subquery)
  const latestTasks = db.$with('latest_tasks').as(
    db
      .select({
        appId: verificationTasksTable.appId,
        maxCreatedAt: sql<string>`max(${verificationTasksTable.createdAt})`.as(
          'maxCreatedAt',
        ),
      })
      .from(verificationTasksTable)
      .where(eq(verificationTasksTable.status, 'completed'))
      .groupBy(verificationTasksTable.appId),
  )

  // Start from apps table, JOIN to latest tasks, count per version
  const results = await db
    .with(latestTasks)
    .select({
      version: appsTable.dstackVersion,
      count: sql<number>`count(distinct ${appsTable.id})`.as('count'),
    })
    .from(appsTable)
    .innerJoin(latestTasks, eq(appsTable.id, latestTasks.appId))
    .where(
      and(
        eq(appsTable.isPublic, true),
        eq(appsTable.deleted, false),
        sql`${appsTable.dstackVersion} IS NOT NULL`,
      ),
    )
    .groupBy(appsTable.dstackVersion)
    .orderBy(appsTable.dstackVersion)

  return results
    .map((r) => ({
      version: r.version as string,
      count: r.count,
    }))
    .filter((v): v is {version: string; count: number} => v.version !== null)
}

// Get all unique users from latest completed tasks (apps) with app counts
// Get all owners (including profiles with displayName)
// Returns unique owners from new profile system based on apps table
export async function getUsers(params?: {
  keyword?: string
}): Promise<Array<{user: string; count: number}>> {
  // Get latest task for each app (subquery)
  const latestTasks = db.$with('latest_tasks').as(
    db
      .select({
        appId: verificationTasksTable.appId,
        maxCreatedAt: sql<string>`max(${verificationTasksTable.createdAt})`.as(
          'maxCreatedAt',
        ),
      })
      .from(verificationTasksTable)
      .where(eq(verificationTasksTable.status, 'completed'))
      .groupBy(verificationTasksTable.appId),
  )

  // Start from apps table, JOIN to latest tasks and profiles
  const results = await db
    .with(latestTasks)
    .select({
      workspaceDisplayName: workspaceProfileTable.displayName,
      customUser: appsTable.customUser,
      appId: appsTable.id,
    })
    .from(appsTable)
    .innerJoin(latestTasks, eq(appsTable.id, latestTasks.appId))
    .leftJoin(
      workspaceProfileTable,
      and(
        eq(workspaceProfileTable.entityType, 'workspace'),
        eq(workspaceProfileTable.entityId, appsTable.workspaceId),
      ),
    )
    .where(and(eq(appsTable.isPublic, true), eq(appsTable.deleted, false)))

  // Aggregate owners: only workspace profiles and custom user labels
  // Priority: workspaceDisplayName > customUser
  const ownerMap = new Map<string, Set<string>>()

  for (const row of results) {
    const owner = row.workspaceDisplayName || row.customUser
    if (owner) {
      if (!ownerMap.has(owner)) {
        ownerMap.set(owner, new Set())
      }
      ownerMap.get(owner)!.add(row.appId)
    }
  }

  // Convert to array, filter out owners with no apps, and sort
  return Array.from(ownerMap.entries())
    .map(([user, appIds]) => ({
      user,
      count: appIds.size,
    }))
    .filter((owner) => owner.count > 0) // Only return owners with at least 1 app
    .sort((a, b) => a.user.localeCompare(b.user))
}

// Get a single app by ID (latest task for this app)
// checkPublic: if true, only return public apps (for app/[app-id] and embed routes)
export async function getApp(
  appId: string,
  checkPublic = false,
): Promise<AppWithTask | null> {
  // Build app conditions
  const appConditions = [eq(appsTable.id, appId)]

  // Check if app is whitelisted - if so, skip public/deleted checks
  const isWhitelisted = WHITELISTED_APP_IDS.includes(appId)

  if (checkPublic && !isWhitelisted) {
    appConditions.push(
      eq(appsTable.isPublic, true),
      eq(appsTable.deleted, false),
    )
  }

  // Start from apps table, JOIN to latest task and profiles
  const results = await db
    .select(profileSelection)
    .from(appsTable)
    .innerJoin(
      verificationTasksTable,
      eq(verificationTasksTable.appId, appsTable.id),
    )
    .leftJoin(
      appProfileTable,
      and(
        eq(appProfileTable.entityType, 'app'),
        eq(appProfileTable.entityId, appsTable.profileId),
      ),
    )
    .leftJoin(
      workspaceProfileTable,
      and(
        eq(workspaceProfileTable.entityType, 'workspace'),
        eq(workspaceProfileTable.entityId, appsTable.workspaceId),
      ),
    )
    .leftJoin(
      userProfileTable,
      and(
        eq(userProfileTable.entityType, 'user'),
        eq(userProfileTable.entityId, appsTable.creatorId),
      ),
    )
    .where(appConditions.length > 0 ? and(...appConditions) : undefined)
    .orderBy(desc(verificationTasksTable.createdAt))
    .limit(1)

  const result = results[0]
  if (!result) {
    return null
  }

  return resultToAppWithTask(result)
}

// Get all tasks for a specific app
// Get task by ID with profile information
export async function getTaskById(taskId: string): Promise<AppWithTask | null> {
  // First get the task to find its appId
  const task = await db
    .select()
    .from(verificationTasksTable)
    .where(eq(verificationTasksTable.id, taskId))
    .limit(1)

  if (!task[0] || !task[0].appId) {
    return null
  }

  // Start from apps table, JOIN to specific task and profiles
  const results = await db
    .select(profileSelection)
    .from(appsTable)
    .innerJoin(
      verificationTasksTable,
      and(
        eq(verificationTasksTable.appId, appsTable.id),
        eq(verificationTasksTable.id, taskId),
      ),
    )
    .leftJoin(
      appProfileTable,
      and(
        eq(appProfileTable.entityType, 'app'),
        eq(appProfileTable.entityId, appsTable.profileId),
      ),
    )
    .leftJoin(
      workspaceProfileTable,
      and(
        eq(workspaceProfileTable.entityType, 'workspace'),
        eq(workspaceProfileTable.entityId, appsTable.workspaceId),
      ),
    )
    .leftJoin(
      userProfileTable,
      and(
        eq(userProfileTable.entityType, 'user'),
        eq(userProfileTable.entityId, appsTable.creatorId),
      ),
    )
    .where(eq(appsTable.id, task[0].appId))
    .limit(1)

  const result = results[0]
  return result ? resultToAppWithTask(result) : null
}

// Get task by app and task ID
// Note: No isPublic check - allows direct access via URL even if not listed publicly
export async function getTask(
  appId: string,
  taskId: string,
): Promise<AppWithTask | null> {
  // Start from apps table, JOIN to specific task and profiles
  const results = await db
    .select(profileSelection)
    .from(appsTable)
    .innerJoin(
      verificationTasksTable,
      and(
        eq(verificationTasksTable.appId, appsTable.id),
        eq(verificationTasksTable.id, taskId),
      ),
    )
    .leftJoin(
      appProfileTable,
      and(
        eq(appProfileTable.entityType, 'app'),
        eq(appProfileTable.entityId, appsTable.profileId),
      ),
    )
    .leftJoin(
      workspaceProfileTable,
      and(
        eq(workspaceProfileTable.entityType, 'workspace'),
        eq(workspaceProfileTable.entityId, appsTable.workspaceId),
      ),
    )
    .leftJoin(
      userProfileTable,
      and(
        eq(userProfileTable.entityType, 'user'),
        eq(userProfileTable.entityId, appsTable.creatorId),
      ),
    )
    .where(eq(appsTable.id, appId))
    .limit(1)

  const result = results[0]
  return result ? resultToAppWithTask(result) : null
}

// Re-export unified profile type for backward compatibility
export type AppProfile = ProfileDisplay
export type WorkspaceProfile = ProfileDisplay
export type UserProfile = ProfileDisplay
