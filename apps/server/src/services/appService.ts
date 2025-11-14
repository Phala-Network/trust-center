import {
  appsTable,
  createDbConnection,
  type DbConnection,
  eq,
  type NewAppRecord,
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

  // Batch upsert apps
  const upsertApps = async (appsData: NewAppRecord[]) => {
    const results = await Promise.all(appsData.map((app) => upsertApp(app)))
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
