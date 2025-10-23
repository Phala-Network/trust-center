import {notFound} from 'next/navigation'

import WidgetClient from '@/components/widget-client'
import {getApp} from '@/lib/db'

interface WidgetAppPageProps {
  params: Promise<{
    'app-id': string
  }>
  searchParams: Promise<{
    config?: string
  }>
}

export const generateMetadata = async ({params}: WidgetAppPageProps) => {
  const {['app-id']: appId} = await params
  const app = await getApp(appId)
  if (app == null) {
    notFound()
  }
  return {
    title: `${app.appName} - Trust Report Widget`,
    description: `Trust report widget for ${app.appName}`,
  }
}

export default async function WidgetAppPage({params, searchParams}: WidgetAppPageProps) {
  const {['app-id']: appId} = await params
  const {config: configParam} = await searchParams

  // Parse config from URL
  let config
  if (configParam) {
    try {
      config = JSON.parse(decodeURIComponent(configParam))
    } catch (e) {
      console.error('Failed to parse config:', e)
    }
  }

  // Get the app directly from database
  const app = await getApp(appId)

  if (!app) {
    notFound()
  }

  // Convert App to Task format
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
    user: app.user,
    dstackVersion: app.dstackVersion,
    dataObjects: app.dataObjects,
  }

  return (
    <WidgetClient
      task={task}
      appId={appId}
      taskId={app.id}
      config={config}
    />
  )
}
