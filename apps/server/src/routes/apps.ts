import { Elysia } from 'elysia'
import { z } from 'zod'

import {
  handleAppDetail,
  handleAppsList,
  handleAppTasks,
} from './apps/handlers'
import {
  AppDetailDataSchema,
  AppsListDataSchema,
  AppsListQuerySchema,
  AppTasksDataSchema,
  AppTasksQuerySchema,
  ErrorResponseSchema,
} from './tasks/schemas'
import { createErrorResponse, getErrorStatusCode } from './tasks/utils'

// Main apps routes
export const appsRoutes = new Elysia({ tags: ['Apps'] })
  // List all unique apps
  .get(
    '/',
    async ({ query, set }) => {
      try {
        return await handleAppsList(query)
      } catch (error) {
        set.status = getErrorStatusCode(error)
        return createErrorResponse(error, 'Failed to list apps')
      }
    },
    {
      query: AppsListQuerySchema,
      response: z.union([AppsListDataSchema, ErrorResponseSchema]),
      detail: {
        summary: 'List latest tasks for unique applications',
        description:
          'Retrieves a paginated list of the latest verification task for each unique application with optional filtering by app type and search keywords.',
        tags: ['Apps'],
      },
    },
  )
  // Get app details
  .get(
    '/:appId',
    async ({ params, set }) => {
      try {
        return await handleAppDetail(params.appId)
      } catch (error) {
        set.status = getErrorStatusCode(error)
        return createErrorResponse(error, 'Failed to get app details')
      }
    },
    {
      params: z.object({
        appId: z.string(),
      }),
      response: z.union([AppDetailDataSchema, ErrorResponseSchema]),
      detail: {
        summary: 'Get latest task for application',
        description:
          'Retrieves the latest verification task for a specific application.',
        tags: ['Apps'],
      },
    },
  )
  // Get app tasks
  .get(
    '/:appId/tasks',
    async ({ params, query, set }) => {
      try {
        return await handleAppTasks(params.appId, query)
      } catch (error) {
        set.status = getErrorStatusCode(error)
        return createErrorResponse(error, 'Failed to get app tasks')
      }
    },
    {
      params: z.object({
        appId: z.string(),
      }),
      query: AppTasksQuerySchema,
      response: z.union([AppTasksDataSchema, ErrorResponseSchema]),
      detail: {
        summary: 'Get application tasks',
        description:
          'Retrieves a paginated list of verification tasks for a specific application with optional filtering by status and date range.',
        tags: ['Apps'],
      },
    },
  )
