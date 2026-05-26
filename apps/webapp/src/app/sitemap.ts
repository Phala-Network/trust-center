import {
  and,
  appsTable,
  createDbConnection,
  eq,
  sql,
  verificationTasksTable,
} from '@phala/trust-center-db'
import type {MetadataRoute} from 'next'

import {env} from '@/env'
import {getUsers} from '@/lib/db'

export const revalidate = 3600

const db = createDbConnection(env.DATABASE_POSTGRES_URL)
const baseUrl = 'https://trust.phala.com'

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const latestTasks = db.$with('latest_tasks').as(
    db
      .select({
        appId: verificationTasksTable.appId,
        lastCompletedAt: sql<Date>`max(${verificationTasksTable.createdAt})`.as(
          'lastCompletedAt',
        ),
      })
      .from(verificationTasksTable)
      .where(eq(verificationTasksTable.status, 'completed'))
      .groupBy(verificationTasksTable.appId),
  )

  const results = await db
    .with(latestTasks)
    .select({
      id: appsTable.id,
      lastCompletedAt: latestTasks.lastCompletedAt,
    })
    .from(appsTable)
    .innerJoin(latestTasks, eq(appsTable.id, latestTasks.appId))
    .where(and(eq(appsTable.isPublic, true), eq(appsTable.deleted, false)))

  const appPages: MetadataRoute.Sitemap = results.map((app) => ({
    url: `${baseUrl}/app/${app.id}`,
    lastModified: toDate(app.lastCompletedAt),
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  const builders = await getUsers()
  const builderPages: MetadataRoute.Sitemap = builders.map((builder) => ({
    url: `${baseUrl}/${builder.user}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  return [
    {
      url: baseUrl,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    ...builderPages,
    ...appPages,
  ]
}
