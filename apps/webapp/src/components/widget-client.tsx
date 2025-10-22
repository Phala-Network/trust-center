'use client'

import type {Task} from '@phala/trust-center-db'

import {AttestationDataProvider} from '@/components/attestation-data-provider'
import {HydrateProvider} from '@/components/hydrate-provider'
import CompactReportWidget, {
  type CompactReportWidgetConfig,
} from '@/components/visualization/compact-report-widget'

interface WidgetClientProps {
  task: Task
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

  return (
    <HydrateProvider
      appId={appId}
      taskId={taskId}
      task={task}
      appInfo={appInfo}
    >
      <AttestationDataProvider>
        <div className="max-w-4xl mx-auto p-4">
          <CompactReportWidget
            config={{
              showHeader: true,
              showAttributes: true,
              showVerificationStatus: true,
              defaultExpanded: true,
              showSectionContent: true,
              sections: {
                hardware: true,
                sourceCode: true,
                zeroTrust: true,
                os: true,
                authority: true,
              },
              ...config,
            }}
          />
        </div>
      </AttestationDataProvider>
    </HydrateProvider>
  )
}
