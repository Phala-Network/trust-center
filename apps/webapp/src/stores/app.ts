import {atom} from 'jotai'
import type {ImperativePanelGroupHandle} from 'react-resizable-panels'

import type {Data} from '@/data/schema'

// Storage key for panel layout persistence
export const PANEL_LAYOUT_STORAGE_KEY = 'panel-layout'

// Global panel group ref atom
export const panelGroupRefAtom =
  atom<React.RefObject<ImperativePanelGroupHandle | null> | null>(null)

export type ViewType = 'report' | 'values' | 'nodes'

// App information atoms
export const appIdAtom = atom<string | null>(null)
export const taskIdAtom = atom<string | null>(null)
export const taskAtom = atom<any | null>(null) // Task data from server
export const appInfoAtom = atom<{
  id: string
  name: string
  description?: string
  configType?: string
} | null>(null)

// Layout mode types
export type LayoutMode = 'compact-small' | 'compact-medium' | 'large'

// Common panel configuration
export const PANEL_CONFIG = {
  // Default panel sizes for different screen sizes
  defaultPanelSizes: {
    compactSmall: [100] as number[], // Compact small: single panel at 100%
    compactMedium: [50, 50] as number[], // Compact medium: 2 panels at 50% each
    large: [25, 25, 50] as number[], // Large: 3 panels at 25%, 25%, 50%
  },
  // Original panel configuration to preserve
  originalViews: ['report', 'values', 'nodes'] as ViewType[],
  // Breakpoints for responsive behavior
  breakpoints: {
    small: 768, // Below this = compact small (single panel)
    medium: 1024, // Below this = compact medium (two panels)
    // Above medium = large (three panels)
  },
  // Panel metadata for stable rendering
  panels: {
    report: {id: 'panel-report', order: 0},
    values: {id: 'panel-values', order: 1},
    nodes: {id: 'panel-nodes', order: 2},
  },
} as const

const initialViews: ViewType[] = PANEL_CONFIG.originalViews

// View mode for compact layouts
export type CompactMode = 'report' | 'nodes'

// Helper function to get panel configuration based on screen width
export const getPanelConfigForWidth = (
  width: number,
  compactMode: CompactMode = 'report',
  hasSelectedObject = false,
) => {
  if (width < PANEL_CONFIG.breakpoints.small) {
    // Compact small: single panel, show values if object selected, otherwise show compactMode
    const view = hasSelectedObject ? 'values' : compactMode
    return {
      layoutMode: 'compact-small' as LayoutMode,
      views: [view] as ViewType[],
      sizes: PANEL_CONFIG.defaultPanelSizes.compactSmall,
    }
  } else if (width < PANEL_CONFIG.breakpoints.medium) {
    // Compact medium: nodes mode shows only nodes, report mode shows report + values
    const views = compactMode === 'nodes' ? ['nodes'] : ['report', 'values']
    const sizes =
      compactMode === 'nodes'
        ? PANEL_CONFIG.defaultPanelSizes.compactSmall
        : PANEL_CONFIG.defaultPanelSizes.compactMedium
    return {
      layoutMode: 'compact-medium' as LayoutMode,
      views: views as ViewType[],
      sizes,
    }
  } else {
    // Large: three panels
    return {
      layoutMode: 'large' as LayoutMode,
      views: PANEL_CONFIG.originalViews,
      sizes: PANEL_CONFIG.defaultPanelSizes.large,
    }
  }
}
