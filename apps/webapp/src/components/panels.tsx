'use client'

import {useAtom, useSetAtom} from 'jotai'
import Cookies from 'js-cookie'
import {useRouter, useSearchParams} from 'next/navigation'
import {Fragment, useEffect, useRef} from 'react'
import type {ImperativePanelGroupHandle} from 'react-resizable-panels'

import {useAttestationData} from '@/components/attestation-data-context'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import Panel from '@/components/visualization/panel'
import {useLayout} from '@/hooks/use-layout'
import {
  PANEL_CONFIG,
  PANEL_LAYOUT_STORAGE_KEY,
  panelGroupRefAtom,
} from '@/stores/app'

interface PanelsProps {
  defaultLayout?: number[]
}

export default function Panels({defaultLayout}: PanelsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const {selectedObjectId, setSelectedObjectId} = useAttestationData()
  const setPanelGroupRef = useSetAtom(panelGroupRefAtom)
  const panelGroupRef = useRef<ImperativePanelGroupHandle>(null)

  // Use the layout hook for all layout logic
  const {views, sizes, isClient, showBackButton} = useLayout()

  // Set panel group ref to global atom
  useEffect(() => {
    setPanelGroupRef(panelGroupRef)
  }, [setPanelGroupRef])

  // Update URL when selectedObjectId changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())

    if (selectedObjectId) {
      params.set('selected', selectedObjectId)
    } else {
      params.delete('selected')
    }

    // Only add '?' if there are params
    const queryString = params.toString()
    const newUrl = queryString ? `?${queryString}` : window.location.pathname
    history.replaceState(null, '', newUrl)
  }, [selectedObjectId, searchParams, router])

  // Handle back button for compact small mode
  const handleBack = () => {
    setSelectedObjectId(null)
  }

  // Handle layout changes and save to cookie
  const onLayout = (sizes: number[]) => {
    if (typeof window !== 'undefined') {
      Cookies.set(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(sizes))
    }
  }

  // Don't render until client-side to prevent hydration errors
  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="h-full flex-1"
      autoSaveId={PANEL_LAYOUT_STORAGE_KEY}
      onLayout={onLayout}
      ref={panelGroupRef}
    >
      {views.map((view, index) => {
        const panelConfig = PANEL_CONFIG.panels[view]
        return (
          <Fragment key={panelConfig.id}>
            <ResizablePanel
              id={panelConfig.id}
              order={panelConfig.order}
              defaultSize={defaultLayout?.[index] ?? sizes[index]}
              minSize={views.length === 1 ? 100 : 10}
              className="h-full"
            >
              <Panel
                view={view}
                onBack={showBackButton ? handleBack : undefined}
              />
            </ResizablePanel>
            {views.length > 1 && index < views.length - 1 && (
              <ResizableHandle />
            )}
          </Fragment>
        )
      })}
    </ResizablePanelGroup>
  )
}
