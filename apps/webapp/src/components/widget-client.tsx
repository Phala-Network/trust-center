'use client'

import {AttestationDataProvider} from '@/components/attestation-data-provider'
import {HydrateProvider} from '@/components/hydrate-provider'
import CompactReportWidget, {
  type CompactReportWidgetConfig,
} from '@/components/visualization/compact-report-widget'
import type {AppWithTask} from '@/lib/db'

interface WidgetClientProps {
  app: AppWithTask
  appId: string
  taskId: string
  config?: Partial<CompactReportWidgetConfig>
}

export default function WidgetClient({
  app,
  appId,
  taskId,
  config,
}: WidgetClientProps) {
  const appInfo = {
    id: app.id ?? '',
    name: app.appName,
    description: `${app.appConfigType === 'phala_cloud' ? 'Phala Cloud' : 'Redpill'} Application`,
    configType: app.appConfigType,
    user: app.workspaceProfile?.displayName || app.customUser || undefined,
  }

  const widgetConfig = {
    ...config,
    showTrustCenterButton: true,
    appId,
    taskId,
  }

  return (
    <HydrateProvider appId={appId} taskId={taskId} task={app} appInfo={appInfo}>
      <AttestationDataProvider>
        <CompactReportWidget config={widgetConfig} />
      </AttestationDataProvider>
    </HydrateProvider>
  )
}
