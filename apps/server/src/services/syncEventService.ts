import {
  and,
  type DbConnection,
  type DbExecutor,
  desc,
  eq,
  lt,
  type SyncEventRecord,
  syncEventsTable,
} from '@phala/trust-center-db'
import {subDays} from 'date-fns'

export type SyncEventInput = typeof syncEventsTable.$inferInsert
export type SyncEventSource = SyncEventRecord['source']
export type SyncEventResult = SyncEventRecord['result']

// Public audit fields only; never expose internal verification dispatch state.
const auditColumns = {
  id: syncEventsTable.id,
  source: syncEventsTable.source,
  eventId: syncEventsTable.eventId,
  profileCount: syncEventsTable.profileCount,
  deletedProfileCount: syncEventsTable.deletedProfileCount,
  appCount: syncEventsTable.appCount,
  deletedAppCount: syncEventsTable.deletedAppCount,
  rowsChanged: syncEventsTable.rowsChanged,
  result: syncEventsTable.result,
  errorMessage: syncEventsTable.errorMessage,
  receivedAt: syncEventsTable.receivedAt,
  finishedAt: syncEventsTable.finishedAt,
}
export type SyncEventListRecord = Pick<
  SyncEventRecord,
  keyof typeof auditColumns
>

export interface SyncEventListOptions {
  limit?: number
  offset?: number
  source?: SyncEventSource
  result?: SyncEventResult
}

// Drizzle errors can include SQL and bound profile/app data in their message.
// Never persist those messages (or Zod errors containing upstream values).
export function getSyncErrorMessage(error: unknown): string {
  let current = error
  const seen = new Set<unknown>()
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    if ('query' in current || 'params' in current) {
      return 'Database query failed'
    }
    if ('name' in current && current.name === 'ZodError') {
      return 'Upstream response validation failed'
    }
    if ('name' in current && current.name === 'SyntaxError') {
      return 'Upstream response could not be parsed'
    }
    current = 'cause' in current ? current.cause : undefined
  }
  return error instanceof Error
    ? error.message.slice(0, 2000)
    : 'Sync operation failed'
}

function boundedInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)))
}

export function createSyncEventService(db: DbConnection) {
  const record = async (
    input: SyncEventInput,
    executor: DbExecutor = db,
  ): Promise<SyncEventRecord> => {
    const [event] = await executor
      .insert(syncEventsTable)
      .values(input)
      .returning()
    if (!event) throw new Error('Sync audit insert returned no record')
    return event
  }

  const recordFailure = async (
    input: Omit<SyncEventInput, 'result' | 'errorMessage'> & {error: unknown},
    executor: DbExecutor = db,
  ): Promise<SyncEventRecord> => {
    const {error, ...event} = input
    return record(
      {
        ...event,
        result: 'error',
        errorMessage: getSyncErrorMessage(error),
        finishedAt: event.finishedAt ?? new Date(),
      },
      executor,
    )
  }

  const list = async ({
    limit,
    offset,
    source,
    result,
  }: SyncEventListOptions = {}): Promise<SyncEventListRecord[]> => {
    return db
      .select(auditColumns)
      .from(syncEventsTable)
      .where(
        and(
          source === undefined ? undefined : eq(syncEventsTable.source, source),
          result === undefined ? undefined : eq(syncEventsTable.result, result),
        ),
      )
      .orderBy(desc(syncEventsTable.receivedAt), desc(syncEventsTable.id))
      .limit(boundedInteger(limit, 50, 1, 100))
      .offset(boundedInteger(offset, 0, 0, 10000))
  }

  // Retention applies to all audit sources/results, including push event IDs.
  // Push deduplication is deliberately bounded by the audit retention window.
  const cleanup = async (retentionDays = 30): Promise<number> => {
    const deleted = await db
      .delete(syncEventsTable)
      .where(lt(syncEventsTable.receivedAt, subDays(new Date(), retentionDays)))
      .returning({id: syncEventsTable.id})
    return deleted.length
  }

  return {record, recordFailure, list, cleanup}
}

export type SyncEventService = ReturnType<typeof createSyncEventService>
