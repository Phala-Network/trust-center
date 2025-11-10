import {
  and,
  createDbConnection,
  eq,
  inArray,
  profilesTable,
  sql,
  type DbConnection,
  type ProfileEntityType,
} from '@phala/trust-center-db'

export interface ProfileData {
  entityType: ProfileEntityType
  entityId: number
  displayName: string | null
  avatarUrl: string | null
  description: string | null
  customDomain: string | null
  createdAt: string
  updatedAt: string | null
}

export interface ProfileService {
  syncProfiles: (profiles: ProfileData[]) => Promise<void>
}

export function createProfileService(
  databaseUrl: string = process.env.DATABASE_URL || '',
): ProfileService {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  const db: DbConnection = createDbConnection(databaseUrl)

  /**
   * Sync profiles using full sync strategy (upsert + delete stale records)
   * This ensures database is exactly in sync with upstream Metabase data
   */
  const syncProfiles = async (profiles: ProfileData[]): Promise<void> => {
    if (profiles.length === 0) {
      console.warn('[PROFILE] No profiles to sync, skipping sync')
      return
    }

    console.log(`[PROFILE] Starting full sync for ${profiles.length} profiles`)

    // Build composite keys map for upstream profiles
    const upstreamMap = new Map<string, ProfileData>()
    for (const profile of profiles) {
      const key = `${profile.entityType}:${profile.entityId}`
      upstreamMap.set(key, profile)
    }

    console.log(`[PROFILE] Processing ${upstreamMap.size} unique profiles`)

    // Fetch all existing profiles in one query
    const existingProfiles = await db.select().from(profilesTable)
    console.log(`[PROFILE] Found ${existingProfiles.length} existing profiles`)

    // Identify stale profiles (exist in DB but not in upstream)
    const toDelete = existingProfiles
      .filter((p) => !upstreamMap.has(`${p.entityType}:${p.entityId}`))
      .map((p) => p.id)

    // Delete stale profiles if any
    if (toDelete.length > 0) {
      await db.delete(profilesTable).where(inArray(profilesTable.id, toDelete))
      console.log(`[PROFILE] Deleted ${toDelete.length} stale profiles`)
    }

    // Prepare values for upsert (insert new + update existing)
    const values = Array.from(upstreamMap.values()).map((p) => ({
      id: `${p.entityType}:${p.entityId}`,
      entityType: p.entityType,
      entityId: p.entityId,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      description: p.description,
      customDomain: p.customDomain,
      updatedAt: new Date(p.updatedAt),
    }))

    // Upsert all profiles in one operation
    await db
      .insert(profilesTable)
      .values(values)
      .onConflictDoUpdate({
        target: [profilesTable.entityType, profilesTable.entityId],
        set: {
          displayName: sql`EXCLUDED.display_name`,
          avatarUrl: sql`EXCLUDED.avatar_url`,
          description: sql`EXCLUDED.description`,
          customDomain: sql`EXCLUDED.custom_domain`,
          updatedAt: sql`EXCLUDED.updated_at`,
        },
      })

    console.log(
      `[PROFILE] Synced ${values.length} profiles (${toDelete.length} deleted)`,
    )
  }

  return {
    syncProfiles,
  }
}
