import type {NextRequest} from 'next/server'

import {env} from '@/env'

interface AppData {
  app_id: string
  name: string
  chain_id: string | null
  kms_contract_address: string | null
  contract_address: string | null
  base_image: string
  tproxy_base_domain: string | null
  gateway_domain_suffix: string | null
}

interface TaskData {
  appId: string
  appName: string
  appConfigType: string
  contractAddress: string
  modelOrDomain: string
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
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
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

// Helper function to check if app is version 0.5.3 (for testing filter)
function isVersion053(baseImage: string): boolean {
  try {
    const version = parseVersion(baseImage)
    return version.major === 0 && version.minor === 5 && version.patch === 3
  } catch {
    return false
  }
}

// Helper function to process app data and create task
function processAppData(app: AppData): TaskData {
  const {
    app_id,
    name,
    chain_id,
    kms_contract_address,
    contract_address,
    base_image,
    tproxy_base_domain,
    gateway_domain_suffix,
  } = app

  let contractAddress = ''
  let modelOrDomain = ''

  const defaultContractAddress = `0x${app_id}`

  // Determine contract address based on base_image version
  if (isVersionGreaterOrEqual(base_image, '0.5.3')) {
    // >= 0.5.3: use app_id converted to hex
    contractAddress = `0x${app_id}`
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
    appId: app_id,
    appName: name,
    appConfigType: 'phala_cloud',
    contractAddress: contractAddress || defaultContractAddress,
    modelOrDomain,
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (
    authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
    process.env.NODE_ENV !== 'development'
  ) {
    return new Response('Unauthorized', {
      status: 401,
    })
  }

  try {
    // Fetch data from Metabase API
    const metabaseResponse = await fetch(env.METABASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': env.METABASE_API_KEY,
      },
      body: JSON.stringify({}),
    })

    if (!metabaseResponse.ok) {
      throw new Error(
        `Metabase API error: ${metabaseResponse.status} ${metabaseResponse.statusText}`,
      )
    }

    const apps: AppData[] = await metabaseResponse.json()

    // Temporary filter for testing: only 0.5.3 versions
    const tasks: TaskData[] = apps
      .map(processAppData)
      .filter(
        (task) => task.contractAddress !== '' && task.modelOrDomain !== '',
      )
      .filter((task) =>
        isVersion053(
          apps.find((app) => app.app_id === task.appId)?.base_image || '',
        ),
      )

    // Batch add tasks to the target API
    const batchResponse = await fetch(
      new URL('/api/v1/tasks/batch', env.VERIFIER_BASE_URL),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.VERIFIER_BEARER_TOKEN}`,
        },
        body: JSON.stringify({tasks}),
      },
    )

    if (!batchResponse.ok) {
      throw new Error(
        `Batch API error: ${batchResponse.status} ${batchResponse.statusText}`,
      )
    }

    const batchResult = await batchResponse.json()

    return Response.json({
      success: true,
      tasksCreated: tasks.length,
      batchResult,
    })
  } catch (error) {
    console.error('Sync tasks error:', error)
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      {status: 500},
    )
  }
}
