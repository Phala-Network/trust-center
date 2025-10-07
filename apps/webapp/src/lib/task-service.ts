'use server'

import {
  createDbConnection,
  type TaskCreateRequest,
} from '@phala/trust-center-db'
import {verificationTasksTable} from '@phala/trust-center-db/schema'
import {eq} from 'drizzle-orm'
import {randomUUID} from 'node:crypto'

import {env} from '@/env'

// Create database connection
const db = createDbConnection(env.DATABASE_POSTGRES_URL)

type CreateTaskInput = TaskCreateRequest | TaskCreateRequest[]

export async function createTasks(input: CreateTaskInput) {
  try {
    // Handle batch insert
    const tasks = Array.isArray(input) ? input : [input]

    const values = tasks.map(task => ({
      id: randomUUID(),
      appId: task.appId,
      appName: task.appName,
      appConfigType: task.appConfigType,
      contractAddress: task.contractAddress,
      modelOrDomain: task.modelOrDomain,
      dstackVersion: task.dstackVersion || null,
      appMetadata: task.metadata || null,
      verificationFlags: task.flags || null,
      status: 'pending' as const,
      createdAt: new Date(),
    }))

    // Insert all tasks in a single batch operation
    await db.insert(verificationTasksTable).values(values)

    // Return single task ID or array of task IDs
    const taskIds = values.map(v => v.id)
    return Array.isArray(input)
      ? {taskIds, message: `${taskIds.length} tasks created successfully`}
      : {taskId: taskIds[0], message: 'Task created successfully'}
  } catch (error) {
    throw new Error(
      `Failed to create task(s): ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

export async function deleteTask(taskId: string) {
  try {
    // Remove from database
    // Server will handle queue cleanup if needed
    await db
      .delete(verificationTasksTable)
      .where(eq(verificationTasksTable.id, taskId))

    return {message: 'Task deleted successfully'}
  } catch (error) {
    throw new Error(
      `Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}
