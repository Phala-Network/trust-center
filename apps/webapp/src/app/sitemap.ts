import type {MetadataRoute} from 'next'

import {
  and,
  appsTable,
  createDbConnection,
  eq,
  sql,
  verificationTasksTable,
} from '@phala/trust-center-db'

import {env} from '@/env'
import {FEATURED_BUILDERS} from '@/lib/featured-builders'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

const db = createDbConnection(env.DATABASE_POSTGRES_URL)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://trust.phala.com'

  const latestTasks = db.$with('latest_tasks').as(
    db
      .select({
        appId: verificationTasksTable.appId,
        maxCreatedAt: sql<string>`max(${verificationTasksTable.createdAt})`.as(
          'maxCreatedAt',
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
      updatedAt: appsTable.updatedAt,
    })
    .from(appsTable)
    .innerJoin(latestTasks, eq(appsTable.id, latestTasks.appId))
    .where(and(eq(appsTable.isPublic, true), eq(appsTable.deleted, false)))

  const appPages: MetadataRoute.Sitemap = results.map((app) => ({
    url: `${baseUrl}/app/${app.id}`,
    lastModified: app.updatedAt ? new Date(app.updatedAt) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  const builderPages: MetadataRoute.Sitemap = FEATURED_BUILDERS.map(
    (builder) => ({
      url: `${baseUrl}/${builder.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }),
  )

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    ...builderPages,
    ...appPages,
  ]
}
