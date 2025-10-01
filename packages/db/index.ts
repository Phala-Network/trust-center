import { drizzle } from 'drizzle-orm/node-postgres'

let db: ReturnType<typeof drizzle> | undefined

export function createDbConnection(databaseUrl: string) {
  if (!db) {
    db = drizzle(databaseUrl, { casing: 'snake_case' })
  }
  return db
}

export type DbConnection = ReturnType<typeof createDbConnection>
