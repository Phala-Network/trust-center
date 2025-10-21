import {notFound} from 'next/navigation'

import WidgetClient from '@/components/widget-client'
import {getTask} from '@/lib/db'

interface WidgetTaskPageProps {
  params: Promise<{
    'app-id': string
    'task-id': string
  }>
}

export const generateMetadata = async ({params}: WidgetTaskPageProps) => {
  const {['app-id']: appId, ['task-id']: taskId} = await params
  const task = await getTask(appId, taskId)
  if (task == null) {
    notFound()
  }
  return {
    title: `${task.appName} - Trust Report Widget`,
    description: `Trust report widget for ${task.appName}`,
  }
}

export default async function WidgetTaskPage({params}: WidgetTaskPageProps) {
  const {['app-id']: appId, ['task-id']: taskId} = await params

  // Get task data from database
  const task = await getTask(appId, taskId)

  if (!task) {
    notFound()
  }

  return (
    <WidgetClient
      task={task}
      appId={appId}
      taskId={taskId}
    />
  )
}
