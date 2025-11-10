import type {ProfileEntityType} from '@phala/trust-center-db'
import {z} from 'zod'

import type {ProfileService} from './profileService'
import type {QueueService} from './queue'

// Zod schema for Metabase app data format
const AppDataSchema = z.object({
  app_id: z.number(),
  dstack_app_id: z.string(),
  app_name: z.string(),
  workspace_id: z.number(),
  creator_id: z.number(),
  chain_id: z.number().nullable(),
  kms_contract_address: z.string().nullable(),
  contract_address: z.string().nullable(),
  base_image: z.string(),
  tproxy_base_domain: z.string().nullable(),
  gateway_domain_suffix: z.string().nullable(),
  listed: z.boolean(),
  username: z.string(),
  email: z.string().nullable(),
  app_created_at: z.string(),
  vm_created_at: z.string(),
})

export type AppData = z.infer<typeof AppDataSchema>

// Zod schema for profile data from Metabase
const ProfileDataSchema = z.object({
  entity_type: z.enum(['app', 'user', 'workspace']),
  entity_id: z.number(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  description: z.string().nullable(),
  custom_domain: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
})

export type ProfileData = z.infer<typeof ProfileDataSchema>

export interface TaskData {
  appId: string // dstack_app_id (used for contract address)
  appProfileId: string // app_id from Metabase (used for profile lookup, always exists)
  appName: string
  appConfigType: 'phala_cloud' | 'redpill'
  contractAddress: string
  modelOrDomain: string
  dstackVersion?: string
  isPublic?: boolean
  user?: string
  workspaceId?: string // Workspace ID from Metabase
  creatorId?: string // Creator user ID from Metabase
}

// Helper function to determine user based on business rules
function determineUser(app: AppData): string | undefined {
  const {email, username, app_name} = app

  // Crossmint -> Name contains crossmint
  if (app_name.toLowerCase().includes('crossmint')) {
    return 'Crossmint'
  }

  // Vana -> User == volod@opendatalabs.xyz
  if (email && email === 'volod@opendatalabs.xyz') {
    return 'Vana'
  }

  // Rena Labs -> user == Renalabs
  if (username === 'Renalabs ') {
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

  return undefined
}

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

// Helper function to process app data and create task
function processAppData(app: AppData): TaskData {
  const {
    app_id,
    dstack_app_id,
    app_name,
    base_image,
    contract_address,
    tproxy_base_domain,
    gateway_domain_suffix,
    listed,
    workspace_id,
    creator_id,
  } = app

  let contractAddress = ''
  let modelOrDomain = ''

  const defaultContractAddress = `0x${dstack_app_id}`

  // Determine contract address based on base_image version
  if (isVersionGreaterOrEqual(base_image, '0.5.3')) {
    // >= 0.5.3: use dstack_app_id as hex
    contractAddress = `0x${dstack_app_id}`
  } else if (isVersionGreaterOrEqual(base_image, '0.5.1')) {
    // 0.5.1 to 0.5.2: use contract_address field
    contractAddress = contract_address || ''
  }
  // < 0.5.1: contract_address is empty (already initialized as empty string)

  // Determine domain based on base_image version
  if (isVersionGreaterOrEqual(base_image, '0.5.3')) {
    // >= 0.5.3: use gateway_domain_suffix
    modelOrDomain = gateway_domain_suffix || ''
  } else {
    // < 0.5.3: use tproxy_base_domain
    modelOrDomain = tproxy_base_domain || ''
  }

  return {
    appId: dstack_app_id, // Used for contract address generation
    appProfileId: app_id.toString(), // Metabase database ID for profile lookup
    appName: app_name,
    appConfigType: 'phala_cloud',
    contractAddress: contractAddress || defaultContractAddress,
    modelOrDomain,
    dstackVersion: base_image,
    isPublic: listed,
    user: determineUser(app),
    workspaceId: workspace_id.toString(),
    creatorId: creator_id.toString(),
  }
}

export interface SyncServiceConfig {
  metabaseAppQuery: string
  metabaseProfileQuery: string
  metabaseApiKey: string
}

export interface SyncService {
  syncAllTasks: () => Promise<{tasksCreated: number; apps: AppData[]}>
  syncSelectedTasks: (
    appIds: string[],
  ) => Promise<{tasksCreated: number; apps: AppData[]}>
  syncProfiles: () => Promise<{profilesSynced: number; profiles: ProfileData[]}>
  fetchApps: () => Promise<AppData[]>
  fetchProfiles: () => Promise<ProfileData[]>
}

export function createSyncService(
  config: SyncServiceConfig,
  queueService: QueueService,
  profileService: ProfileService,
): SyncService {
  // Fetch apps from Metabase
  const fetchApps = async (): Promise<AppData[]> => {
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
    const apps = z.array(AppDataSchema).parse(data)
    return apps
  }

  // Fetch profiles from Metabase
  const fetchProfiles = async (): Promise<ProfileData[]> => {
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
    const profiles = z.array(ProfileDataSchema).parse(data)
    return profiles
  }

  // Sync all tasks
  const syncAllTasks = async (): Promise<{
    tasksCreated: number
    apps: AppData[]
  }> => {
    try {
      console.log('[SYNC] Syncing all tasks from Metabase...')

      const apps = await fetchApps()

      // Process and filter apps
      const tasks: TaskData[] = apps
        .map(processAppData)
        .filter(
          (task) => task.contractAddress !== '' && task.modelOrDomain !== '',
        )

      if (tasks.length === 0) {
        console.log('[SYNC] No tasks to create')
        return {tasksCreated: 0, apps: []}
      }

      // Add tasks directly to queue (they will be created in DB by the worker)
      const jobPromises = tasks.map((task) =>
        queueService.addTask({
          appId: task.appId,
          appProfileId: task.appProfileId,
          appName: task.appName,
          appConfigType: task.appConfigType,
          contractAddress: task.contractAddress,
          modelOrDomain: task.modelOrDomain,
          dstackVersion: task.dstackVersion,
          isPublic: task.isPublic,
          user: task.user,
          workspaceId: task.workspaceId,
          creatorId: task.creatorId,
        }),
      )

      await Promise.all(jobPromises)

      console.log(`[SYNC] Added ${tasks.length} tasks to queue successfully`)
      return {tasksCreated: tasks.length, apps}
    } catch (error) {
      console.error('[SYNC] Sync all tasks error:', error)
      throw error
    }
  }

  // Sync selected tasks by app IDs
  const syncSelectedTasks = async (
    appIds: string[],
  ): Promise<{tasksCreated: number; apps: AppData[]}> => {
    try {
      console.log(`[SYNC] Syncing selected ${appIds.length} tasks...`)

      const apps = await fetchApps()

      // Filter apps by selected IDs
      const selectedApps = apps.filter((app) =>
        appIds.includes(app.dstack_app_id),
      )

      if (selectedApps.length === 0) {
        console.log('[SYNC] No matching apps found')
        return {tasksCreated: 0, apps: []}
      }

      // Process and filter apps
      const tasks: TaskData[] = selectedApps
        .map(processAppData)
        .filter(
          (task) => task.contractAddress !== '' && task.modelOrDomain !== '',
        )

      if (tasks.length === 0) {
        console.log('[SYNC] No tasks to create')
        return {tasksCreated: 0, apps: selectedApps}
      }

      // Add tasks directly to queue (they will be created in DB by the worker)
      const jobPromises = tasks.map((task) =>
        queueService.addTask({
          appId: task.appId,
          appProfileId: task.appProfileId,
          appName: task.appName,
          appConfigType: task.appConfigType,
          contractAddress: task.contractAddress,
          modelOrDomain: task.modelOrDomain,
          dstackVersion: task.dstackVersion,
          isPublic: task.isPublic,
          user: task.user,
          workspaceId: task.workspaceId,
          creatorId: task.creatorId,
        }),
      )

      await Promise.all(jobPromises)

      console.log(`[SYNC] Added ${tasks.length} tasks to queue successfully`)
      return {tasksCreated: tasks.length, apps: selectedApps}
    } catch (error) {
      console.error('[SYNC] Sync selected tasks error:', error)
      throw error
    }
  }

  // Sync profiles from Metabase to database
  const syncProfiles = async (): Promise<{
    profilesSynced: number
    profiles: ProfileData[]
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
    syncAllTasks,
    syncSelectedTasks,
    syncProfiles,
    fetchApps,
    fetchProfiles,
  }
}
