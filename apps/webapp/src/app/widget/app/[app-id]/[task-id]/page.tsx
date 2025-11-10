import {notFound} from 'next/navigation'

import WidgetClient from '@/components/widget-client'
import {type CompactReportWidgetConfig} from '@/components/visualization/compact-report-widget'
import {getTask} from '@/lib/db'

interface WidgetTaskPageProps {
  params: Promise<{
    'app-id': string
    'task-id': string
  }>
  searchParams: Promise<{
    config?: string
  }>
}

export const generateMetadata = async ({params}: WidgetTaskPageProps) => {
  const {['app-id']: appId, ['task-id']: taskId} = await params
  const task = await getTask(appId, taskId)
  if (task == null) {
    notFound()
  }
  // Use displayName if available, otherwise fallback to appName
  const displayName = task.profile?.displayName || task.appName
  return {
    title: `${displayName} - Trust Report Widget`,
    description: `Trust report widget for ${displayName}`,
  }
}

export default async function WidgetTaskPage({params, searchParams}: WidgetTaskPageProps) {
  const {['app-id']: appId, ['task-id']: taskId} = await params
  const {config: configParam} = await searchParams

  // Parse config from URL and expand short keys
  let config: CompactReportWidgetConfig | undefined
  if (configParam) {
    try {
      // searchParams is already URL-decoded by Next.js
      const shortConfig = JSON.parse(configParam)

      // Map short keys back to full config
      config = {
        ...(shortConfig.a === 0 && {showAttributes: false}),
        ...(shortConfig.e === 1 && {defaultExpanded: true}),
        ...(shortConfig.c === 0 && {showSectionContent: false}),
        ...(shortConfig.t === 1 && {darkMode: true}),
      }

      // Parse disabled sections
      if (shortConfig.d) {
        const disabled = shortConfig.d.split(',')
        config.sections = {
          hardware: !disabled.includes('hw'),
          sourceCode: !disabled.includes('sc'),
          zeroTrust: !disabled.includes('zt'),
          os: !disabled.includes('os'),
          authority: !disabled.includes('au'),
        }
      }
    } catch (e) {
      console.error('Failed to parse config:', e)
    }
  }

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
      config={{embedded: true, ...config}}
    />
  )
}
