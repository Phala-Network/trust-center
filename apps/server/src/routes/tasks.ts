import { Elysia } from 'elysia'
import { z } from 'zod'

import {
  handleBatchCreation,
  handleTaskCancellation,
  handleTaskCreation,
  handleTaskDelete,
  handleTaskRetry,
  handleTaskStats,
  handleTaskStatus,
  handleTasksList,
} from './tasks/handlers'
// Import schemas and handlers from modular files
import {
  ErrorResponseSchema,
  TaskBatchCreateDataSchema,
  TaskBatchCreateRequestSchema,
  TaskCancelDataSchema,
  TaskCreateDataSchema,
  TaskCreateRequestSchema,
  TaskDeleteDataSchema,
  TaskDetailDataSchema,
  TaskListDataSchema,
  TaskListQuerySchema,
  TaskRetryDataSchema,
  TaskStatsDataSchema,
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
      response: z.union([TaskCreateDataSchema, ErrorResponseSchema]),
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
      response: z.union([TaskBatchCreateDataSchema, ErrorResponseSchema]),
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
      params: z.object({
        taskId: z.string(),
      }),
      response: z.union([TaskDetailDataSchema, ErrorResponseSchema]),
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
      response: z.union([TaskListDataSchema, ErrorResponseSchema]),
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
      response: z.union([TaskStatsDataSchema, ErrorResponseSchema]),
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
      params: z.object({
        taskId: z.string(),
      }),
      response: z.union([TaskCancelDataSchema, ErrorResponseSchema]),
      detail: {
        summary: 'Cancel a verification task',
        description:
          'Cancels a running or pending verification task. Only tasks that are not yet completed can be cancelled.',
        tags: ['Tasks'],
      },
    },
  )
  // Retry task
  .post(
    '/:taskId/retry',
    async ({ params, set }) => {
      try {
        return await handleTaskRetry(params.taskId)
      } catch (error) {
        set.status = getErrorStatusCode(error)
        return createErrorResponse(error, 'Failed to retry task')
      }
    },
    {
      params: z.object({
        taskId: z.string(),
      }),
      response: z.union([TaskRetryDataSchema, ErrorResponseSchema]),
      detail: {
        summary: 'Retry a verification task',
        description:
          'Retries a failed or cancelled verification task by re-adding it to the queue. Only failed or cancelled tasks can be retried.',
        tags: ['Tasks'],
      },
    },
  )
  // Delete task
  .delete(
    '/:taskId/delete',
    async ({ params, set }) => {
      try {
        return await handleTaskDelete(params.taskId)
      } catch (error) {
        set.status = getErrorStatusCode(error)
        return createErrorResponse(error, 'Failed to delete task')
      }
    },
    {
      params: z.object({
        taskId: z.string(),
      }),
      response: z.union([TaskDeleteDataSchema, ErrorResponseSchema]),
      detail: {
        summary: 'Delete a verification task',
        description:
          'Permanently deletes a verification task from the system. Tasks in any status (pending, active, completed, failed, cancelled) can be deleted.',
        tags: ['Tasks'],
      },
    },
  )
