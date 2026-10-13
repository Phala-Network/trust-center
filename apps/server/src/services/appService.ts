import {
  type AppRecord,
  and,
  appsTable,
  createDbConnection,
  type DbConnection,
  type DbExecutor,
  eq,
  getTableColumns,
  inArray,
  like,
  lt,
  type NewAppRecord,
  or,
  sql,
  verificationTasksTable,
} from '@phala/trust-center-db'
import {subDays, subMinutes} from 'date-fns'

import {PERMANENT_FAILURE_PATTERNS} from './failureClassification'

// Compute app IDs in this upsert batch that are currently marked deleted and
// will therefore revive (deleted true -> false) when the batch is upserted.
// Must be based strictly on the deleted flag transition, not timestamps:
// otherwise transiently unreachable apps could bypass the permanent-failure
// cooldown and churn.
export function computeRevivedAppIds(
  batchIds: readonly string[],
  deletedIds: readonly string[],
): string[] {
  const deletedSet = new Set(deletedIds)
  return batchIds.filter((id) => deletedSet.has(id))
}

// App service factory function
export const createAppService = (
  databaseUrl: string = process.env.DATABASE_URL || '',
) => {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required')
  }
  const db: DbConnection = createDbConnection(databaseUrl)

  // Get app by ID (dstack app ID is now the primary key)
  const getAppById = async (id: string) => {
    const result = await db
      .select()
      .from(appsTable)
      .where(eq(appsTable.id, id))
      .limit(1)

    return result[0] || null
  }

  // Upsert app (insert or update)
  const upsertApp = async (appData: NewAppRecord) => {
    const existing = await getAppById(appData.id)

    if (existing) {
      // Update existing app
      const [updated] = await db
        .update(appsTable)
        .set({
          ...appData,
          updatedAt: new Date(),
          lastSyncedAt: new Date(),
          deleted: false, // Reset deleted flag when app reappears in upstream
        })
        .where(eq(appsTable.id, existing.id))
        .returning()

      return updated
    }

    // Insert new app
    const [created] = await db
      .insert(appsTable)
      .values({
        ...appData,
        lastSyncedAt: new Date(),
      })
      .returning()

    return created
  }

  // Batch upsert apps (optimized for bulk operations)
  // Processes in batches of 100 to avoid PostgreSQL parameter limit (65535)
  // Deduplicates by ID to avoid "ON CONFLICT DO UPDATE cannot affect row a second time" error
  //
  // Returns only changed/inserted apps plus the number of revived apps (apps whose
  // deleted flag flipped true -> false in this upsert). For revived apps,
  // failed verification tasks are cleared so the next tasks tick re-enqueues
  // them immediately instead of waiting out the permanent-failure cooldown.
  const upsertApps = async (
    appsData: NewAppRecord[],
    executor?: DbExecutor,
  ): Promise<{apps: AppRecord[]; revivedCount: number}> => {
    if (!appsData || appsData.length === 0) {
      console.warn('[APP] upsertApps called with empty array, skipping')
      return {apps: [], revivedCount: 0}
    }
    // Keep every batch and revival cleanup atomic; reuse an ingest transaction
    // when supplied instead of opening an independent transaction.
    if (!executor) {
      return db.transaction((tx) => upsertApps(appsData, tx))
    }

    // Deduplicate by ID - keep the last occurrence (most recent data)
    const deduped = Array.from(
      new Map(appsData.map((app) => [app.id, app])).values(),
    )
    if (deduped.length !== appsData.length) {
      console.warn(
        `[APP] Deduplicated ${appsData.length - deduped.length} duplicate app IDs`,
      )
    }

    const BATCH_SIZE = 100
    const now = new Date()
    const allResults: AppRecord[] = []
    let revivedCount = 0

    // Process in batches to avoid PostgreSQL parameter limit
    for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
      const batch = deduped.slice(i, i + BATCH_SIZE)
      const batchIds = batch.map((app) => app.id)

      // Pre-query currently deleted apps in this batch; they are the ones
      // about to revive (deleted true -> false)
      const deletedRows = await executor
        .select({id: appsTable.id})
        .from(appsTable)
        .where(
          and(inArray(appsTable.id, batchIds), eq(appsTable.deleted, true)),
        )
      const revivedIds = computeRevivedAppIds(
        batchIds,
        deletedRows.map((row) => row.id),
      )

      const values = batch.map((app) => ({
        ...app,
        updatedAt: now,
        lastSyncedAt: now,
        deleted: false, // Listed apps are active, including newly inserted rows.
      }))

      const results = await executor
        .insert(appsTable)
        .values(values)
        .onConflictDoUpdate({
          target: appsTable.id,
          set: {
            profileId: sql`EXCLUDED.profile_id`,
            appName: sql`EXCLUDED.app_name`,
            appConfigType: sql`EXCLUDED.app_config_type`,
            contractAddress: sql`EXCLUDED.contract_address`,
            domain: sql`EXCLUDED.domain`,
            dstackVersion: sql`EXCLUDED.dstack_version`,
            workspaceId: sql`EXCLUDED.workspace_id`,
            creatorId: sql`EXCLUDED.creator_id`,
            chainId: sql`EXCLUDED.chain_id`,
            kmsContractAddress: sql`EXCLUDED.kms_contract_address`,
            baseImage: sql`EXCLUDED.base_image`,
            tproxyBaseDomain: sql`EXCLUDED.tproxy_base_domain`,
            gatewayDomainSuffix: sql`EXCLUDED.gateway_domain_suffix`,
            isPublic: sql`EXCLUDED.is_public`,
            username: sql`EXCLUDED.username`,
            email: sql`EXCLUDED.email`,
            customUser: sql`EXCLUDED.custom_user`,
            updatedAt: sql`EXCLUDED.updated_at`,
            lastSyncedAt: sql`EXCLUDED.last_synced_at`,
            deleted: sql`false`, // Reset deleted flag when app reappears in upstream
          },
          // Sync timestamps are metadata, not business changes. Null-safe
          // comparisons ensure transitions to/from NULL are counted as changes.
          setWhere: sql`${appsTable.profileId} IS DISTINCT FROM EXCLUDED.profile_id
            OR ${appsTable.appName} IS DISTINCT FROM EXCLUDED.app_name
            OR ${appsTable.appConfigType} IS DISTINCT FROM EXCLUDED.app_config_type
            OR ${appsTable.contractAddress} IS DISTINCT FROM EXCLUDED.contract_address
            OR ${appsTable.domain} IS DISTINCT FROM EXCLUDED.domain
            OR ${appsTable.dstackVersion} IS DISTINCT FROM EXCLUDED.dstack_version
            OR ${appsTable.workspaceId} IS DISTINCT FROM EXCLUDED.workspace_id
            OR ${appsTable.creatorId} IS DISTINCT FROM EXCLUDED.creator_id
            OR ${appsTable.chainId} IS DISTINCT FROM EXCLUDED.chain_id
            OR ${appsTable.kmsContractAddress} IS DISTINCT FROM EXCLUDED.kms_contract_address
            OR ${appsTable.baseImage} IS DISTINCT FROM EXCLUDED.base_image
            OR ${appsTable.tproxyBaseDomain} IS DISTINCT FROM EXCLUDED.tproxy_base_domain
            OR ${appsTable.gatewayDomainSuffix} IS DISTINCT FROM EXCLUDED.gateway_domain_suffix
            OR ${appsTable.isPublic} IS DISTINCT FROM EXCLUDED.is_public
            OR ${appsTable.username} IS DISTINCT FROM EXCLUDED.username
            OR ${appsTable.email} IS DISTINCT FROM EXCLUDED.email
            OR ${appsTable.customUser} IS DISTINCT FROM EXCLUDED.custom_user
            OR ${appsTable.deleted} IS DISTINCT FROM false`,
        })
        .returning()

      // Clear failed tasks for revived apps so the next tasks tick sees "no
      // tasks" and re-enqueues them instead of waiting out the permanent-
      // failure cooldown (up to 24h).
      const changedIds = new Set(results.map((app) => app.id))
      const changedRevivedIds = revivedIds.filter((id) => changedIds.has(id))
      if (changedRevivedIds.length > 0) {
        await executor
          .delete(verificationTasksTable)
          .where(
            and(
              inArray(verificationTasksTable.appId, changedRevivedIds),
              eq(verificationTasksTable.status, 'failed'),
            ),
          )
        revivedCount += changedRevivedIds.length
      }

      allResults.push(...results)
    }

    return {apps: allResults, revivedCount}
  }

  // Upstream deletion IDs are numeric app_id/profileId, not dstack IDs.
  // Update every matching dstack ID and count only active -> deleted changes.
  const markAppDeleted = async (
    profileId: number,
    executor: DbExecutor = db,
  ): Promise<number> => {
    const deleted = await executor
      .update(appsTable)
      .set({deleted: true, updatedAt: new Date()})
      .where(
        and(eq(appsTable.profileId, profileId), eq(appsTable.deleted, false)),
      )
      .returning({id: appsTable.id})
    return deleted.length
  }

  // Get all apps, optionally within the caller's full-sync transaction.
  const getAllApps = async (executor: DbExecutor = db) => {
    return await executor.select().from(appsTable)
  }

  // Get apps that are valid for verification
  // (have required fields and not deleted)
  const getValidApps = async () => {
    return await db
      .select()
      .from(appsTable)
      .where(
        sql`${appsTable.contractAddress} IS NOT NULL
            AND ${appsTable.contractAddress} != ''
            AND ${appsTable.domain} IS NOT NULL
            AND ${appsTable.domain} != ''
            AND ${appsTable.deleted} = false`,
      )
  }

  // Get valid apps by IDs (batch query with validation)
  const getValidAppsByIds = async (ids: string[]) => {
    if (ids.length === 0) {
      return []
    }

    return await db
      .select()
      .from(appsTable)
      .where(
        and(
          inArray(appsTable.id, ids),
          sql`${appsTable.contractAddress} IS NOT NULL`,
          sql`${appsTable.contractAddress} != ''`,
          sql`${appsTable.domain} IS NOT NULL`,
          sql`${appsTable.domain} != ''`,
          eq(appsTable.deleted, false),
        ),
      )
  }

  // Get apps that need verification.
  // Returns apps that meet basic validation AND any of these conditions:
  // 1. No tasks at all (never verified), OR
  // 2. Latest task is 'completed' and finished more than 24 hours ago, OR
  // 3. Latest task is 'failed' and the error is a permanent/config error
  //    and finished more than 24 hours ago, OR
  // 4. Latest task is 'failed' (transient error) and finished more than 30 minutes ago
  const getAppsNeedingVerification = async () => {
    const oneDayAgo = subDays(new Date(), 1).toISOString()
    const thirtyMinutesAgo = subMinutes(new Date(), 30).toISOString()

    // CTE: Latest task for each app (with row_number approach)
    const latestTaskPerApp = db.$with('latest_task_per_app').as(
      db
        .select({
          appId: verificationTasksTable.appId,
          status: verificationTasksTable.status,
          finishedAt: verificationTasksTable.finishedAt,
          errorMessage: verificationTasksTable.errorMessage,
          rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${verificationTasksTable.appId} ORDER BY ${verificationTasksTable.createdAt} DESC)`.as(
            'rn',
          ),
        })
        .from(verificationTasksTable),
    )

    // Main query - select only apps table columns using getTableColumns
    const appsColumns = getTableColumns(appsTable)

    return await db
      .with(latestTaskPerApp)
      .select(appsColumns)
      .from(appsTable)
      .leftJoin(
        latestTaskPerApp,
        and(
          eq(appsTable.id, latestTaskPerApp.appId),
          eq(latestTaskPerApp.rn, 1), // Only latest task
        ),
      )
      .where(
        and(
          // Basic validation
          sql`${appsTable.contractAddress} IS NOT NULL`,
          sql`${appsTable.contractAddress} != ''`,
          sql`${appsTable.domain} IS NOT NULL`,
          sql`${appsTable.domain} != ''`,
          eq(appsTable.deleted, false),
          // Include if ANY of these conditions is true:
          or(
            sql`${latestTaskPerApp.appId} IS NULL`, // No tasks at all
            and(
              eq(latestTaskPerApp.status, 'completed'),
              lt(latestTaskPerApp.finishedAt, sql`${oneDayAgo}::timestamp`), // Completed >24h ago
            ),
            and(
              eq(latestTaskPerApp.status, 'failed'),
              or(
                ...PERMANENT_FAILURE_PATTERNS.map((pattern) =>
                  like(latestTaskPerApp.errorMessage, `%${pattern}%`),
                ),
              ),
              lt(latestTaskPerApp.finishedAt, sql`${oneDayAgo}::timestamp`), // Permanent failure >24h ago
            ),
            and(
              eq(latestTaskPerApp.status, 'failed'),
              lt(
                latestTaskPerApp.finishedAt,
                sql`${thirtyMinutesAgo}::timestamp`,
              ), // Failed >30min ago
            ),
          ),
        ),
      )
  }

  return {
    getAppById,
    upsertApp,
    upsertApps,
    markAppDeleted,
    getAllApps,
    getValidApps,
    getValidAppsByIds,
    getAppsNeedingVerification,
    getDb: () => db,
  }
}

export type AppService = ReturnType<typeof createAppService>
