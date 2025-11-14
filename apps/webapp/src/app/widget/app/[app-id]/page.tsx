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
  // Use displayName if available, otherwise fallback to appName
  const displayName = app.profile?.displayName || app.appName
  return {
    title: `${displayName} - Trust Report Widget`,
    description: `Trust report widget for ${displayName}`,
  }
}

export default async function WidgetAppPage({
  params,
  searchParams,
}: WidgetAppPageProps) {
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

  return (
    <WidgetClient app={app} appId={appId} taskId={app.id} config={config} />
  )
}
