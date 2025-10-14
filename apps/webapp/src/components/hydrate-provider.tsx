'use client'

import {useHydrateAtoms} from 'jotai/utils'

import {appIdAtom, taskAtom, taskIdAtom} from '@/stores/app'

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
    user?: string
  } | null
}

export function HydrateProvider({
  children,
  appId,
  taskId,
  task,
}: HydrateProviderProps) {
  // Hydrate the atoms with SSR values
  useHydrateAtoms(
    [
      [appIdAtom, appId || null],
      [taskIdAtom, taskId || null],
      [taskAtom, task || null],
    ],
    {dangerouslyForceHydrate: true},
  )

  return <>{children}</>
}
