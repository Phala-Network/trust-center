import {
  appsTable,
  createDbConnection,
  type DbConnection,
  eq,
  type NewAppRecord,
  sql,
} from '@phala/trust-center-db'

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

  return {
    getAppById,
    upsertApp,
    upsertApps,
    getAllApps,
    getDb: () => db,
  }
}

export type AppService = ReturnType<typeof createAppService>
