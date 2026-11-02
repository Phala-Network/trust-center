import {
  and,
  appsTable,
  createDbConnection,
  desc,
  eq,
  profilesTable,
  verificationTasksTable,
} from '@phala/trust-center-db'

// Mirrors apps/webapp/src/lib/db.ts isHiddenApp. Unlisted apps are hidden
// unconditionally; deleted apps are hidden once their profile is gone (a
// stopped CVM is also absent from the upstream stats), except the whitelisted
// pair, which must stay accessible even once deleted.
const WHITELISTED_APP_IDS = [
  '22b30e8e1b01d732e7dae67d7b0c2dfd67dfeb53',
  '88b5c6a7c5f2975e5851f311fba51dc995c0736f',
]

const isHiddenApp = (
  app: {id: string; deleted: boolean; isPublic: boolean},
  hasAppProfile: boolean,
) =>
  !app.isPublic ||
  (app.deleted && !hasAppProfile && !WHITELISTED_APP_IDS.includes(app.id))

export interface CloudAppStatus {
  // We know this app at all (apps row exists, or a task row exists)
  present: boolean
  // apps.isPublic — the listed flag as last received from Phala Cloud
  listed: boolean
  deleted: boolean
  // Unlisted and deleted-without-profile apps are not served on any per-app
  // route (so `indexed` is false for them)
  hidden: boolean
  hasCompletedTask: boolean
  lastIndexedAt: string | null
  latestTask: {
    taskId: string
    status: string
    finishedAt: string | null
    errorMessage: string | null
  } | null
}

export interface CloudStatusService {
  getStatus: (appId: string) => Promise<CloudAppStatus>
}

export function createCloudStatusService(
  databaseUrl: string,
): CloudStatusService {
  const db = createDbConnection(databaseUrl)

  const getStatus = async (appId: string): Promise<CloudAppStatus> => {
    const [appResult, completed, latest] = await Promise.all([
      db
        .select({
          app: {
            id: appsTable.id,
            isPublic: appsTable.isPublic,
            deleted: appsTable.deleted,
          },
          appProfileId: profilesTable.id,
        })
        .from(appsTable)
        .leftJoin(
          profilesTable,
          and(
            eq(profilesTable.entityType, 'app'),
            eq(profilesTable.entityId, appsTable.profileId),
          ),
        )
        .where(eq(appsTable.id, appId))
        .limit(1),
      db
        .select({finishedAt: verificationTasksTable.finishedAt})
        .from(verificationTasksTable)
        .where(
          and(
            eq(verificationTasksTable.appId, appId),
            eq(verificationTasksTable.status, 'completed'),
          ),
        )
        .orderBy(desc(verificationTasksTable.createdAt))
        .limit(1),
      db
        .select({
          taskId: verificationTasksTable.id,
          status: verificationTasksTable.status,
          finishedAt: verificationTasksTable.finishedAt,
          errorMessage: verificationTasksTable.errorMessage,
        })
        .from(verificationTasksTable)
        .where(eq(verificationTasksTable.appId, appId))
        .orderBy(desc(verificationTasksTable.createdAt))
        .limit(1),
    ])

    const app = appResult[0]
    const latestTask = latest[0]
      ? {
          taskId: latest[0].taskId,
          status: latest[0].status,
          finishedAt: latest[0].finishedAt?.toISOString() ?? null,
          errorMessage: latest[0].errorMessage,
        }
      : null

    return {
      present: Boolean(app) || Boolean(latestTask),
      listed: app?.app.isPublic ?? false,
      deleted: app?.app.deleted ?? false,
      hidden: app ? isHiddenApp(app.app, app.appProfileId !== null) : false,
      hasCompletedTask: Boolean(completed[0]),
      lastIndexedAt: completed[0]?.finishedAt?.toISOString() ?? null,
      latestTask,
    }
  }

  return {getStatus}
}
