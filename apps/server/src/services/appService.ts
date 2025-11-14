import {
  and,
  appsTable,
  createDbConnection,
  type DbConnection,
  eq,
  getTableColumns,
  lt,
  type NewAppRecord,
  or,
  sql,
  verificationTasksTable,
} from '@phala/trust-center-db'
import {subDays, subMinutes} from 'date-fns'

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
  const upsertApps = async (appsData: NewAppRecord[]) => {
    if (appsData.length === 0) {
      return []
    }

    const now = new Date()
    const values = appsData.map((app) => ({
      ...app,
      updatedAt: now,
      lastSyncedAt: now,
    }))

    // Use PostgreSQL's ON CONFLICT to upsert all apps in a single query
    const results = await db
      .insert(appsTable)
      .values(values)
      .onConflictDoUpdate({
        target: appsTable.id, // Conflict on primary key (dstack app ID)
        set: {
          profileId: sql`EXCLUDED.profile_id`,
          appName: sql`EXCLUDED.app_name`,
          appConfigType: sql`EXCLUDED.app_config_type`,
          contractAddress: sql`EXCLUDED.contract_address`,
          modelOrDomain: sql`EXCLUDED.model_or_domain`,
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
        },
      })
      .returning()

    return results
  }

  // Get all apps
  const getAllApps = async () => {
    return await db.select().from(appsTable)
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
            AND ${appsTable.modelOrDomain} IS NOT NULL
            AND ${appsTable.modelOrDomain} != ''
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
        sql`${appsTable.id} = ANY(${ids})
            AND ${appsTable.contractAddress} IS NOT NULL
            AND ${appsTable.contractAddress} != ''
            AND ${appsTable.modelOrDomain} IS NOT NULL
            AND ${appsTable.modelOrDomain} != ''
            AND ${appsTable.deleted} = false`,
      )
  }

  // Get apps that need verification
  // Returns apps that meet basic validation AND any of these conditions:
  // 1. Latest task is 'completed' and older than 24 hours, OR
  // 2. No tasks at all (never verified), OR
  // 3. Latest task is 'failed' and older than 30 minutes
  const getAppsNeedingVerification = async () => {
    const oneDayAgo = subDays(new Date(), 1)
    const thirtyMinutesAgo = subMinutes(new Date(), 30)

    // CTE: Latest task for each app (with row_number approach)
    const latestTaskPerApp = db.$with('latest_task_per_app').as(
      db
        .select({
          appId: verificationTasksTable.appId,
          status: verificationTasksTable.status,
          createdAt: verificationTasksTable.createdAt,
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
          sql`${appsTable.modelOrDomain} IS NOT NULL`,
          sql`${appsTable.modelOrDomain} != ''`,
          eq(appsTable.deleted, false),
          // Include if ANY of these conditions is true:
          or(
            sql`${latestTaskPerApp.appId} IS NULL`, // No tasks at all
            and(
              eq(latestTaskPerApp.status, 'completed'),
              sql`${latestTaskPerApp.createdAt} < ${oneDayAgo}`, // Completed but old
            ),
            and(
              eq(latestTaskPerApp.status, 'failed'),
              sql`${latestTaskPerApp.createdAt} < ${thirtyMinutesAgo}`, // Failed and old
            ),
          ),
        ),
      )
  }

  return {
    getAppById,
    upsertApp,
    upsertApps,
    getAllApps,
    getValidApps,
    getValidAppsByIds,
    getAppsNeedingVerification,
    getDb: () => db,
  }
}

export type AppService = ReturnType<typeof createAppService>
