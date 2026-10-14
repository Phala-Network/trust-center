import {
  and,
  type DbConnection,
  type DbExecutor,
  eq,
  sql,
  syncEventsTable,
} from '@phala/trust-center-db'

import type {PhalaCloudPush} from '../types/phalaCloudWebhook'
import type {AppService} from './appService'
import type {ProfileService} from './profileService'
import {convertToAppRecord, type SyncService} from './syncService'

const APPLY_LOCK = 74190311

export class PhalaCloudIngestBusyError extends Error {
  constructor() {
    super('Database lock wait timed out; retry the same event_id')
    this.name = 'PhalaCloudIngestBusyError'
  }
}

function isLockTimeout(error: unknown): boolean {
  for (
    let depth = 0;
    depth < 5 && error && typeof error === 'object';
    depth++
  ) {
    if ('code' in error && error.code === '55P03') return true
    error = 'cause' in error ? error.cause : undefined
  }
  return false
}

export function createPhalaCloudIngestService(config: {
  db: DbConnection
  profileService: ProfileService
  appService: AppService
  syncSelectedTasks: SyncService['syncSelectedTasks']
}) {
  const {db, profileService, appService} = config

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
    // A lost HTTP acknowledgement must not make an already committed retry
    // wait behind a full snapshot. The locked check below still closes races.
    const [committed] = await db
      .select({id: syncEventsTable.id})
      .from(syncEventsTable)
      .where(
        and(
          eq(syncEventsTable.eventId, body.event_id),
          eq(syncEventsTable.result, 'success'),
        ),
      )
      .limit(1)
    if (committed) return {duplicate: true}

    const recordFailure = (executor: DbExecutor, errorMessage: string) =>
      executor
        .insert(syncEventsTable)
        .values({
          source: 'push',
          eventId: body.event_id,
          ...counts,
          result: 'error',
          errorMessage,
          receivedAt,
          finishedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: syncEventsTable.eventId,
          set: {result: 'error', errorMessage, finishedAt: new Date()},
          setWhere: eq(syncEventsTable.result, 'error'),
        })

    let outcome: {duplicate: boolean; busy?: true}
    try {
      outcome = await db.transaction(async (connection) => {
        await connection.execute(sql`SET LOCAL lock_timeout = '5s'`)
        try {
          const duplicate = await connection.transaction(async (tx) => {
            await tx.execute(sql`SELECT pg_advisory_xact_lock(${APPLY_LOCK})`)
            const [previous] = await tx
              .select()
              .from(syncEventsTable)
              .where(eq(syncEventsTable.eventId, body.event_id))
            if (previous?.result === 'success') return true
            const appRecords = body.apps.map(convertToAppRecord)
            let rowsChanged = await profileService.upsertProfiles(
              body.profiles,
              tx,
            )
            for (const p of body.deleted_profiles) {
              rowsChanged += await profileService.deleteProfile(
                p.entity_type,
                p.entity_id,
                tx,
              )
            }
            rowsChanged += (await appService.upsertApps(appRecords, tx)).apps
              .length
            for (const appId of new Set(body.deleted_apps)) {
              rowsChanged += await appService.markAppDeleted(appId, tx)
            }
            const values = {
              source: 'push' as const,
              eventId: body.event_id,
              ...counts,
              rowsChanged,
              result: 'success' as const,
              errorMessage: null,
              receivedAt,
              finishedAt: new Date(),
            }
            await tx.insert(syncEventsTable).values(values).onConflictDoUpdate({
              target: syncEventsTable.eventId,
              set: values,
            })
            return false
          })
          return {duplicate}
        } catch (error) {
          if (!isLockTimeout(error)) throw error
          // Rollback to the savepoint removed every apply write. Audit on this
          // already-owned connection: rejoining a saturated pool delays 503s.
          await recordFailure(
            connection,
            new PhalaCloudIngestBusyError().message,
          )
          return {duplicate: false, busy: true as const}
        }
      })
    } catch (error) {
      await recordFailure(db, 'Database apply failed')
      throw error
    }
    if (outcome.busy) throw new PhalaCloudIngestBusyError()
    const {duplicate} = outcome

    if (!duplicate && body.apps.length > 0) {
      // The event is already committed. Verification is only a best-effort hint;
      // the ordinary task cron supplies recovery, including push-only deployments.
      // Do not delay the HTTP acknowledgement on Redis readiness or retry entities.
      void (async () => {
        try {
          await config.syncSelectedTasks([
            ...new Set(body.apps.map((app) => app.dstack_app_id)),
          ])
        } catch (error) {
          console.error(
            '[INGEST] Verification enqueue failed; task cron will retry:',
            error,
          )
          try {
            await db
              .update(syncEventsTable)
              .set({
                errorMessage:
                  'Verification enqueue failed; task cron will retry',
              })
              .where(
                and(
                  eq(syncEventsTable.eventId, body.event_id),
                  eq(syncEventsTable.result, 'success'),
                ),
              )
          } catch (auditError) {
            console.error(
              '[INGEST] Could not record verification warning:',
              auditError,
            )
          }
        }
      })()
    }
    return {duplicate}
  }
  return {ingest}
}

export type PhalaCloudIngestService = ReturnType<
  typeof createPhalaCloudIngestService
>
