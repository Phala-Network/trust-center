import {notFound} from 'next/navigation'

import AppLayout from '@/components/app-layout'
import {getTask} from '@/lib/db'

interface TaskPageProps {
  params: Promise<{
    'app-id': string
    'task-id': string
  }>
  searchParams: Promise<{selected?: string}>
}

export const generateMetadata = async ({params}: TaskPageProps) => {
  const {['app-id']: appId, ['task-id']: taskId} = await params
  const task = await getTask(appId, taskId)
  if (task == null) {
    notFound()
  }

  // Only allow indexing for public apps
  const robots = task.isPublic ? undefined : {
    index: false,
    follow: false,
  }

  return {
    title: `${task.appName}`,
    description: `Trust report for ${task.appName} by Phala`,
    ...(robots && { robots }),
  }
}

export default async function TaskPage({params, searchParams}: TaskPageProps) {
  const {['app-id']: appId, ['task-id']: taskId} = await params

  // Get task data from database
  const task = await getTask(appId, taskId)

  if (!task) {
    notFound()
  }

  return (
    <AppLayout
      searchParams={searchParams}
      appId={appId}
      taskId={taskId}
      task={task}
    />
  )
}
