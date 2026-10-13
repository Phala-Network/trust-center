import {drizzle} from 'drizzle-orm/postgres-js'

let db: ReturnType<typeof drizzle> | undefined

export function createDbConnection(databaseUrl: string) {
  if (!db) {
    db = drizzle(databaseUrl, {casing: 'snake_case'})
  }
  return db
}

export type DbConnection = ReturnType<typeof createDbConnection>
export type DbTransaction = Parameters<
  Parameters<DbConnection['transaction']>[0]
>[0]
export type DbExecutor = DbConnection | DbTransaction

export * from 'drizzle-orm'
export {alias} from 'drizzle-orm/pg-core'

export * from './schema'
