import {useAtom} from 'jotai'
import {useCallback, useEffect, useMemo, useState} from 'react'

import {useAttestationData} from '@/components/attestation-data-context'
import {
  getPanelConfigForWidth,
  type LayoutMode,
  panelGroupRefAtom,
  type ViewType,
} from '@/stores/app'

export interface LayoutState {
  layoutMode: LayoutMode
  views: ViewType[]
  sizes: number[]
  isClient: boolean
  showModeSwitch: boolean
  showResetButton: boolean
  showBackButton: boolean
  resetLayout: () => void
}

export function useLayout(): LayoutState {
  const [isClient, setIsClient] = useState(false)
  const [windowWidth, setWindowWidth] = useState(1200)
  const {
    panels: views,
    setPanels: setViews,
    compactMode,
    selectedObjectId,
  } = useAttestationData()
  const [panelGroupRef] = useAtom(panelGroupRefAtom)

  // Memoize selected object state
  const hasSelectedObject = useMemo(
    () => Boolean(selectedObjectId),
    [selectedObjectId],
  )

  // Initialize client-side width and handle resize
  useEffect(() => {
    if (typeof window === 'undefined') return

    setIsClient(true)
    setWindowWidth(window.innerWidth)

    let animationFrameId: number
    const handleResize = () => {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = requestAnimationFrame(() => {
        setWindowWidth(window.innerWidth)
      })
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  // Update panels based on window width, compact mode, and selected object
  useEffect(() => {
    if (!isClient) return

    const {views: targetViews, sizes} = getPanelConfigForWidth(
      windowWidth,
      compactMode,
      hasSelectedObject,
    )

    const viewsChanged =
      views.length !== targetViews.length ||
      views.some((view, index) => view !== targetViews[index])

    if (viewsChanged) {
      setViews(targetViews)

      // Reset layout immediately when views change
      if (panelGroupRef?.current) {
        requestAnimationFrame(() => {
          if (panelGroupRef?.current) {
            try {
              panelGroupRef.current.setLayout(sizes)
            } catch (error) {
              console.debug('Layout transition error (expected):', error)
            }
          }
        })
      }
    }
  }, [
    windowWidth,
    compactMode,
    hasSelectedObject,
    isClient,
    views,
    setViews,
    panelGroupRef,
  ])

  // Layout reset function
  const resetLayout = useCallback(() => {
    if (!isClient || !panelGroupRef?.current) return

    const {sizes} = getPanelConfigForWidth(
      windowWidth,
      compactMode,
      hasSelectedObject,
    )
    panelGroupRef.current.setLayout(sizes)
  }, [panelGroupRef, windowWidth, compactMode, hasSelectedObject, isClient])

  // Compute layout state
  const layoutState = useMemo(() => {
    if (!isClient) {
      // Use default config to prevent hydration mismatch
      const defaultConfig = getPanelConfigForWidth(
        1200,
        compactMode,
        hasSelectedObject,
      )
      return {
        layoutMode: defaultConfig.layoutMode,
        views: defaultConfig.views,
        sizes: defaultConfig.sizes,
        isClient: false,
        showModeSwitch: false,
        showResetButton: false,
        showBackButton: false,
        resetLayout,
      }
    }

    const {layoutMode, sizes} = getPanelConfigForWidth(
      windowWidth,
      compactMode,
      hasSelectedObject,
    )

    return {
      layoutMode,
      views,
      sizes,
      isClient,
      showModeSwitch:
        layoutMode === 'compact-small' || layoutMode === 'compact-medium',
      showResetButton: layoutMode === 'large',
      showBackButton: layoutMode === 'compact-small' && hasSelectedObject,
      resetLayout,
    }
  }, [
    isClient,
    windowWidth,
    compactMode,
    hasSelectedObject,
    views,
    resetLayout,
  ])

  return layoutState
}
