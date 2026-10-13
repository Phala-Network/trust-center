import {
  and,
  type DbConnection,
  eq,
  isNull,
  lt,
  or,
  sql,
  syncEventsTable,
} from '@phala/trust-center-db'

import type {PhalaCloudPush} from '../types/phalaCloudWebhook'
import type {AppService} from './appService'
import type {ProfileService} from './profileService'
import {convertToAppRecord, type SyncService} from './syncService'

// Shared with full reconciliation: no local push/full-sync mutations interleave.
const APPLY_LOCK = 74190311

export function createPhalaCloudIngestService(config: {
  db: DbConnection
  profileService: ProfileService
  appService: AppService
  syncSelectedTasks: SyncService['syncSelectedTasks']
}) {
  const {db, profileService, appService} = config

  // Claim with a lease, never hold a DB connection/transaction while calling Redis.
  // A crash releases the claim after two minutes; successful per-app dispatches are
  // durably receipted so recovery does not depend on verification task retention.
  const dispatch = async (eventId: string) => {
    const claimId = crypto.randomUUID()
    const [event] = await db
      .update(syncEventsTable)
      .set({
        verificationClaimId: claimId,
        verificationClaimedAt: new Date(),
      })
      .where(
        and(
          eq(syncEventsTable.eventId, eventId),
          eq(syncEventsTable.verificationPending, true),
          or(
            isNull(syncEventsTable.verificationClaimedAt),
            lt(
              syncEventsTable.verificationClaimedAt,
              new Date(Date.now() - 120000),
            ),
          ),
        ),
      )
      .returning()
    if (!event) return
    const claim = and(
      eq(syncEventsTable.id, event.id),
      eq(syncEventsTable.verificationClaimId, claimId),
    )
    try {
      const sent = new Set(event.verificationDispatchedAppIds)
      await config.syncSelectedTasks(
        event.verificationAppIds.filter((id) => !sent.has(id)),
        eventId,
        async (appId) => {
          await db
            .update(syncEventsTable)
            .set({
              verificationDispatchedAppIds: sql`${syncEventsTable.verificationDispatchedAppIds} || jsonb_build_array(${appId}::text)`,
            })
            .where(eq(syncEventsTable.id, event.id))
        },
      )
      await db
        .update(syncEventsTable)
        .set({
          verificationPending: false,
          verificationClaimId: null,
          verificationClaimedAt: null,
          result: 'success',
          errorMessage: null,
          finishedAt: new Date(),
        })
        .where(claim)
    } catch (error) {
      await db
        .update(syncEventsTable)
        .set({verificationClaimId: null, verificationClaimedAt: null})
        .where(claim)
      throw error
    }
  }

  const dispatchWithAudit = async (eventId: string) => {
    try {
      await dispatch(eventId)
    } catch (error) {
      await db
        .update(syncEventsTable)
        .set({
          result: 'error',
          errorMessage: 'Verification dispatch failed',
          finishedAt: new Date(),
        })
        .where(
          and(
            eq(syncEventsTable.eventId, eventId),
            eq(syncEventsTable.verificationPending, true),
          ),
        )
      throw error
    }
  }

  const ingest = async (
    body: PhalaCloudPush,
  ): Promise<{duplicate: boolean}> => {
    const receivedAt = new Date()
    const counts = {
      profileCount: body.profiles.length,
      deletedProfileCount: body.deleted_profiles.length,
      appCount: body.apps.length,
      deletedAppCount: body.deleted_apps.length,
    }
    let duplicate: boolean
    try {
      duplicate = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${APPLY_LOCK})`)
        const [previous] = await tx
          .select()
          .from(syncEventsTable)
          .where(eq(syncEventsTable.eventId, body.event_id))
        if (
          previous &&
          (previous.result === 'success' || previous.verificationPending)
        )
          return true
        const appRecords = body.apps.map(convertToAppRecord)
        let rowsChanged = await profileService.upsertProfiles(body.profiles, tx)
        for (const p of body.deleted_profiles) {
          rowsChanged += await profileService.deleteProfile(
            p.entity_type,
            p.entity_id,
            tx,
          )
        }
        rowsChanged += (await appService.upsertApps(appRecords, tx)).apps.length
        for (const appId of new Set(body.deleted_apps)) {
          rowsChanged += await appService.markAppDeleted(appId, tx)
        }
        const ids = [...new Set(appRecords.map((app) => app.id))]
        const values = {
          source: 'push' as const,
          eventId: body.event_id,
          ...counts,
          rowsChanged,
          result: ids.length ? ('pending' as const) : ('success' as const),
          errorMessage: null,
          receivedAt,
          finishedAt: ids.length ? null : new Date(),
          verificationAppIds: ids,
          verificationPending: ids.length > 0,
        }
        await tx.insert(syncEventsTable).values(values).onConflictDoUpdate({
          target: syncEventsTable.eventId,
          set: values,
        })
        return false
      })
    } catch (error) {
      // Outside the failed transaction. Do not overwrite a concurrent successful retry.
      await db
        .insert(syncEventsTable)
        .values({
          source: 'push',
          eventId: body.event_id,
          ...counts,
          result: 'error',
          errorMessage: 'Database apply failed',
          receivedAt,
          finishedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: syncEventsTable.eventId,
          set: {
            result: 'error',
            errorMessage: 'Database apply failed',
            finishedAt: new Date(),
          },
          setWhere: and(
            eq(syncEventsTable.verificationPending, false),
            eq(syncEventsTable.result, 'error'),
          ),
        })
      throw error
    }
    await dispatchWithAudit(body.event_id)
    return {duplicate}
  }

  // Run periodically: sender retries alone cannot cover a crash after the sender
  // abandons delivery. The persisted row contains all IDs needed for recovery.
  const retryPending = async () => {
    const events = await db
      .select({eventId: syncEventsTable.eventId})
      .from(syncEventsTable)
      .where(
        and(
          eq(syncEventsTable.verificationPending, true),
          or(
            isNull(syncEventsTable.verificationClaimedAt),
            lt(
              syncEventsTable.verificationClaimedAt,
              new Date(Date.now() - 120000),
            ),
          ),
        ),
      )
      .orderBy(syncEventsTable.receivedAt)
      .limit(20)
    for (const event of events) {
      if (event.eventId) {
        try {
          await dispatchWithAudit(event.eventId)
        } catch {
          console.error('[INGEST] Pending verification dispatch failed')
        }
      }
    }
  }
  return {ingest, retryPending}
}

export type PhalaCloudIngestService = ReturnType<
  typeof createPhalaCloudIngestService
>
