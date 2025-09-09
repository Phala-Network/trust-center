import { Elysia, t } from 'elysia'

import {
  handleBatchCreation,
  handleTaskCancellation,
  handleTaskCreation,
  handleTaskStats,
  handleTaskStatus,
  handleTasksList,
} from './tasks/handlers'
// Import schemas and handlers from modular files
import {
  ErrorResponseSchema,
  TaskBatchCreateRequestSchema,
  TaskBatchCreateResponseSchema,
  TaskCancelResponseSchema,
  TaskCreateRequestSchema,
  TaskCreateResponseSchema,
  TaskDetailResponseSchema,
  TaskListQuerySchema,
  TaskListResponseSchema,
  TaskStatsResponseSchema,
} from './tasks/schemas'
import { createErrorResponse, getErrorStatusCode } from './tasks/utils'

// Main task routes
export const taskRoutes = new Elysia({ tags: ['Tasks'] })
  // Create single task
  .post(
    '/',
    async ({ body, set }) => {
      try {
        return await handleTaskCreation(body)
      } catch (error) {
        set.status = getErrorStatusCode(error)
        return createErrorResponse(error, 'Failed to create task')
      }
    },
    {
      body: TaskCreateRequestSchema,
      response: t.Union([TaskCreateResponseSchema, ErrorResponseSchema]),
      detail: {
        summary: 'Create a new verification task',
        description:
          'Creates a single verification task for an application. The task will be queued for processing and verification according to the specified flags.',
        tags: ['Tasks'],
      },
    },
  )
  // Create batch tasks
  .post(
    '/batch',
    async ({ body, set }) => {
      try {
        return await handleBatchCreation(body)
      } catch (error) {
        set.status = getErrorStatusCode(error)
        return createErrorResponse(error, 'Failed to create batch tasks')
      }
    },
    {
      body: TaskBatchCreateRequestSchema,
      response: t.Union([TaskBatchCreateResponseSchema, ErrorResponseSchema]),
      detail: {
        summary: 'Create multiple verification tasks in batch',
        description:
          'Creates multiple verification tasks at once for efficient bulk processing. Each task in the batch will be queued independently.',
        tags: ['Tasks'],
      },
    },
  )
  // Get single task
  .get(
    '/:taskId',
    async ({ params, set }) => {
      try {
        return await handleTaskStatus(params.taskId)
      } catch (error) {
        set.status = getErrorStatusCode(error)
        return createErrorResponse(error, 'Failed to get task status')
      }
    },
    {
      params: t.Object({
        taskId: t.String(),
      }),
      response: t.Union([TaskDetailResponseSchema, ErrorResponseSchema]),
      detail: {
        summary: 'Get task details by ID',
        description:
          'Retrieves detailed information about a specific verification task including its current status, progress, and metadata.',
        tags: ['Tasks'],
      },
    },
  )
  // Get task list
  .get(
    '/',
    async ({ query, set }) => {
      try {
        return await handleTasksList(query)
      } catch (error) {
        set.status = getErrorStatusCode(error)
        return createErrorResponse(error, 'Failed to list tasks')
      }
    },
    {
      query: TaskListQuerySchema,
      response: t.Union([TaskListResponseSchema, ErrorResponseSchema]),
      detail: {
        summary: 'List verification tasks',
        description:
          'Retrieves a paginated list of verification tasks with optional filtering by status, app type, and search keywords. Supports sorting and pagination.',
        tags: ['Tasks'],
      },
    },
  )
  // Get task stats
  .get(
    '/stats/summary',
    async ({ set }) => {
      try {
        return await handleTaskStats()
      } catch (error) {
        set.status = getErrorStatusCode(error)
        return createErrorResponse(error, 'Failed to get task stats')
      }
    },
    {
      response: t.Union([TaskStatsResponseSchema, ErrorResponseSchema]),
      detail: {
        summary: 'Get task statistics summary',
        description:
          'Retrieves aggregated statistics about verification tasks including counts by status, processing times, and other metrics.',
        tags: ['Tasks'],
      },
    },
  )
  // Cancel task
  .delete(
    '/:taskId',
    async ({ params, set }) => {
      try {
        return await handleTaskCancellation(params.taskId)
      } catch (error) {
        set.status = getErrorStatusCode(error)
        return createErrorResponse(error, 'Failed to cancel task')
      }
    },
    {
      params: t.Object({
        taskId: t.String(),
      }),
      response: t.Union([TaskCancelResponseSchema, ErrorResponseSchema]),
      detail: {
        summary: 'Cancel a verification task',
        description:
          'Cancels a running or pending verification task. Only tasks that are not yet completed can be cancelled.',
        tags: ['Tasks'],
      },
    },
  )
