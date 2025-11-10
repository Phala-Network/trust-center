import {notFound} from 'next/navigation'

import AppLayout from '@/components/app-layout'
import {getApp} from '@/lib/db'

interface TaskPageProps {
  params: Promise<{
    'app-id': string
    'task-id': string
  }>
  searchParams: Promise<{selected?: string}>
}

export const generateMetadata = async ({params}: TaskPageProps) => {
  const {['app-id']: appId} = await params
  const app = await getApp(appId)
  if (app == null) {
    notFound()
  }

  // Use displayName if available, otherwise fallback to appName
  const displayName = app.profile?.displayName || app.appName

  // Only allow indexing for public apps
  const robots = app.isPublic ? undefined : {
    index: false,
    follow: false,
  }

  return {
    title: displayName,
    description: `Trust report for ${displayName} by Phala`,
    ...(robots && { robots }),
  }
}

export default async function TaskPage({params, searchParams}: TaskPageProps) {
  const {['app-id']: appId} = await params

  // Get app data from database (shows latest task for this app)
  const app = await getApp(appId)

  if (!app) {
    notFound()
  }

  return (
    <AppLayout
      searchParams={searchParams}
      app={app}
    />
  )
}
