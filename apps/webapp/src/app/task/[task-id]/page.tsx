import {redirect} from 'next/navigation'

import {getTaskById} from '@/lib/db'

interface TaskRedirectPageProps {
  params: Promise<{
    'task-id': string
  }>
}

export default async function TaskRedirectPage({
  params,
}: TaskRedirectPageProps) {
  const {['task-id']: taskId} = await params

  // Get task data to find the app ID
  const task = await getTaskById(taskId)

  if (!task) {
    // If task not found, redirect to home
    redirect('/')
  }

  // Redirect to the proper app/task route
  redirect(`/app/${task.id}/${taskId}`)
}
