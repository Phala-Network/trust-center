import {notFound} from 'next/navigation'

import WidgetDemoClient from '@/components/widget-demo-client'
import {getTask} from '@/lib/db'

interface WidgetDemoPageProps {
  params: Promise<{
    'app-id': string
    'task-id': string
  }>
  searchParams: Promise<{
    config?: string
  }>
}

export const generateMetadata = async ({params}: WidgetDemoPageProps) => {
  const {['app-id']: appId, ['task-id']: taskId} = await params
  const task = await getTask(appId, taskId)
  if (task == null) {
    notFound()
  }
  return {
    title: `${task.appName} - Widget Demo`,
    description: `Widget demo for ${task.appName}`,
  }
}

export default async function WidgetDemoPage({params, searchParams}: WidgetDemoPageProps) {
  const {['app-id']: appId, ['task-id']: taskId} = await params
  const {config: configParam} = await searchParams

  // Get task data from database
  const task = await getTask(appId, taskId)

  if (!task) {
    notFound()
  }

  // Pass the original configParam to client (it's already URL-decoded JSON string)
  // We need to re-encode it for the iframe URL
  const configParamString = configParam
    ? `?config=${encodeURIComponent(configParam)}`
    : ''

  return (
    <WidgetDemoClient
      appId={appId}
      taskId={taskId}
      configParam={configParamString}
    />
  )
}
