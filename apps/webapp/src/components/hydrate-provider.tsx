'use client'

import {useHydrateAtoms} from 'jotai/utils'

import {appIdAtom, appInfoAtom, taskAtom, taskIdAtom} from '@/stores/app'

interface HydrateProviderProps {
  children: React.ReactNode
  appId?: string
  taskId?: string
  task?: any | null
  appInfo?: {
    id: string
    name: string
    description?: string
    configType?: string
  } | null
}

export function HydrateProvider({
  children,
  appId,
  taskId,
  task,
  appInfo,
}: HydrateProviderProps) {
  // Hydrate the atoms with SSR values
  useHydrateAtoms(
    [
      [appIdAtom, appId || null],
      [taskIdAtom, taskId || null],
      [taskAtom, task || null],
      [appInfoAtom, appInfo || null],
    ],
    {dangerouslyForceHydrate: true},
  )

  return <>{children}</>
}
