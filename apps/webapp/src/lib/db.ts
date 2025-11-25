'use server'

import {
  alias,
  and,
  appsTable,
  createDbConnection,
  desc,
  eq,
  or,
  profilesTable,
  sql,
  type Task,
  type VerificationFlags,
  verificationTasksTable,
} from '@phala/trust-center-db'

import {env} from '@/env'
import {
  FEATURED_BUILDERS,
  FEATURED_BUILDERS_MAP,
  isStaticBuilder,
  isWorkspaceBuilder,
} from './featured-builders'

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
  domain: string
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
  // If avatarUrl starts with '/', it's a local path (e.g., /logos/...), use directly
  // Otherwise, it's from database, add AVATAR_BASE_URL prefix
  const fullAvatarUrl = avatarUrl
    ? avatarUrl.startsWith('/')
      ? avatarUrl
      : `${AVATAR_BASE_URL}/${avatarUrl}`
    : null

  return {
    displayName: profile.displayName,
    avatarUrl,
    fullAvatarUrl,
    description: profile.description || undefined,
    customDomain: profile.customDomain || undefined,
  }
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

  // New logic: If app has customUser, check featured builders first
  // customUser is now already slugified from the server
  let finalAppProfile = appProfile
  let finalWorkspaceProfile = workspaceProfile

  if (appData.customUser) {
    const featuredBuilder = FEATURED_BUILDERS_MAP.get(appData.customUser)

    if (featuredBuilder) {
      if (isWorkspaceBuilder(featuredBuilder)) {
        // Workspace builder: use database workspace profile if it matches the workspaceId
        if (
          workspaceProfile &&
          appData.workspaceId === featuredBuilder.workspaceId
        ) {
          finalWorkspaceProfile = workspaceProfile
        }
      } else if (isStaticBuilder(featuredBuilder)) {
        // Static builder: create virtual workspace profile with hardcoded data
        finalWorkspaceProfile = {
          id: '0',
          entityType: 'workspace',
          entityId: 0,
          displayName: featuredBuilder.displayName,
          avatarUrl: featuredBuilder.logoUrl,
          description: null,
          customDomain: null,
          createdAt: new Date(),
          updatedAt: null,
        }
      }
    }
  }

  // Avatar priority: app → workspace → user (for app profile override)
  const avatarUrl =
    appProfile?.avatarUrl ||
    finalWorkspaceProfile?.avatarUrl ||
    userProfile?.avatarUrl ||
    null

  // Build App object
  const app: App = {
    id: appData.id,
    profileId: appData.profileId,
    appName: appData.appName,
    appConfigType: appData.appConfigType as 'redpill' | 'phala_cloud',
    contractAddress: appData.contractAddress,
    domain: appData.domain,
    dstackVersion: appData.dstackVersion,
    workspaceId: appData.workspaceId,
    creatorId: appData.creatorId,
    isPublic: appData.isPublic,
    deleted: appData.deleted,
    customUser: appData.customUser,
    createdAt: appData.createdAt.toISOString(),
    updatedAt: appData.updatedAt?.toISOString() ?? null,
    lastSyncedAt: appData.lastSyncedAt?.toISOString() ?? null,
    profile: buildProfileDisplay(finalAppProfile, avatarUrl),
    workspaceProfile: buildProfileDisplay(finalWorkspaceProfile),
    userProfile: buildProfileDisplay(userProfile),
  }

  // Build Task object
  const task: TaskWithCounts = {
    id: taskData.id,
    appId: taskData.appId,
    appName: appData.appName,
    appConfigType: appData.appConfigType as 'redpill' | 'phala_cloud',
    contractAddress: appData.contractAddress,
    domain: appData.domain,
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

// Paginated response type
export interface PaginatedApps {
  apps: AppWithTask[]
  total: number
  page: number
  perPage: number
  hasMore: boolean
}

// Get all unique apps (latest task per app)
export async function getApps(params?: {
  keyword?: string
  appConfigType?: string
  dstackVersions?: string[]
  username?: string // Filter by username (for user pages)
  sortBy?: 'appName' | 'taskCount' | 'lastCreated'
  sortOrder?: 'asc' | 'desc'
  page?: number
  perPage?: number
}): Promise<PaginatedApps> {
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

  // Add keyword filter if specified - only match app name and app id
  if (params?.keyword) {
    appConditions.push(
      or(
        sql`${appsTable.appName} ILIKE ${`%${params.keyword}%`}`,
        sql`${appsTable.id} ILIKE ${`%${params.keyword}%`}`,
      )!,
    )
  }

  // Add username filter if provided - match by customUser or workspaceId based on featured builder type
  if (params?.username) {
    const builder = FEATURED_BUILDERS_MAP.get(params.username)
    if (!builder)
      return {
        apps: [],
        total: 0,
        page: params?.page ?? 1,
        perPage: params?.perPage ?? 24,
        hasMore: false,
      }

    if (isStaticBuilder(builder)) {
      // Static builder: match by customUser
      appConditions.push(eq(appsTable.customUser, builder.slug))
    } else if (isWorkspaceBuilder(builder)) {
      // Workspace builder: match by workspaceId
      appConditions.push(eq(appsTable.workspaceId, builder.workspaceId))
    }
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

  // Pagination parameters
  const page = params?.page ?? 1
  const perPage = params?.perPage ?? 24
  const offset = (page - 1) * perPage

  // First, get total count for pagination metadata
  const countResult = await db
    .with(latestTasks)
    .select({
      count: sql<number>`count(distinct ${appsTable.id})`.as('count'),
    })
    .from(appsTable)
    .innerJoin(latestTasks, eq(appsTable.id, latestTasks.appId))
    .where(appConditions.length > 0 ? and(...appConditions) : undefined)

  const total = countResult[0]?.count || 0

  // If no results, return empty
  if (total === 0) {
    return {
      apps: [],
      total: 0,
      page,
      perPage,
      hasMore: false,
    }
  }

  // Then fetch paginated results with SQL LIMIT and OFFSET
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
      ...(() => {
        // On homepage (no username filter): prioritize featured builders, then by profile presence
        // On user pages (with username filter): sort by user's chosen sortBy parameter
        if (!params?.username) {
          // Homepage sorting: featured builders first, then by profile, then by time
          return [
            sql`CASE
              WHEN ${appsTable.customUser} IS NOT NULL THEN 0
              WHEN ${workspaceProfileTable.displayName} IS NOT NULL THEN 1
              WHEN ${appProfileTable.displayName} IS NOT NULL THEN 2
              WHEN ${userProfileTable.displayName} IS NOT NULL THEN 3
              ELSE 4
            END`,
            desc(verificationTasksTable.createdAt),
            appsTable.id,
          ]
        } else {
          // User page sorting: respect sortBy parameter
          const sortBy = params?.sortBy || 'appName'
          const sortOrder = params?.sortOrder || 'asc'

          const primarySort = (() => {
            switch (sortBy) {
              case 'appName':
                // Sort by app name (case-insensitive)
                return sortOrder === 'asc'
                  ? sql`lower(${appsTable.appName})`
                  : desc(sql`lower(${appsTable.appName})`)
              case 'taskCount':
                // Note: taskCount sorting would require a subquery to count tasks per app
                // For now, fall back to created date
                return sortOrder === 'asc'
                  ? verificationTasksTable.createdAt
                  : desc(verificationTasksTable.createdAt)
              case 'lastCreated':
                // Sort by task creation date
                return sortOrder === 'asc'
                  ? verificationTasksTable.createdAt
                  : desc(verificationTasksTable.createdAt)
              default:
                return desc(verificationTasksTable.createdAt)
            }
          })()

          return [primarySort, appsTable.id]
        }
      })(),
    )
    .limit(perPage)
    .offset(offset)

  // Convert to AppWithTask
  const apps = results.map(resultToAppWithTask)
  const hasMore = offset + apps.length < total

  return {
    apps,
    total,
    page,
    perPage,
    hasMore,
  }
}

// Get all unique dstack versions from latest completed tasks (apps) with app counts
export async function getDstackVersions(params?: {
  keyword?: string
  username?: string // Filter by username (for user pages)
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

  // Build where conditions
  const conditions = [
    eq(appsTable.isPublic, true),
    eq(appsTable.deleted, false),
    sql`${appsTable.dstackVersion} IS NOT NULL`,
  ]

  // Add keyword filter if provided - only match app name and app id
  if (params?.keyword) {
    conditions.push(
      or(
        sql`${appsTable.appName} ILIKE ${`%${params.keyword}%`}`,
        sql`${appsTable.id} ILIKE ${`%${params.keyword}%`}`,
      )!,
    )
  }

  // Add username filter if provided - match by customUser or workspaceId based on featured builder type
  if (params?.username) {
    const builder = FEATURED_BUILDERS_MAP.get(params.username)
    if (!builder) return []

    if (isStaticBuilder(builder)) {
      // Static builder: match by customUser
      conditions.push(eq(appsTable.customUser, builder.slug))
    } else if (isWorkspaceBuilder(builder)) {
      // Workspace builder: match by workspaceId
      conditions.push(eq(appsTable.workspaceId, builder.workspaceId))
    }
  }

  // Start from apps table, JOIN to latest tasks and profiles, count per version
  const query = db
    .with(latestTasks)
    .select({
      version: appsTable.dstackVersion,
      count: sql<number>`count(distinct ${appsTable.id})`.as('count'),
    })
    .from(appsTable)
    .innerJoin(latestTasks, eq(appsTable.id, latestTasks.appId))
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
    .where(and(...conditions))
    .groupBy(appsTable.dstackVersion)
    .orderBy(appsTable.dstackVersion)

  const results = await query

  return results.map((row) => ({
    version: row.version!,
    count: row.count,
  }))
}

// Get featured builders with their app counts
// Returns only featured builders (from FEATURED_BUILDERS list)
export async function getUsers(): Promise<
  Array<{
    user: string
    displayName: string
    count: number
    avatarUrl: string | null
  }>
> {
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

  // Collect all customUser slugs and workspaceIds from featured builders
  const staticBuilderSlugs = FEATURED_BUILDERS.filter(isStaticBuilder).map(
    (b) => b.slug,
  )

  const workspaceBuilderIds = FEATURED_BUILDERS.filter(isWorkspaceBuilder).map(
    (b) => b.workspaceId,
  )

  // Separate queries for static and workspace builders to avoid grouping issues
  // Static builders: count apps by customUser
  const staticBuilderCounts =
    staticBuilderSlugs.length > 0
      ? await db
          .with(latestTasks)
          .select({
            customUser: appsTable.customUser,
            count: sql<number>`count(distinct ${appsTable.id})`.as('count'),
          })
          .from(appsTable)
          .innerJoin(latestTasks, eq(appsTable.id, latestTasks.appId))
          .where(
            and(
              eq(appsTable.isPublic, true),
              eq(appsTable.deleted, false),
              sql`${appsTable.customUser} IN (${sql.join(
                staticBuilderSlugs.map((slug) => sql`${slug}`),
                sql`, `,
              )})`,
            ),
          )
          .groupBy(appsTable.customUser)
      : []

  // Workspace builders: count apps by workspaceId
  const workspaceBuilderCounts =
    workspaceBuilderIds.length > 0
      ? await db
          .with(latestTasks)
          .select({
            workspaceId: appsTable.workspaceId,
            count: sql<number>`count(distinct ${appsTable.id})`.as('count'),
          })
          .from(appsTable)
          .innerJoin(latestTasks, eq(appsTable.id, latestTasks.appId))
          .where(
            and(
              eq(appsTable.isPublic, true),
              eq(appsTable.deleted, false),
              sql`${appsTable.workspaceId} IN (${sql.join(
                workspaceBuilderIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
            ),
          )
          .groupBy(appsTable.workspaceId)
      : []

  // Create lookup maps for fast access
  const customUserCountMap = new Map<string, number>()
  const workspaceIdCountMap = new Map<number, number>()

  // Populate static builder counts
  for (const row of staticBuilderCounts) {
    if (row.customUser) {
      customUserCountMap.set(row.customUser, row.count)
    }
  }

  // Populate workspace builder counts
  for (const row of workspaceBuilderCounts) {
    workspaceIdCountMap.set(row.workspaceId, row.count)
  }

  // Fetch all workspace profiles in one query
  const workspaceProfiles =
    workspaceBuilderIds.length > 0
      ? await db
          .select({
            entityId: profilesTable.entityId,
            displayName: profilesTable.displayName,
            avatarUrl: profilesTable.avatarUrl,
          })
          .from(profilesTable)
          .where(
            and(
              eq(profilesTable.entityType, 'workspace'),
              sql`${profilesTable.entityId} IN (${sql.join(
                workspaceBuilderIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
            ),
          )
      : []

  // Create lookup map for workspace profiles
  const workspaceProfileMap = new Map<
    number,
    {displayName: string; avatarUrl: string | null}
  >()
  for (const profile of workspaceProfiles) {
    if (profile.displayName) {
      workspaceProfileMap.set(profile.entityId, {
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      })
    }
  }

  // Build result array based on featured builders order
  const owners: Array<{
    user: string
    displayName: string
    count: number
    avatarUrl: string | null
  }> = []

  for (const builder of FEATURED_BUILDERS) {
    let displayName: string
    let avatarUrl: string | null
    let appCount: number

    if (isStaticBuilder(builder)) {
      // Static builder: use hardcoded data and lookup count
      displayName = builder.displayName
      avatarUrl = builder.logoUrl
      appCount = customUserCountMap.get(builder.slug) || 0
    } else if (isWorkspaceBuilder(builder)) {
      // Workspace builder: lookup profile and count
      const profile = workspaceProfileMap.get(builder.workspaceId)
      if (!profile || !profile.displayName) {
        continue // Skip if workspace profile not found
      }

      displayName = profile.displayName
      const rawAvatarUrl = profile.avatarUrl
      avatarUrl = rawAvatarUrl
        ? rawAvatarUrl.startsWith('/')
          ? rawAvatarUrl
          : `${AVATAR_BASE_URL}/${rawAvatarUrl}`
        : null
      appCount = workspaceIdCountMap.get(builder.workspaceId) || 0
    } else {
      continue // Exhaustive check - should never happen
    }

    // Only include if has apps
    if (appCount > 0) {
      owners.push({
        user: builder.slug,
        displayName,
        count: appCount,
        avatarUrl,
      })
    }
  }

  return owners
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

  // Start from apps table, JOIN to latest completed task and profiles
  const results = await db
    .select(profileSelection)
    .from(appsTable)
    .innerJoin(
      verificationTasksTable,
      and(
        eq(verificationTasksTable.appId, appsTable.id),
        eq(verificationTasksTable.status, 'completed'), // Only completed tasks
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
