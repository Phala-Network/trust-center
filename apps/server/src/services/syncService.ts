import {
  appsTable,
  eq,
  type NewAppRecord,
  type UpstreamAppData,
  UpstreamAppDataSchema,
  type UpstreamProfileData,
  UpstreamProfileDataSchema,
} from '@phala/trust-center-db'
import {z} from 'zod'

import type {AppService} from './appService'
import type {ProfileService} from './profileService'
import type {QueueService} from './queue'

// Helper function to parse version from base_image
function parseVersion(baseImage: string): {
  major: number
  minor: number
  patch: number
  build?: number
} {
  // Handle formats like "dstack-dev-0.5.3" or "dstack-0.5.4.1"
  const match = baseImage.match(/(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?$/)
  if (!match) {
    throw new Error(`Invalid version format: ${baseImage}`)
  }

  return {
    major: parseInt(match[1]!, 10),
    minor: parseInt(match[2]!, 10),
    patch: parseInt(match[3]!, 10),
    build: match[4] ? parseInt(match[4], 10) : undefined,
  }
}

// Helper function to compare versions
function isVersionGreaterOrEqual(
  baseImage: string,
  targetVersion: string,
): boolean {
  const current = parseVersion(baseImage)
  const target = parseVersion(targetVersion)

  if (current.major !== target.major) {
    return current.major > target.major
  }
  if (current.minor !== target.minor) {
    return current.minor > target.minor
  }
  if (current.patch !== target.patch) {
    return current.patch > target.patch
  }

  // If patch versions are equal, check build number
  const currentBuild = current.build ?? 0
  const targetBuild = target.build ?? 0
  return currentBuild >= targetBuild
}

// Helper function to determine custom user label based on business rules
function determineUser(app: UpstreamAppData): string | null {
  const {email, username, app_name} = app

  // Crossmint -> Name contains crossmint
  if (app_name.toLowerCase().includes('crossmint')) {
    return 'Crossmint'
  }

  // Vana -> User == volod@opendatalabs.xyz
  if (email && email === 'volod@opendatalabs.xyz') {
    return 'Vana'
  }

  // Rena Labs -> user == Renalabs (with or without trailing space)
  if (username?.trim() === 'Renalabs') {
    return 'Rena Labs'
  }

  // Blormy -> User == tint@blorm.xyz
  if (email && email === 'tint@blorm.xyz') {
    return 'blormy'
  }

  // NEAR -> User == robertyan.ai or kaku5555 or robertyan
  if (
    username === 'robertyan.ai' ||
    username === 'kaku5555' ||
    username === 'robertyan'
  ) {
    return 'NEAR'
  }

  // Sahara -> Name contains sahara
  if (app_name.toLowerCase().includes('sahara')) {
    return 'Sahara'
  }

  // Lit -> User == chris@litprotocol.com
  if (email && email === 'chris@litprotocol.com') {
    return 'Lit'
  }

  // Magic Link -> User == infra@magic.link
  if (email && email === 'infra@magic.link') {
    return 'Magic Link'
  }

  // Vijil -> User == vele-vijil
  if (username === 'vele-vijil') {
    return 'Vijil'
  }

  // Rift -> User == alpinevm
  if (username === 'alpinevm') {
    return 'Rift'
  }

  return null
}

// Helper function to convert upstream app data to app record
function convertToAppRecord(app: UpstreamAppData): NewAppRecord {
  const {
    dstack_app_id,
    app_id,
    app_name,
    base_image,
    contract_address,
    tproxy_base_domain,
    gateway_domain_suffix,
    listed,
    workspace_id,
    creator_id,
    chain_id,
    kms_contract_address,
    username,
    email,
  } = app

  let contractAddress = ''
  let modelOrDomain = ''
  const defaultContractAddress = `0x${dstack_app_id}`

  // Determine contract address based on base_image version
  if (isVersionGreaterOrEqual(base_image, '0.5.3')) {
    contractAddress = `0x${dstack_app_id}`
  } else if (isVersionGreaterOrEqual(base_image, '0.5.1')) {
    contractAddress = contract_address || ''
  }

  // Determine domain based on base_image version
  if (isVersionGreaterOrEqual(base_image, '0.5.3')) {
    modelOrDomain = gateway_domain_suffix || ''
  } else {
    modelOrDomain = tproxy_base_domain || ''
  }

  return {
    id: dstack_app_id, // dstack_app_id is now the primary key
    profileId: app_id, // app_id is now profileId
    appName: app_name,
    appConfigType: 'phala_cloud',
    contractAddress: contractAddress || defaultContractAddress,
    modelOrDomain,
    dstackVersion: base_image,
    workspaceId: workspace_id,
    creatorId: creator_id,
    chainId: chain_id,
    kmsContractAddress: kms_contract_address,
    baseImage: base_image,
    tproxyBaseDomain: tproxy_base_domain,
    gatewayDomainSuffix: gateway_domain_suffix,
    isPublic: listed,
    username: username,
    email: email,
    customUser: determineUser(app), // Apply business rules to determine custom user label
  }
}

export interface SyncServiceConfig {
  metabaseAppQuery: string
  metabaseProfileQuery: string
  metabaseApiKey: string
}

export interface SyncService {
  syncApps: () => Promise<{appsSynced: number; apps: UpstreamAppData[]}>
  syncAllTasks: () => Promise<{tasksCreated: number; apps: UpstreamAppData[]}>
  syncSelectedTasks: (
    appIds: string[],
  ) => Promise<{tasksCreated: number; apps: UpstreamAppData[]}>
  forceRefreshAllApps: () => Promise<{
    tasksCreated: number
    apps: UpstreamAppData[]
  }>
  syncProfiles: () => Promise<{
    profilesSynced: number
    profiles: UpstreamProfileData[]
  }>
  fetchApps: () => Promise<UpstreamAppData[]>
  fetchProfiles: () => Promise<UpstreamProfileData[]>
}

export function createSyncService(
  config: SyncServiceConfig,
  queueService: QueueService,
  profileService: ProfileService,
  appService: AppService,
): SyncService {
  // Fetch apps from Metabase
  const fetchApps = async (): Promise<UpstreamAppData[]> => {
    console.log('[SYNC] Fetching apps from Metabase...')

    const metabaseResponse = await fetch(config.metabaseAppQuery, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': config.metabaseApiKey,
      },
      body: JSON.stringify({}),
    })

    if (!metabaseResponse.ok) {
      throw new Error(
        `Metabase API error: ${metabaseResponse.status} ${metabaseResponse.statusText}`,
      )
    }

    const data = await metabaseResponse.json()
    const apps = z.array(UpstreamAppDataSchema).parse(data)
    return apps
  }

  // Fetch profiles from Metabase
  const fetchProfiles = async (): Promise<UpstreamProfileData[]> => {
    console.log('[SYNC] Fetching profiles from Metabase...')

    const metabaseResponse = await fetch(config.metabaseProfileQuery, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': config.metabaseApiKey,
      },
      body: JSON.stringify({}),
    })

    if (!metabaseResponse.ok) {
      throw new Error(
        `Metabase Profile API error: ${metabaseResponse.status} ${metabaseResponse.statusText}`,
      )
    }

    const data = await metabaseResponse.json()
    const profiles = z.array(UpstreamProfileDataSchema).parse(data)
    return profiles
  }

  // Sync all tasks - reads from current database apps table instead of fetching from upstream
  const syncAllTasks = async (): Promise<{
    tasksCreated: number
    apps: UpstreamAppData[]
  }> => {
    try {
      console.log('[SYNC] Creating tasks from database apps...')

      // Get all apps from database (already synced by app cron)
      const syncedApps = await appService.getAllApps()

      // Filter apps with valid config and not deleted
      const validApps = syncedApps.filter(
        (app) =>
          app.contractAddress !== '' &&
          app.modelOrDomain !== '' &&
          !app.deleted,
      )

      if (validApps.length === 0) {
        console.log('[SYNC] No tasks to create')
        return {tasksCreated: 0, apps: []}
      }

      // Add tasks directly to queue (they will be created in DB by the worker)
      const jobPromises = validApps.map((app) =>
        queueService.addTask({
          appId: app.id, // Use dstack app ID (primary key)
        }),
      )

      await Promise.all(jobPromises)

      console.log(
        `[SYNC] Added ${validApps.length} tasks to queue successfully`,
      )
      return {tasksCreated: validApps.length, apps: []}
    } catch (error) {
      console.error('[SYNC] Sync all tasks error:', error)
      throw error
    }
  }

  // Sync selected tasks by app IDs (dstack_app_id) - reads from current database
  const syncSelectedTasks = async (
    appIds: string[],
  ): Promise<{tasksCreated: number; apps: UpstreamAppData[]}> => {
    try {
      console.log(`[SYNC] Creating tasks for selected ${appIds.length} apps...`)

      // Get selected apps from database by ID (dstack_app_id is now the primary key)
      const appPromises = appIds.map((id) => appService.getAppById(id))
      const appResults = await Promise.all(appPromises)
      const syncedApps = appResults.filter((app) => app !== null)

      if (syncedApps.length === 0) {
        console.log('[SYNC] No matching apps found in database')
        return {tasksCreated: 0, apps: []}
      }

      // Filter apps with valid config and not deleted
      const validApps = syncedApps.filter(
        (app) =>
          app.contractAddress !== '' &&
          app.modelOrDomain !== '' &&
          !app.deleted,
      )

      if (validApps.length === 0) {
        console.log('[SYNC] No tasks to create')
        return {tasksCreated: 0, apps: []}
      }

      // Add tasks directly to queue (they will be created in DB by the worker)
      const jobPromises = validApps.map((app) =>
        queueService.addTask({
          appId: app.id, // Use dstack app ID (primary key)
        }),
      )

      await Promise.all(jobPromises)

      console.log(
        `[SYNC] Added ${validApps.length} tasks to queue successfully`,
      )
      return {tasksCreated: validApps.length, apps: []}
    } catch (error) {
      console.error('[SYNC] Sync selected tasks error:', error)
      throw error
    }
  }

  // Force refresh all apps - bypasses 24h duplicate check, reads from current database
  const forceRefreshAllApps = async (): Promise<{
    tasksCreated: number
    apps: UpstreamAppData[]
  }> => {
    try {
      console.log(
        '[SYNC] Force refreshing all apps from database (bypassing 24h check)...',
      )

      // Get all apps from database (already synced by app cron)
      const syncedApps = await appService.getAllApps()

      // Filter apps with valid config and not deleted
      const validApps = syncedApps.filter(
        (app) =>
          app.contractAddress !== '' &&
          app.modelOrDomain !== '' &&
          !app.deleted,
      )

      if (validApps.length === 0) {
        console.log('[SYNC] No tasks to create')
        return {tasksCreated: 0, apps: []}
      }

      // Add tasks with forceRefresh flag to skip 24h check
      const jobPromises = validApps.map((app) =>
        queueService.addTask({
          appId: app.id, // Use dstack app ID (primary key)
          forceRefresh: true, // Force refresh - bypass 24h check
        }),
      )

      await Promise.all(jobPromises)

      console.log(
        `[SYNC] Force refresh: Added ${validApps.length} tasks to queue (bypassing 24h check)`,
      )
      return {tasksCreated: validApps.length, apps: []}
    } catch (error) {
      console.error('[SYNC] Force refresh error:', error)
      throw error
    }
  }

  // Sync apps from Metabase to database
  const syncApps = async (): Promise<{
    appsSynced: number
    apps: UpstreamAppData[]
  }> => {
    try {
      console.log('[SYNC] Syncing apps from Metabase...')

      const apps = await fetchApps()

      if (apps.length === 0) {
        console.log('[SYNC] No apps to sync')
        return {appsSynced: 0, apps: []}
      }

      // Convert upstream apps to app records
      const appRecords = apps.map(convertToAppRecord)

      // Upsert apps to database using appService
      await appService.upsertApps(appRecords)

      // Mark apps that are not in upstream as deleted
      const upstreamProfileIds = new Set(apps.map((app) => app.app_id))
      const allApps = await appService.getAllApps()
      const appsToMarkDeleted = allApps.filter(
        (app) => !upstreamProfileIds.has(app.profileId) && !app.deleted,
      )

      if (appsToMarkDeleted.length > 0) {
        const db = appService.getDb()
        await Promise.all(
          appsToMarkDeleted.map((app) =>
            db
              .update(appsTable)
              .set({deleted: true, updatedAt: new Date()})
              .where(eq(appsTable.id, app.id)),
          ),
        )
        console.log(`[SYNC] Marked ${appsToMarkDeleted.length} apps as deleted`)
      }

      console.log(`[SYNC] Synced ${apps.length} apps successfully`)
      return {appsSynced: apps.length, apps}
    } catch (error) {
      console.error('[SYNC] Sync apps error:', error)
      throw error
    }
  }

  // Sync profiles from Metabase to database
  const syncProfiles = async (): Promise<{
    profilesSynced: number
    profiles: UpstreamProfileData[]
  }> => {
    try {
      console.log('[SYNC] Syncing profiles from Metabase...')

      const profiles = await fetchProfiles()

      if (profiles.length === 0) {
        console.log('[SYNC] No profiles to sync')
        return {profilesSynced: 0, profiles: []}
      }

      // Sync profiles to database using profileService
      // Pass profiles directly - they already have snake_case format from Metabase
      await profileService.syncProfiles(profiles)

      console.log(`[SYNC] Synced ${profiles.length} profiles successfully`)
      return {profilesSynced: profiles.length, profiles}
    } catch (error) {
      console.error('[SYNC] Sync profiles error:', error)
      throw error
    }
  }

  return {
    syncApps,
    syncAllTasks,
    syncSelectedTasks,
    forceRefreshAllApps,
    syncProfiles,
    fetchApps,
    fetchProfiles,
  }
}
