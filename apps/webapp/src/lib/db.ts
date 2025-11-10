'use server'

import {
  alias,
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

// Unified profile display type used for all entity types (app, workspace, user)
export interface ProfileDisplay {
  displayName: string | null
  avatarUrl: string | null
  fullAvatarUrl: string | null
  description?: string
  customDomain?: string // Only used for app profiles
}

// Extended Task with profile information for frontend
export interface AppTask extends Task {
  dataObjectsCount?: number
  profile?: ProfileDisplay | null
  workspaceProfile?: ProfileDisplay | null
  userProfile?: ProfileDisplay | null
}

// Common filter parameters
interface BaseFilterParams {
  keyword?: string
  includeDateFilter?: boolean // If false, no date restriction
}

// Build base where conditions for public completed tasks (without keyword search)
// By default includes 2-day filter for app list, but can be disabled for detail pages
// Note: keyword and owner filtering are done after JOIN to enable profile displayName matching
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

  return conditions
}

// Create aliases for the three profile tables using Drizzle's alias()
const appProfileTable = alias(profilesTable, 'app_profile')
const workspaceProfileTable = alias(profilesTable, 'workspace_profile')
const userProfileTable = alias(profilesTable, 'user_profile')

// Helper: Profile selection object with JOINs for all profiles
const profileSelection = {
  task: verificationTasksTable,
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

// Helper: Resolve owner from AppTask (priority: workspace > user > legacy)
function resolveOwner(task: AppTask): string | null {
  return (
    task.workspaceProfile?.displayName ||
    task.userProfile?.displayName ||
    task.user ||
    null
  )
}

// Helper: Convert database task to Task object (for frontend display)
function taskToPublic(
  task: typeof verificationTasksTable.$inferSelect,
): Task {
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
    isPublic: task.isPublic,
  }
}

// Helper: Convert query result to AppTask with profile data
function resultToAppTask(result: {
  task: typeof verificationTasksTable.$inferSelect
  appProfile: typeof profilesTable.$inferSelect | null
  workspaceProfile: typeof profilesTable.$inferSelect | null
  userProfile: typeof profilesTable.$inferSelect | null
}): AppTask {
  const task = result.task
  const appProfile = result.appProfile
  const workspaceProfile = result.workspaceProfile
  const userProfile = result.userProfile

  // Avatar priority: app → workspace → user (for app profile override)
  const avatarUrl =
    appProfile?.avatarUrl ||
    workspaceProfile?.avatarUrl ||
    userProfile?.avatarUrl ||
    null

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
    // Use helper to build profiles with avatar priority
    profile: buildProfileDisplay(appProfile, avatarUrl),
    workspaceProfile: buildProfileDisplay(workspaceProfile),
    userProfile: buildProfileDisplay(userProfile),
  }
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
}): Promise<AppTask[]> {
  // Build base conditions WITHOUT isPublic filter
  // We need to find the latest task for each app first, THEN filter by isPublic
  const twoDaysAgo = subDays(new Date(), 2)
  const baseConditions = [
    eq(verificationTasksTable.status, 'completed'),
    gte(verificationTasksTable.createdAt, twoDaysAgo),
  ]

  if (params?.dstackVersions && params.dstackVersions.length > 0) {
    baseConditions.push(
      sql`${verificationTasksTable.dstackVersion} IN (${sql.join(
        params.dstackVersions.map((v) => sql`${v}`),
        sql`, `,
      )})`,
    )
  }

  // Get latest task for each unique appId (regardless of isPublic status)
  const latestTasks = db.$with('latest_tasks').as(
    db
      .select({
        appId: verificationTasksTable.appId,
        maxCreatedAt: sql<string>`max(${verificationTasksTable.createdAt})`.as(
          'maxCreatedAt',
        ),
      })
      .from(verificationTasksTable)
      .where(baseConditions.length > 0 ? and(...baseConditions) : undefined)
      .groupBy(verificationTasksTable.appId),
  )

  // Join with all three profile tables and filter by isPublic at query level
  const results = await db
    .with(latestTasks)
    .select(profileSelection)
    .from(verificationTasksTable)
    .innerJoin(
      latestTasks,
      and(
        eq(verificationTasksTable.appId, latestTasks.appId),
        eq(verificationTasksTable.createdAt, latestTasks.maxCreatedAt),
      ),
    )
    .leftJoin(
      appProfileTable,
      and(
        eq(appProfileTable.entityType, 'app'),
        eq(appProfileTable.entityId, verificationTasksTable.appProfileId),
      ),
    )
    .leftJoin(
      workspaceProfileTable,
      and(
        eq(workspaceProfileTable.entityType, 'workspace'),
        eq(workspaceProfileTable.entityId, verificationTasksTable.workspaceId),
      ),
    )
    .leftJoin(
      userProfileTable,
      and(
        eq(userProfileTable.entityType, 'user'),
        eq(userProfileTable.entityId, verificationTasksTable.creatorId),
      ),
    )
    .where(
      // IMPORTANT: Filter by isPublic=true AFTER getting latest tasks
      // This ensures we use the latest task to determine public status
      eq(verificationTasksTable.isPublic, true),
    )
    .orderBy(
      // Sort apps with user/owner first, then by creation time descending
      sql`CASE WHEN ${verificationTasksTable.user} IS NULL THEN 1 ELSE 0 END`,
      desc(verificationTasksTable.createdAt),
    )

  // Convert to AppTask and apply post-JOIN filters
  const appTasks = results.map(resultToAppTask)
  let filteredTasks = appTasks

  // Apply owner filter after JOIN (so we can match workspace/user displayNames)
  if (params?.users && params.users.length > 0) {
    filteredTasks = filteredTasks.filter((task) => {
      const owner = resolveOwner(task)
      return owner && params.users!.includes(owner)
    })
  }

  // Apply keyword filter after JOIN (so we can match profile displayNames)
  if (params?.keyword) {
    const keyword = params.keyword.toLowerCase()
    filteredTasks = filteredTasks.filter(
      (task) =>
        task.appName.toLowerCase().includes(keyword) ||
        task.appId.toLowerCase().includes(keyword) ||
        task.profile?.displayName?.toLowerCase().includes(keyword),
    )
  }

  return filteredTasks
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
// Get all owners (including user field and profiles with displayName)
// Returns unique owners from both legacy user field and new profile system
export async function getUsers(params?: {
  keyword?: string
}): Promise<Array<{user: string; count: number}>> {
  // Build base where conditions (status, isPublic, time filter, keyword)
  const whereConditions = buildBaseWhereConditions(params)

  // Get latest task for each unique appId with profile information
  const latestTasks = db.$with('latest_tasks').as(
    db
      .select({
        appId: verificationTasksTable.appId,
        user: verificationTasksTable.user,
        workspaceId: verificationTasksTable.workspaceId,
        creatorId: verificationTasksTable.creatorId,
        maxCreatedAt: sql<string>`max(${verificationTasksTable.createdAt})`.as(
          'maxCreatedAt',
        ),
      })
      .from(verificationTasksTable)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(
        verificationTasksTable.appId,
        verificationTasksTable.user,
        verificationTasksTable.workspaceId,
        verificationTasksTable.creatorId,
      ),
  )

  // Join with workspace and user profiles to get displayNames
  const results = await db
    .with(latestTasks)
    .select({
      legacyUser: latestTasks.user,
      workspaceDisplayName: workspaceProfileTable.displayName,
      userDisplayName: userProfileTable.displayName,
      appId: latestTasks.appId,
    })
    .from(latestTasks)
    .leftJoin(
      workspaceProfileTable,
      and(
        eq(workspaceProfileTable.entityType, 'workspace'),
        eq(workspaceProfileTable.entityId, latestTasks.workspaceId),
      ),
    )
    .leftJoin(
      userProfileTable,
      and(
        eq(userProfileTable.entityType, 'user'),
        eq(userProfileTable.entityId, latestTasks.creatorId),
      ),
    )

  // Aggregate owners: priority is workspaceDisplayName > userDisplayName > legacyUser
  const ownerMap = new Map<string, Set<string>>()

  for (const row of results) {
    const owner =
      row.workspaceDisplayName || row.userDisplayName || row.legacyUser
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
): Promise<AppTask | null> {
  const whereConditions = [eq(verificationTasksTable.appId, appId)]

  // Add public check if required
  if (checkPublic) {
    whereConditions.push(eq(verificationTasksTable.isPublic, true))
  }

  const results = await db
    .select(profileSelection)
    .from(verificationTasksTable)
    .leftJoin(
      appProfileTable,
      and(
        eq(appProfileTable.entityType, 'app'),
        eq(appProfileTable.entityId, verificationTasksTable.appProfileId),
      ),
    )
    .leftJoin(
      workspaceProfileTable,
      and(
        eq(workspaceProfileTable.entityType, 'workspace'),
        eq(workspaceProfileTable.entityId, verificationTasksTable.workspaceId),
      ),
    )
    .leftJoin(
      userProfileTable,
      and(
        eq(userProfileTable.entityType, 'user'),
        eq(userProfileTable.entityId, verificationTasksTable.creatorId),
      ),
    )
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .orderBy(desc(verificationTasksTable.createdAt))
    .limit(1)

  const result = results[0]
  if (!result) {
    return null
  }

  return resultToAppTask(result)
}

// Get all tasks for a specific app
export async function getAppTasks(appId: string): Promise<Task[]> {
  const results = await db
    .select()
    .from(verificationTasksTable)
    .where(eq(verificationTasksTable.appId, appId))
    .orderBy(desc(verificationTasksTable.createdAt))

  return results.map(taskToPublic)
}

// Get task by ID with profile information
export async function getTaskById(taskId: string): Promise<AppTask | null> {
  const results = await db
    .select(profileSelection)
    .from(verificationTasksTable)
    .leftJoin(
      appProfileTable,
      and(
        eq(appProfileTable.entityType, 'app'),
        eq(appProfileTable.entityId, verificationTasksTable.appProfileId),
      ),
    )
    .leftJoin(
      workspaceProfileTable,
      and(
        eq(workspaceProfileTable.entityType, 'workspace'),
        eq(workspaceProfileTable.entityId, verificationTasksTable.workspaceId),
      ),
    )
    .leftJoin(
      userProfileTable,
      and(
        eq(userProfileTable.entityType, 'user'),
        eq(userProfileTable.entityId, verificationTasksTable.creatorId),
      ),
    )
    .where(eq(verificationTasksTable.id, taskId))
    .limit(1)

  const result = results[0]
  return result ? resultToAppTask(result) : null
}

// Get task by app and task ID
// Note: No isPublic check - allows direct access via URL even if not listed publicly
export async function getTask(
  appId: string,
  taskId: string,
): Promise<AppTask | null> {
  const results = await db
    .select(profileSelection)
    .from(verificationTasksTable)
    .leftJoin(
      appProfileTable,
      and(
        eq(appProfileTable.entityType, 'app'),
        eq(appProfileTable.entityId, verificationTasksTable.appProfileId),
      ),
    )
    .leftJoin(
      workspaceProfileTable,
      and(
        eq(workspaceProfileTable.entityType, 'workspace'),
        eq(workspaceProfileTable.entityId, verificationTasksTable.workspaceId),
      ),
    )
    .leftJoin(
      userProfileTable,
      and(
        eq(userProfileTable.entityType, 'user'),
        eq(userProfileTable.entityId, verificationTasksTable.creatorId),
      ),
    )
    .where(
      and(
        eq(verificationTasksTable.id, taskId),
        eq(verificationTasksTable.appId, appId),
      ),
    )
    .limit(1)

  const result = results[0]
  return result ? resultToAppTask(result) : null
}

// Re-export unified profile type for backward compatibility
export type AppProfile = ProfileDisplay
export type WorkspaceProfile = ProfileDisplay
export type UserProfile = ProfileDisplay
