import {
  createDbConnection,
  type DbConnection,
  eq,
  inArray,
  profilesTable,
  sql,
  type UpstreamProfileData,
  UpstreamProfileDataSchema,
} from '@phala/trust-center-db'

export interface ProfileService {
  syncProfiles: (profiles: UpstreamProfileData[]) => Promise<void>
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
  const syncProfiles = async (
    profiles: UpstreamProfileData[],
  ): Promise<void> => {
    if (profiles.length === 0) {
      console.warn('[PROFILE] No profiles to sync, skipping sync')
      return
    }

    console.log(`[PROFILE] Starting full sync for ${profiles.length} profiles`)

    // Validate all profiles with Zod schema (skip invalid ones with warnings)
    const validatedProfiles: UpstreamProfileData[] = []
    let skippedCount = 0

    for (let index = 0; index < profiles.length; index++) {
      const p = profiles[index]
      const result = UpstreamProfileDataSchema.safeParse(p)
      if (!result.success) {
        console.warn(
          `[PROFILE] Skipping invalid profile at index ${index}:`,
          result.error.format(),
        )
        skippedCount++
        continue
      }
      validatedProfiles.push(result.data)
    }

    if (skippedCount > 0) {
      console.warn(
        `[PROFILE] Skipped ${skippedCount} invalid profiles out of ${profiles.length}`,
      )
    }

    if (validatedProfiles.length === 0) {
      console.warn(
        '[PROFILE] No valid profiles after validation, skipping sync',
      )
      return
    }

    // Build composite keys map for upstream profiles
    const upstreamMap = new Map<string, UpstreamProfileData>()
    for (const profile of validatedProfiles) {
      const key = `${profile.entity_type}:${profile.entity_id}`
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
    // Map snake_case upstream data to camelCase database fields
    const values = Array.from(upstreamMap.values()).map((p) => ({
      id: `${p.entity_type}:${p.entity_id}`,
      entityType: p.entity_type,
      entityId: p.entity_id,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      description: p.description,
      customDomain: p.custom_domain,
      updatedAt: p.updated_at ? new Date(p.updated_at) : null,
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
