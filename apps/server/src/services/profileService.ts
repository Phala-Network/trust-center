import {
  and,
  createDbConnection,
  type DbConnection,
  type DbExecutor,
  eq,
  inArray,
  type ProfileEntityType,
  profilesTable,
  sql,
  type UpstreamProfileData,
  UpstreamProfileDataSchema,
} from '@phala/trust-center-db'

export interface ProfileService {
  upsertProfiles: (
    profiles: UpstreamProfileData[],
    executor?: DbExecutor,
  ) => Promise<number>
  deleteProfile: (
    entityType: ProfileEntityType,
    entityId: number,
    executor?: DbExecutor,
  ) => Promise<number>
  syncProfiles: (
    profiles: UpstreamProfileData[],
    executor?: DbExecutor,
  ) => Promise<{upserted: number; deleted: number}>
}

const BATCH_SIZE = 1000

// Validate and keep the last row for each entity, avoiding duplicate conflicts.
function validateProfiles(profiles: UpstreamProfileData[]) {
  const upstreamMap = new Map<string, UpstreamProfileData>()
  let skippedCount = 0

  for (let index = 0; index < profiles.length; index++) {
    const result = UpstreamProfileDataSchema.safeParse(profiles[index])
    if (!result.success) {
      console.warn(
        `[PROFILE] Skipping invalid profile at index ${index}:`,
        result.error.format(),
      )
      skippedCount++
      continue
    }
    const profile = result.data
    upstreamMap.set(`${profile.entity_type}:${profile.entity_id}`, profile)
  }

  if (skippedCount > 0) {
    console.warn(
      `[PROFILE] Skipped ${skippedCount} invalid profiles out of ${profiles.length}`,
    )
  }

  return upstreamMap
}

export function createProfileService(
  databaseUrl: string = process.env.DATABASE_URL || '',
): ProfileService {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  const db: DbConnection = createDbConnection(databaseUrl)

  const upsertValidatedProfiles = async (
    profiles: UpstreamProfileData[],
    executor: DbExecutor,
  ): Promise<number> => {
    const values = profiles.map((p) => ({
      id: `${p.entity_type}:${p.entity_id}`,
      entityType: p.entity_type,
      entityId: p.entity_id,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      description: p.description,
      customDomain: p.custom_domain,
      updatedAt: p.updated_at ? new Date(p.updated_at) : null,
    }))
    let changed = 0

    // Stay below the PostgreSQL parameter limit, including large snapshots.
    for (let i = 0; i < values.length; i += BATCH_SIZE) {
      const results = await executor
        .insert(profilesTable)
        .values(values.slice(i, i + BATCH_SIZE))
        .onConflictDoUpdate({
          target: [profilesTable.entityType, profilesTable.entityId],
          set: {
            displayName: sql`EXCLUDED.display_name`,
            avatarUrl: sql`EXCLUDED.avatar_url`,
            description: sql`EXCLUDED.description`,
            customDomain: sql`EXCLUDED.custom_domain`,
            updatedAt: sql`EXCLUDED.updated_at`,
          },
          setWhere: sql`${profilesTable.displayName} IS DISTINCT FROM EXCLUDED.display_name
            OR ${profilesTable.avatarUrl} IS DISTINCT FROM EXCLUDED.avatar_url
            OR ${profilesTable.description} IS DISTINCT FROM EXCLUDED.description
            OR ${profilesTable.customDomain} IS DISTINCT FROM EXCLUDED.custom_domain
            OR ${profilesTable.updatedAt} IS DISTINCT FROM EXCLUDED.updated_at`,
        })
        .returning({id: profilesTable.id})
      changed += results.length
    }

    return changed
  }

  // Partial writes never delete profiles absent from the supplied list.
  const upsertProfiles = async (
    profiles: UpstreamProfileData[],
    executor?: DbExecutor,
  ): Promise<number> => {
    const validated = Array.from(validateProfiles(profiles).values())
    if (validated.length === 0) return 0
    if (executor) return upsertValidatedProfiles(validated, executor)
    return db.transaction((tx) => upsertValidatedProfiles(validated, tx))
  }

  const deleteProfile = async (
    entityType: ProfileEntityType,
    entityId: number,
    executor: DbExecutor = db,
  ): Promise<number> => {
    const deleted = await executor
      .delete(profilesTable)
      .where(
        and(
          eq(profilesTable.entityType, entityType),
          eq(profilesTable.entityId, entityId),
        ),
      )
      .returning({id: profilesTable.id})
    return deleted.length
  }

  // Only complete snapshots reconcile missing entities. Preserve the existing
  // empty/all-invalid snapshot guard so upstream failures cannot wipe profiles.
  const syncProfiles = async (
    profiles: UpstreamProfileData[],
    executor?: DbExecutor,
  ): Promise<{upserted: number; deleted: number}> => {
    if (profiles.length === 0) {
      console.warn('[PROFILE] No profiles to sync, skipping sync')
      return {upserted: 0, deleted: 0}
    }

    const upstreamMap = validateProfiles(profiles)
    if (upstreamMap.size === 0) {
      console.warn(
        '[PROFILE] No valid profiles after validation, skipping sync',
      )
      return {upserted: 0, deleted: 0}
    }

    const reconcile = async (tx: DbExecutor) => {
      const existingProfiles = await tx
        .select({
          id: profilesTable.id,
          entityType: profilesTable.entityType,
          entityId: profilesTable.entityId,
        })
        .from(profilesTable)
      const toDelete = existingProfiles
        .filter((p) => !upstreamMap.has(`${p.entityType}:${p.entityId}`))
        .map((p) => p.id)
      let deleted = 0

      for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
        const results = await tx
          .delete(profilesTable)
          .where(inArray(profilesTable.id, toDelete.slice(i, i + BATCH_SIZE)))
          .returning({id: profilesTable.id})
        deleted += results.length
      }

      const upserted = await upsertValidatedProfiles(
        Array.from(upstreamMap.values()),
        tx,
      )
      console.log(
        `[PROFILE] Profile sync completed: ${upserted} profiles changed (${deleted} deleted)`,
      )
      return {upserted, deleted}
    }

    return executor ? reconcile(executor) : db.transaction(reconcile)
  }

  return {
    upsertProfiles,
    deleteProfile,
    syncProfiles,
  }
}
