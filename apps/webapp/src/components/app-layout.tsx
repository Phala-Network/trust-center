import {cookies} from 'next/headers'

import {AttestationDataProvider} from '@/components/attestation-data-provider'
import Header from '@/components/header'
import {HydrateProvider} from '@/components/hydrate-provider'
import Panels from '@/components/panels'
import type {AppWithTask} from '@/lib/db'
import {PANEL_LAYOUT_STORAGE_KEY} from '@/stores/app'

interface AppLayoutProps {
  searchParams: Promise<{selected?: string}>
  app: AppWithTask
}

export default async function AppLayout({searchParams, app}: AppLayoutProps) {
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

  return (
    <HydrateProvider
      appId={app.id ?? undefined}
      taskId={app.task.id}
      task={app}
    >
      <AttestationDataProvider initialSelectedObjectId={selectedObjectId}>
        <div className="flex h-screen flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-hidden">
            <Panels defaultLayout={defaultLayout} />
          </main>
          {/* <Footer /> */}
        </div>
      </AttestationDataProvider>
    </HydrateProvider>
  )
}
