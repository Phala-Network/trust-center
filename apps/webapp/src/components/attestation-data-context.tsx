'use client'

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react'

import type {Data} from '@/data/schema'
import type {ProfileDisplay} from '@/lib/db'
import type {CompactMode, ViewType} from '@/stores/app'

interface AttestationDataContextType {
  // Data
  attestationData: Data
  loading: boolean
  error: string | null
  appProfile: ProfileDisplay | null // App profile for app-main description

  // UI State (isolated per report)
  selectedObjectId: string | null
  setSelectedObjectId: (id: string | null) => void
  selectedObject: Data[0] | null // Computed selected object

  // Search state
  searchTerm: string
  setSearchTerm: (term: string) => void
  showAutocomplete: boolean
  setShowAutocomplete: (show: boolean) => void

  // Layout state
  compactMode: CompactMode
  setCompactMode: (mode: CompactMode) => void
  panels: ViewType[]
  setPanels: (panels: ViewType[]) => void
}

const AttestationDataContext = createContext<AttestationDataContextType | null>(
  null,
)

interface AttestationDataProviderProps {
  children: ReactNode
  attestationData: Data
  loading: boolean
  error: string | null
  appProfile?: ProfileDisplay | null
  initialSelectedObjectId?: string | null
}

export function AttestationDataProvider({
  children,
  attestationData,
  loading,
  error,
  appProfile = null,
  initialSelectedObjectId = null,
}: AttestationDataProviderProps) {
  // UI State
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(
    initialSelectedObjectId,
  )

  // Search state
  const [searchTerm, setSearchTerm] = useState('')
  const [showAutocomplete, setShowAutocomplete] = useState(false)

  // Layout state
  const [compactMode, setCompactMode] = useState<CompactMode>('report')
  const [panels, setPanels] = useState<ViewType[]>([
    'report',
    'values',
    'nodes',
  ])

  // Compute selected object with useMemo for performance
  const selectedObject = useMemo(() => {
    if (!selectedObjectId || !attestationData.length) return null
    return attestationData.find((o) => o.id === selectedObjectId) ?? null
  }, [selectedObjectId, attestationData])

  return (
    <AttestationDataContext.Provider
      value={{
        attestationData,
        loading,
        error,
        appProfile,
        selectedObjectId,
        setSelectedObjectId,
        selectedObject,
        searchTerm,
        setSearchTerm,
        showAutocomplete,
        setShowAutocomplete,
        compactMode,
        setCompactMode,
        panels,
        setPanels,
      }}
    >
      {children}
    </AttestationDataContext.Provider>
  )
}

export function useAttestationData() {
  const context = useContext(AttestationDataContext)
  if (!context) {
    throw new Error(
      'useAttestationData must be used within AttestationDataProvider',
    )
  }
  return context
}
