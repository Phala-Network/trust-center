import {type NextRequest, NextResponse} from 'next/server'

import {addCorsHeaders, corsPreflight} from '@/lib/cors'
import {getTaskApiInfoById} from '@/lib/db'

interface RouteParams {
  params: Promise<{
    'task-id': string
  }>
}

export async function OPTIONS(request: NextRequest) {
  return corsPreflight(request.headers.get('origin'))
}

export async function GET(request: NextRequest, {params}: RouteParams) {
  const {'task-id': taskId} = await params
  const origin = request.headers.get('origin')

  const task = await getTaskApiInfoById(taskId)

  if (!task) {
    const response = NextResponse.json({error: 'Task not found'}, {status: 404})
    response.headers.set('Cache-Control', 'no-store')
    return addCorsHeaders(response, origin)
  }

  const response = NextResponse.json({
    id: task.taskId,
    appId: task.appId,
    status: task.status,
    errorMessage: task.errorMessage,
    verificationFlags: task.verificationFlags,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt,
  })
  response.headers.set('Cache-Control', 'no-store')
  return addCorsHeaders(response, origin)
}
