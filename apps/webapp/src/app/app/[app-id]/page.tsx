import {notFound} from 'next/navigation'

import AppLayout from '@/components/AppLayout'
import {getApp} from '@/lib/db'

interface AppPageProps {
  params: Promise<{
    'app-id': string
  }>
  searchParams: Promise<{selected?: string}>
}

export const generateMetadata = async ({params}: AppPageProps) => {
  const {['app-id']: appId} = await params
  const app = await getApp(appId)
  if (app == null) {
    notFound()
  }
  return {
    title: `${app.appName}`,
    description: `Trust report for ${app.appName} by Phala`,
  }
}

export default async function AppPage({params, searchParams}: AppPageProps) {
  const {['app-id']: appId} = await params

  // Get the app directly from database (which contains the latest task data)
  const app = await getApp(appId)

  if (!app) {
    notFound()
  }

  // Convert App to Task format for AppLayout compatibility
  const task = {
    id: app.id,
    appId: app.appId,
    appName: app.appName,
    appConfigType: app.appConfigType as 'redpill' | 'phala_cloud',
    contractAddress: app.contractAddress,
    modelOrDomain: app.modelOrDomain,
    verificationFlags: app.verificationFlags,
    status: app.status,
    errorMessage: app.errorMessage,
    s3Filename: app.s3Filename,
    s3Key: app.s3Key,
    s3Bucket: app.s3Bucket,
    createdAt: app.createdAt,
    startedAt: app.startedAt,
    finishedAt: app.finishedAt,
  }

  return (
    <AppLayout
      searchParams={searchParams}
      appId={appId}
      taskId={app.id}
      task={task}
    />
  )
}
