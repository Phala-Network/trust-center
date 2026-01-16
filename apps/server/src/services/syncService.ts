import {
  appsTable,
  eq,
  inArray,
  type NewAppRecord,
  sql,
  type UpstreamAppData,
  UpstreamAppDataArraySchema,
  type UpstreamProfileData,
  UpstreamProfileDataArraySchema,
} from '@phala/trust-center-db'

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
// Returns slugified values to ensure consistency with featured builders
function determineUser(app: UpstreamAppData): string | null {
  const {email, username, app_name, docker_compose_file} = app

  // Crossmint -> Name contains crossmint
  if (app_name.toLowerCase().includes('crossmint')) {
    return 'crossmint'
  }

  // Vana -> User == volod@opendatalabs.xyz
  if (email && email === 'volod@opendatalabs.xyz') {
    return 'vana'
  }

  // Rena Labs -> user == Renalabs (with or without trailing space)
  if (username?.trim() === 'Renalabs') {
    return 'rena-labs'
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
    return 'near'
  }

  // Sahara -> Name contains sahara
  if (app_name.toLowerCase().includes('sahara')) {
    return 'sahara'
  }

  // Lit -> User == chris@litprotocol.com
  if (email && email === 'chris@litprotocol.com') {
    return 'lit'
  }

  // Magic Link -> User == infra@magic.link
  if (email && email === 'infra@magic.link') {
    return 'magic-link'
  }

  // Vijil -> User == vele-vijil
  if (username === 'vele-vijil') {
    return 'vijil'
  }

  // Rift -> User == alpinevm
  if (username === 'alpinevm') {
    return 'rift'
  }

  if (docker_compose_file?.includes('primuslabs/attestor-node')) {
    return 'primus'
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
  let domain = ''
  const defaultContractAddress = `0x${dstack_app_id}`

  // Determine contract address based on base_image version
  if (isVersionGreaterOrEqual(base_image, '0.5.3')) {
    contractAddress = `0x${dstack_app_id}`
  } else if (isVersionGreaterOrEqual(base_image, '0.5.1')) {
    contractAddress = contract_address || ''
  }

  // Determine domain based on base_image version
  if (isVersionGreaterOrEqual(base_image, '0.5.3')) {
    domain = gateway_domain_suffix || ''
  } else {
    domain = tproxy_base_domain || ''
  }

  return {
    id: dstack_app_id, // dstack_app_id is now the primary key
    profileId: app_id, // app_id is now profileId
    appName: app_name,
    appConfigType: 'phala_cloud',
    contractAddress: contractAddress || defaultContractAddress,
    domain,
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

// Phala Cloud API endpoints
const PHALA_CLOUD_APP_API = 'https://cloud-api.phala.com/api/v1/stats/dstack_app'
const PHALA_CLOUD_PROFILE_API =
  'https://cloud-api.phala.com/api/v1/stats/entity_profile'

export interface SyncServiceConfig {
  phalaCloudApiKey: string
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
  // Fetch from Phala Cloud API with Bearer auth
  const fetchFromApi = async (url: string, resourceName: string) => {
    const response = await fetch(url, {
      method: 'GET',
      headers: {Authorization: `Bearer ${config.phalaCloudApiKey}`},
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(
        `Phala Cloud ${resourceName} API error: ${response.status} ${response.statusText} - ${errorText}`,
      )
    }

    const json = (await response.json()) as {data?: unknown} | unknown
    return json && typeof json === 'object' && 'data' in json ? json.data : json
  }

  const fetchApps = async (): Promise<UpstreamAppData[]> => {
    console.log('[SYNC] Fetching apps from Phala Cloud API...')
    try {
      const data = await fetchFromApi(PHALA_CLOUD_APP_API, 'apps')
      const apps = UpstreamAppDataArraySchema.parse(data)
      console.log(
        `[SYNC] Successfully fetched and validated ${apps.length} apps from Phala Cloud API`,
      )
      return apps
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error('Phala Cloud apps API request timed out after 30 seconds')
      }
      throw error
    }
  }

  const fetchProfiles = async (): Promise<UpstreamProfileData[]> => {
    console.log('[SYNC] Fetching profiles from Phala Cloud API...')
    try {
      const data = await fetchFromApi(PHALA_CLOUD_PROFILE_API, 'profiles')
      const profiles = UpstreamProfileDataArraySchema.parse(data)
      console.log(
        `[SYNC] Successfully fetched and validated ${profiles.length} profiles from Phala Cloud API`,
      )
      return profiles
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error(
          'Phala Cloud profiles API request timed out after 30 seconds',
        )
      }
      throw error
    }
  }

  // Sync all tasks - reads from current database apps table instead of fetching from upstream
  // Only creates tasks for apps that need verification (no completed report in last 24h)
  const syncAllTasks = async (): Promise<{
    tasksCreated: number
    apps: UpstreamAppData[]
  }> => {
    try {
      console.log('[SYNC] Creating tasks from database apps...')

      // Get apps needing verification (valid apps without recent completed reports)
      // This single query handles both validation and 24h duplicate check
      const appsToVerify = await appService.getAppsNeedingVerification()

      if (appsToVerify.length === 0) {
        console.log(
          '[SYNC] No apps need verification (all have recent reports or are invalid)',
        )
        console.log('[SYNC] Task creation completed: 0 tasks created')
        return {tasksCreated: 0, apps: []}
      }

      console.log(
        `[SYNC] Found ${appsToVerify.length} apps needing verification`,
      )

      // Add tasks directly to queue (they will be created in DB by the worker)
      const jobPromises = appsToVerify.map((app) =>
        queueService.addTask({
          appId: app.id, // Use dstack app ID (primary key)
        }),
      )

      await Promise.all(jobPromises)

      console.log(
        `[SYNC] Added ${appsToVerify.length} tasks to queue successfully`,
      )
      console.log(
        `[SYNC] Task creation completed: ${appsToVerify.length} tasks created`,
      )
      return {tasksCreated: appsToVerify.length, apps: []}
    } catch (error) {
      console.error('[SYNC] Sync all tasks error:', error)
      console.error(
        '[SYNC] Error details:',
        error instanceof Error ? error.message : String(error),
      )
      throw error
    }
  }

  // Sync selected tasks by app IDs (dstack_app_id) - reads from current database
  const syncSelectedTasks = async (
    appIds: string[],
  ): Promise<{tasksCreated: number; apps: UpstreamAppData[]}> => {
    try {
      console.log(`[SYNC] Creating tasks for selected ${appIds.length} apps...`)

      // Get selected valid apps from database (pre-filtered by SQL)
      const validApps = await appService.getValidAppsByIds(appIds)

      if (validApps.length === 0) {
        console.log('[SYNC] No valid apps found for the selected IDs')
        return {tasksCreated: 0, apps: []}
      }

      console.log(
        `[SYNC] Found ${validApps.length} valid apps out of ${appIds.length} selected IDs`,
      )

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

  // Force refresh all apps - bypasses 24h duplicate check by using getValidApps()
  // instead of getAppsNeedingVerification()
  const forceRefreshAllApps = async (): Promise<{
    tasksCreated: number
    apps: UpstreamAppData[]
  }> => {
    try {
      console.log(
        '[SYNC] Force refreshing all apps from database (bypassing 24h check)...',
      )

      // Get all valid apps (bypasses 24h check by not using getAppsNeedingVerification)
      const validApps = await appService.getValidApps()

      if (validApps.length === 0) {
        console.log('[SYNC] No valid apps to force refresh')
        return {tasksCreated: 0, apps: []}
      }

      console.log(
        `[SYNC] Found ${validApps.length} valid apps for force refresh`,
      )

      // Add tasks to queue (will run even if they have recent reports)
      const jobPromises = validApps.map((app) =>
        queueService.addTask({
          appId: app.id, // Use dstack app ID (primary key)
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

  // Sync apps from Phala Cloud API to database
  const syncApps = async (): Promise<{
    appsSynced: number
    apps: UpstreamAppData[]
  }> => {
    try {
      console.log('[SYNC] Syncing apps from Phala Cloud API...')

      const apps = await fetchApps()
      console.log(`[SYNC] Fetched ${apps.length} apps from Phala Cloud API`)

      if (apps.length === 0) {
        console.log('[SYNC] No apps to sync')
        console.log('[SYNC] App sync completed: 0 apps synced')
        return {appsSynced: 0, apps: []}
      }

      // Convert upstream apps to app records
      const appRecords = apps.map(convertToAppRecord)
      console.log(`[SYNC] Converted ${appRecords.length} app records`)

      // Upsert apps to database using appService
      await appService.upsertApps(appRecords)
      console.log(`[SYNC] Upserted ${appRecords.length} apps to database`)

      // Mark apps that are not in upstream as deleted (batch update)
      const upstreamProfileIds = new Set(apps.map((app) => app.app_id))
      const allApps = await appService.getAllApps()
      const appsToMarkDeleted = allApps.filter(
        (app) => !upstreamProfileIds.has(app.profileId) && !app.deleted,
      )

      if (appsToMarkDeleted.length > 0) {
        const db = appService.getDb()
        const idsToDelete = appsToMarkDeleted.map((app) => app.id)

        // Batch update all apps to mark as deleted in a single query
        await db
          .update(appsTable)
          .set({deleted: true, updatedAt: new Date()})
          .where(inArray(appsTable.id, idsToDelete))

        console.log(`[SYNC] Marked ${appsToMarkDeleted.length} apps as deleted`)
      }

      console.log(`[SYNC] App sync completed: ${apps.length} apps synced`)
      return {appsSynced: apps.length, apps}
    } catch (error) {
      console.error('[SYNC] Sync apps error:', error)
      console.error(
        '[SYNC] Error details:',
        error instanceof Error ? error.message : String(error),
      )
      if (error instanceof Error && error.stack) {
        console.error('[SYNC] Error stack:', error.stack)
      }
      throw error
    }
  }

  // Sync profiles from Phala Cloud API to database
  const syncProfiles = async (): Promise<{
    profilesSynced: number
    profiles: UpstreamProfileData[]
  }> => {
    try {
      console.log('[SYNC] Syncing profiles from Phala Cloud API...')

      const profiles = await fetchProfiles()
      console.log(`[SYNC] Fetched ${profiles.length} profiles from Phala Cloud API`)

      if (profiles.length === 0) {
        console.log('[SYNC] No profiles to sync')
        console.log('[SYNC] Profile sync completed: 0 profiles synced')
        return {profilesSynced: 0, profiles: []}
      }

      // Sync profiles to database using profileService
      // Pass profiles directly - they already have snake_case format from Phala Cloud API
      await profileService.syncProfiles(profiles)

      console.log(
        `[SYNC] Profile sync completed: ${profiles.length} profiles synced`,
      )
      return {profilesSynced: profiles.length, profiles}
    } catch (error) {
      console.error('[SYNC] Sync profiles error:', error)
      console.error(
        '[SYNC] Error details:',
        error instanceof Error ? error.message : String(error),
      )
      if (error instanceof Error && error.stack) {
        console.error('[SYNC] Error stack:', error.stack)
      }
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
