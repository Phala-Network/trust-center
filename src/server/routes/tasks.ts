import { Elysia, t } from 'elysia'

import {
  handleBatchCreation,
  handleTaskCancellation,
  handleTaskCreation,
  handleTaskResult,
  handleTaskStats,
  handleTaskStatus,
  handleTasksList,
} from './tasks/handlers'
// Import schemas and handlers from modular files
import {
  BatchCreateRequestSchema,
  ErrorResponseSchema,
  StorageInfoResponseSchema,
  SuccessResponseSchema,
  TaskCreateRequestSchema,
  TaskDetailResponseSchema,
  TaskListQuerySchema,
  TaskListResponseSchema,
  TaskStatsResponseSchema,
} from './tasks/schemas'

// Main task routes
export const taskRoutes = new Elysia({ prefix: '/tasks' })
  // Create single task
  .post(
    '/',
    async ({ body, set }) => {
      try {
        const result = await handleTaskCreation(body)
        if (result.success) {
          return {
            success: true as const,
            taskId: 'task-created',
            message: result.message,
          }
        } else {
          return {
            success: false as const,
            error: (result as any).error || 'Unknown error',
          }
        }
      } catch (error) {
        set.status = 500
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to create task',
        }
      }
    },
    {
      body: TaskCreateRequestSchema,
      response: t.Union([
        t.Object({
          success: t.Literal(true),
          taskId: t.String(),
          message: t.String(),
        }),
        ErrorResponseSchema,
      ]),
    },
  )
  // Create batch tasks
  .post(
    '/batch',
    async ({ body, set }) => {
      try {
        const result = await handleBatchCreation(body)
        if (result.success) {
          return {
            success: true as const,
            message: result.message,
            results: [], // Could be enhanced to return individual results
          }
        } else {
          return {
            success: false as const,
            error: (result as any).error || 'Unknown error',
          }
        }
      } catch (error) {
        set.status = 500
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to create batch tasks',
        }
      }
    },
    {
      body: BatchCreateRequestSchema,
      response: t.Union([
        t.Object({
          success: t.Literal(true),
          message: t.String(),
          results: t.Array(
            t.Object({
              index: t.Number(),
              success: t.Boolean(),
              taskId: t.Union([t.String(), t.Null()]),
              error: t.Union([t.String(), t.Null()]),
            }),
          ),
        }),
        ErrorResponseSchema,
      ]),
    },
  )
  // Get single task
  .get(
    '/:taskId',
    async ({ params, set }) => {
      try {
        const result = await handleTaskStatus(params.taskId)
        return result
      } catch (error) {
        set.status = 500
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to get task status',
        }
      }
    },
    {
      params: t.Object({
        taskId: t.String(),
      }),
      response: TaskDetailResponseSchema,
    },
  )
  // Get task list
  .get(
    '/',
    async ({ query, set }) => {
      try {
        const result = await handleTasksList(query)
        if (result.success) {
          return {
            success: true as const,
            data: result.data,
            pagination: result.pagination,
          }
        } else {
          set.status = 400
          return {
            success: false as const,
            error: (result as any).error || 'Unknown error',
          }
        }
      } catch (error) {
        set.status = 500
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to list tasks',
        }
      }
    },
    {
      query: TaskListQuerySchema,
      response: t.Union([TaskListResponseSchema, ErrorResponseSchema]),
    },
  )
  // Get task stats
  .get(
    '/stats/summary',
    async ({ set }) => {
      try {
        const result = await handleTaskStats()
        if (result.success) {
          return { success: true as const, stats: result.stats }
        } else {
          return {
            success: false as const,
            error: (result as any).error || 'Unknown error',
          }
        }
      } catch (error) {
        set.status = 500
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to get task stats',
        }
      }
    },
    {
      response: t.Union([TaskStatsResponseSchema, ErrorResponseSchema]),
    },
  )
  // Cancel task
  .delete(
    '/:taskId',
    async ({ params, set }) => {
      try {
        const result = await handleTaskCancellation(params.taskId)
        if (result.success) {
          return {
            success: true as const,
            message: result.message || 'Task cancelled successfully',
          }
        } else {
          return {
            success: false as const,
            error: (result as any).error || 'Unknown error',
          }
        }
      } catch (error) {
        set.status = 500
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to cancel task',
        }
      }
    },
    {
      params: t.Object({
        taskId: t.String(),
      }),
      response: t.Union([SuccessResponseSchema, ErrorResponseSchema]),
    },
  )
  // Get task result
  .get(
    '/:taskId/result',
    async ({ params, set }) => {
      try {
        const result = await handleTaskResult(params.taskId)
        if (result.success) {
          return result
        } else {
          set.status = 400
          return result
        }
      } catch (error) {
        set.status = 500
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to get task result',
        }
      }
    },
    {
      params: t.Object({
        taskId: t.String(),
      }),
      response: t.Union([StorageInfoResponseSchema, ErrorResponseSchema]),
    },
  )
