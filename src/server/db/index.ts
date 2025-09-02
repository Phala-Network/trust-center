import { drizzle } from 'drizzle-orm/bun-sql'

import * as schema from './schema'

let db: ReturnType<typeof drizzle> | undefined

export function createDbConnection(databaseUrl: string) {
  if (!db) {
    db = drizzle(databaseUrl, { schema, casing: 'snake_case' })
  }
  return db
}

export type DbConnection = ReturnType<typeof createDbConnection>
export { schema }

export type {
  AppConfigType,
  VerificationTask,
  VerificationTaskStatus,
} from './schema'
