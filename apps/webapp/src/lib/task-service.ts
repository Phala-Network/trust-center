'use server'

import {createDbConnection} from '@phala/trust-center-db'
import {verificationTasksTable} from '@phala/trust-center-db/schema'
import {eq} from 'drizzle-orm'
import {randomUUID} from 'node:crypto'

import {env} from '@/env'

// Create database connection
const db = createDbConnection(env.DATABASE_URL)

interface CreateTaskInput {
  appId: string
  appName: string
  appConfigType: 'redpill' | 'phala_cloud'
  contractAddress: string
  modelOrDomain: string
  metadata?: any
  flags?: any
}

interface CreateTaskResult {
  index: number
  success: boolean
  taskId: string | null
  error: string | null
}

export async function createTask(input: CreateTaskInput) {
  try {
    const taskId = randomUUID()

    // Insert task into database with pending status
    // Server worker will pick it up and add to queue
    await db.insert(verificationTasksTable).values({
      id: taskId,
      appId: input.appId,
      appName: input.appName,
      appConfigType: input.appConfigType,
      contractAddress: input.contractAddress,
      modelOrDomain: input.modelOrDomain,
      verificationFlags: input.flags || null,
      status: 'pending',
      createdAt: new Date(),
    })

    return {taskId, message: 'Task created successfully'}
  } catch (error) {
    throw new Error(
      `Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

export async function createTasksDirectly(tasks: CreateTaskInput[]): Promise<{
  total: number
  successful: number
  failed: number
  results: CreateTaskResult[]
}> {
  const results: CreateTaskResult[] = []
  let successful = 0
  let failed = 0

  for (let i = 0; i < tasks.length; i++) {
    try {
      const result = await createTask(tasks[i])
      results.push({
        index: i,
        success: true,
        taskId: result.taskId,
        error: null,
      })
      successful++
    } catch (error) {
      results.push({
        index: i,
        success: false,
        taskId: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      failed++
    }
  }

  return {
    total: tasks.length,
    successful,
    failed,
    results,
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
