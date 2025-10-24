import type {Task} from '@phala/trust-center-db'
import {cookies} from 'next/headers'
import {ExternalLink} from 'lucide-react'

import {AttestationDataProvider} from '@/components/attestation-data-provider'
import {HydrateProvider} from '@/components/hydrate-provider'
import Panels from '@/components/panels'
import {Button} from '@/components/ui/button'
import {PANEL_LAYOUT_STORAGE_KEY} from '@/stores/app'

interface EmbedLayoutProps {
  searchParams: Promise<{selected?: string}>
  appId?: string
  taskId?: string
  task?: Task | null
}

export default async function EmbedLayout({
  searchParams,
  appId,
  taskId,
  task,
}: EmbedLayoutProps) {
  const cookieStore = await cookies()
  const layout = cookieStore.get(PANEL_LAYOUT_STORAGE_KEY)

  let defaultLayout: number[] | undefined
  if (layout) {
    try {
      defaultLayout = JSON.parse(layout.value)
    } catch {
      // If parsing fails, use default layout
      defaultLayout = undefined
    }
  }

  // Read selected object from URL search params during SSR
  const selectedObjectId = (await searchParams).selected ?? null

  // Extract app info from task data
  const appInfo = task
    ? {
        id: task.appId,
        name: task.appName,
        description: `${task.appConfigType === 'phala_cloud' ? 'Phala Cloud' : 'Redpill'} Application`,
        configType: task.appConfigType,
        user: task.user,
      }
    : null

  // Construct the Trust Center URL using task ID
  const trustCenterUrl = appId && taskId ? `/app/${appId}/${taskId}` : '/'

  return (
    <HydrateProvider
      appId={appId}
      taskId={taskId}
      task={task}
      appInfo={appInfo}
    >
      <AttestationDataProvider initialSelectedObjectId={selectedObjectId}>
        <div className="relative flex h-screen flex-col overflow-hidden">
          {/* Floating "View in Trust Center" button */}
          <div className="fixed right-4 top-4 z-50">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60"
              asChild
            >
              <a
                href={trustCenterUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                View in Trust Center
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>

          <main className="flex-1 overflow-hidden">
            <Panels defaultLayout={defaultLayout} />
          </main>
        </div>
      </AttestationDataProvider>
    </HydrateProvider>
  )
}
