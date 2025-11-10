'use client'

import {AttestationDataProvider} from '@/components/attestation-data-provider'
import {HydrateProvider} from '@/components/hydrate-provider'
import CompactReportWidget, {
  type CompactReportWidgetConfig,
} from '@/components/visualization/compact-report-widget'
import type {AppTask} from '@/lib/db'

interface WidgetClientProps {
  task: AppTask
  appId: string
  taskId: string
  config?: Partial<CompactReportWidgetConfig>
}

export default function WidgetClient({
  task,
  appId,
  taskId,
  config,
}: WidgetClientProps) {
  const appInfo = {
    id: task.appId,
    name: task.appName,
    description: `${task.appConfigType === 'phala_cloud' ? 'Phala Cloud' : 'Redpill'} Application`,
    configType: task.appConfigType,
    user: task.user,
  }

  const widgetConfig = {
    ...config,
    showTrustCenterButton: true,
    appId,
    taskId,
  }

  return (
    <HydrateProvider
      appId={appId}
      taskId={taskId}
      task={task}
      appInfo={appInfo}
    >
      <AttestationDataProvider>
        <CompactReportWidget config={widgetConfig} />
      </AttestationDataProvider>
    </HydrateProvider>
  )
}
