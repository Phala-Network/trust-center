import {drizzle} from 'drizzle-orm/node-postgres'

let db: ReturnType<typeof drizzle> | undefined

export function createDbConnection(databaseUrl: string) {
  if (!db) {
    db = drizzle(databaseUrl, {casing: 'snake_case'})
  }
  return db
}

export type DbConnection = ReturnType<typeof createDbConnection>

export type {Task, TaskCreateRequest, VerificationFlags} from './schema'
// Re-export schemas and types from schema.ts
export {
  AppConfigTypeSchema,
  TaskCreateRequestSchema,
  TaskSchema,
  VerificationFlagsSchema,
  VerificationTaskStatusSchema,
} from './schema'
