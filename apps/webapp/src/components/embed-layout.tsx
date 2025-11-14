import {ExternalLink} from 'lucide-react'
import {cookies} from 'next/headers'

import {AttestationDataProvider} from '@/components/attestation-data-provider'
import {HydrateProvider} from '@/components/hydrate-provider'
import Panels from '@/components/panels'
import {Button} from '@/components/ui/button'
import type {AppWithTask} from '@/lib/db'
import {PANEL_LAYOUT_STORAGE_KEY} from '@/stores/app'

interface EmbedLayoutProps {
  searchParams: Promise<{selected?: string}>
  app: AppWithTask
}

export default async function EmbedLayout({
  searchParams,
  app,
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

  // Extract app info from app data
  const appInfo = {
    id: app.id ?? '',
    name: app.appName,
    description: `${app.appConfigType === 'phala_cloud' ? 'Phala Cloud' : 'Redpill'} Application`,
    configType: app.appConfigType,
    user: app.workspaceProfile?.displayName || app.customUser || undefined,
  }

  // Construct the Trust Center URL using app info
  const trustCenterUrl = `/app/${app.id}/${app.id}`

  return (
    <HydrateProvider
      appId={app.id ?? undefined}
      taskId={app.id}
      task={app}
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
