import {
  and,
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
import {
  createSyncEventService,
  getSyncErrorMessage,
  type SyncEventInput,
} from './syncEventService'
import {verificationTaskId} from './verificationTaskId'

// Match teehouse parse_version (cloud-api.phala.com): first x.y.z in the
// string, ignore prerelease/build suffixes. Unparseable -> 0.0.0, never throw.
function parseVersion(baseImage: string): {
  major: number
  minor: number
  patch: number
} {
  const match = baseImage.match(/(\d+)\.(\d+)\.(\d+)/)
  if (!match) {
    return {major: 0, minor: 0, patch: 0}
  }
  return {
    major: parseInt(match[1]!, 10),
    minor: parseInt(match[2]!, 10),
    patch: parseInt(match[3]!, 10),
  }
}

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
  return current.patch >= target.patch
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
export function convertToAppRecord(app: UpstreamAppData): NewAppRecord {
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
const PHALA_CLOUD_APP_API =
  'https://cloud-api.phala.com/api/v1/stats/dstack_app'
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
    eventId?: string,
    onDispatched?: (appId: string) => Promise<void>,
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
  const db = appService.getDb()
  const syncEventService = createSyncEventService(db)

  const recordFailure = async (
    event: Omit<SyncEventInput, 'result'>,
    error: unknown,
  ): Promise<void> => {
    try {
      // This runs outside the apply transaction, which may have rolled back.
      await syncEventService.recordFailure({...event, rowsChanged: 0, error})
    } catch (auditError) {
      // Preserve the original failure even when the database is unavailable.
      console.error(
        '[SYNC] Failed to record sync error:',
        getSyncErrorMessage(auditError),
      )
    }
    console.error('[SYNC] Full sync failed:', getSyncErrorMessage(error))
  }

  // Fetch from Phala Cloud API with Bearer auth
  const fetchFromApi = async (url: string, resourceName: string) => {
    const response = await fetch(url, {
      method: 'GET',
      headers: {Authorization: `Bearer ${config.phalaCloudApiKey}`},
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      throw new Error(
        `Phala Cloud ${resourceName} API error: HTTP ${response.status}`,
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
        throw new Error(
          'Phala Cloud apps API request timed out after 30 seconds',
        )
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
      console.error('[SYNC] Sync all tasks error:', getSyncErrorMessage(error))
      throw error
    }
  }

  // Sync selected tasks by app IDs (dstack_app_id) - reads from current database
  const syncSelectedTasks = async (
    appIds: string[],
    eventId?: string,
    onDispatched?: (appId: string) => Promise<void>,
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
      // Finish every receipt before allowing an event retry to start. Promise.all
      // rejects early and can leave successful sibling jobs unreceipted.
      const outcomes = await Promise.allSettled(
        validApps.map(async (app) => {
          await queueService.addTask(
            {appId: app.id},
            eventId ? verificationTaskId(eventId, app.id) : undefined,
          )
          await onDispatched?.(app.id)
        }),
      )
      const failure = outcomes.find((outcome) => outcome.status === 'rejected')
      if (failure?.status === 'rejected') throw failure.reason

      console.log(
        `[SYNC] Added ${validApps.length} tasks to queue successfully`,
      )
      return {tasksCreated: validApps.length, apps: []}
    } catch (error) {
      console.error(
        '[SYNC] Sync selected tasks error:',
        getSyncErrorMessage(error),
      )
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
      console.error('[SYNC] Force refresh error:', getSyncErrorMessage(error))
      throw error
    }
  }

  // Sync apps from Phala Cloud API to database
  const syncApps = async (): Promise<{
    appsSynced: number
    apps: UpstreamAppData[]
  }> => {
    const event = {
      id: crypto.randomUUID(),
      source: 'cron-apps' as const,
      receivedAt: new Date(),
      appCount: 0,
    }
    try {
      console.log('[SYNC] Syncing apps from Phala Cloud API...')

      const apps = await fetchApps()
      event.appCount = apps.length
      console.log(`[SYNC] Fetched ${apps.length} apps from Phala Cloud API`)

      const appRecords = apps.map(convertToAppRecord)
      const {changedCount, deletedCount, revivedCount} = await db.transaction(
        async (tx) => {
          // Serialize full reconciliation with partial push writes.
          await tx.execute(sql`SELECT pg_advisory_xact_lock(74190311)`)
          let changedCount = 0
          let deletedCount = 0
          let revivedCount = 0

          // Preserve the existing empty-snapshot safeguard: do not delete all apps.
          if (apps.length > 0) {
            const result = await appService.upsertApps(appRecords, tx)
            changedCount = result.apps.length
            revivedCount = result.revivedCount

            const upstreamProfileIds = new Set(apps.map((app) => app.app_id))
            const allApps = await appService.getAllApps(tx)
            const idsToDelete = allApps
              .filter(
                (app) => !upstreamProfileIds.has(app.profileId) && !app.deleted,
              )
              .map((app) => app.id)

            if (idsToDelete.length > 0) {
              const deleted = await tx
                .update(appsTable)
                .set({deleted: true, updatedAt: new Date()})
                .where(
                  and(
                    inArray(appsTable.id, idsToDelete),
                    eq(appsTable.deleted, false),
                  ),
                )
                .returning({id: appsTable.id})
              deletedCount = deleted.length
            }
          }

          await syncEventService.record(
            {
              ...event,
              deletedAppCount: deletedCount,
              rowsChanged: changedCount + deletedCount,
              result: 'success',
              finishedAt: new Date(),
            },
            tx,
          )
          return {changedCount, deletedCount, revivedCount}
        },
      )

      console.log(
        `[SYNC] Changed ${changedCount} apps, marked ${deletedCount} apps as deleted`,
      )
      if (revivedCount > 0) {
        console.log(`[SYNC] Revived ${revivedCount} apps, cleared failed tasks`)
      }
      console.log(`[SYNC] App sync completed: ${apps.length} apps synced`)
      return {appsSynced: apps.length, apps}
    } catch (error) {
      await recordFailure(event, error)
      throw error
    }
  }

  // Sync profiles from Phala Cloud API to database
  const syncProfiles = async (): Promise<{
    profilesSynced: number
    profiles: UpstreamProfileData[]
  }> => {
    const event = {
      id: crypto.randomUUID(),
      source: 'cron-profiles' as const,
      receivedAt: new Date(),
      profileCount: 0,
    }
    try {
      console.log('[SYNC] Syncing profiles from Phala Cloud API...')

      const profiles = await fetchProfiles()
      event.profileCount = profiles.length
      console.log(
        `[SYNC] Fetched ${profiles.length} profiles from Phala Cloud API`,
      )

      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(74190311)`)
        // Keep the existing empty-snapshot safeguard for profiles, too.
        const counts =
          profiles.length > 0
            ? await profileService.syncProfiles(profiles, tx)
            : {upserted: 0, deleted: 0}
        await syncEventService.record(
          {
            ...event,
            deletedProfileCount: counts.deleted,
            rowsChanged: counts.upserted + counts.deleted,
            result: 'success',
            finishedAt: new Date(),
          },
          tx,
        )
      })

      console.log(
        `[SYNC] Profile sync completed: ${profiles.length} profiles synced`,
      )
      return {profilesSynced: profiles.length, profiles}
    } catch (error) {
      await recordFailure(event, error)
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
