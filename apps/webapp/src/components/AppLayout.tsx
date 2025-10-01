import {cookies} from 'next/headers'

import {AttestationDataProvider} from '@/components/AttestationDataProvider'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import {HydrateProvider} from '@/components/HydrateProvider'
import Panels from '@/components/Panels'
import type {Task} from '@/lib/task-api'
import {PANEL_LAYOUT_STORAGE_KEY} from '@/stores/app'

interface AppLayoutProps {
  searchParams: Promise<{selected?: string}>
  appId?: string
  taskId?: string
  task?: Task | null
}

export default async function AppLayout({
  searchParams,
  appId,
  taskId,
  task,
}: AppLayoutProps) {
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
      }
    : null

  return (
    <HydrateProvider
      appId={appId}
      taskId={taskId}
      task={task}
      appInfo={appInfo}
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
