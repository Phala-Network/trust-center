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
  const {['app-id']: appId, ['task-id']: taskId} = await params
  const app = await getApp(appId)
  if (app == null) {
    notFound()
  }

  // Use displayName if available, otherwise fallback to appName
  const displayName = app.profile?.displayName || app.appName
  const displayUser = app.workspaceProfile?.displayName || app.customUser
  const description =
    app.profile?.description ||
    `Verified TEE application${displayUser ? ` by ${displayUser}` : ''} - Hardware, OS, and source code attestation verified on Phala Trust Center`

  const url = `https://trust.phala.com/app/${appId}/${taskId}`

  // Only allow indexing for public apps
  const robots = app.isPublic
    ? undefined
    : {
        index: false,
        follow: false,
      }

  return {
    title: displayName,
    description,
    openGraph: {
      title: `${displayName} - Verified on Phala Trust Center`,
      description,
      url,
      siteName: 'Phala Trust Center',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      site: '@PhalaNetwork',
      title: `${displayName} - Verified on Phala Trust Center`,
      description,
    },
    alternates: {
      canonical: url,
    },
    ...(robots && {robots}),
  }
}

export default async function TaskPage({params, searchParams}: TaskPageProps) {
  const {['app-id']: appId} = await params

  // Get app data from database (shows latest task for this app)
  const app = await getApp(appId)

  if (!app) {
    notFound()
  }

  return <AppLayout searchParams={searchParams} app={app} />
}
