import {type NextRequest, NextResponse} from 'next/server'

import {env} from '@/env'
import {verifyCloudHmac} from '@/lib/cloud-auth'
import {getCloudAppStatus} from '@/lib/db'

interface RouteParams {
  params: Promise<{
    'app-id': string
  }>
}

// Authenticated status API for Phala Cloud (server-to-server).
// Auth: same HMAC scheme as POST /webhooks/phala-cloud —
//   X-Phala-Timestamp: <unix seconds>
//   X-Phala-Signature: sha256=HMAC_SHA256(secret, "{timestamp}.")
// Signed with the shared PHALA_CLOUD_API_KEY.
// This endpoint is intentionally NOT CORS-enabled: it is called from the
// platform backend, not a browser.
export async function GET(request: NextRequest, {params}: RouteParams) {
  const {'app-id': appId} = await params

  const auth = verifyCloudHmac(request, env.PHALA_CLOUD_API_KEY)
  if (!auth.ok) {
    return NextResponse.json({error: auth.error}, {status: auth.status})
  }

  const status = await getCloudAppStatus(appId)
  // Mirrors the public /app/[app-id] route: the page renders only when the app
  // is not hidden and at least one verification task has completed.
  const indexed = !status.hidden && status.hasCompletedTask

  return NextResponse.json(
    {
      app_id: appId,
      present: status.present,
      indexed,
      listed: status.listed,
      deleted: status.deleted,
      page_url: `https://trust.phala.com/app/${appId}`,
      last_indexed_at: status.lastIndexedAt,
      verification: {
        status: status.latestTask?.status ?? 'none',
        task_id: status.latestTask?.taskId ?? null,
        finished_at: status.latestTask?.finishedAt ?? null,
        error_message: status.latestTask?.errorMessage ?? null,
      },
    },
    {headers: {'Cache-Control': 'no-store'}},
  )
}
