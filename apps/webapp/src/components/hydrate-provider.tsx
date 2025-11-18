'use client'

import {useHydrateAtoms} from 'jotai/utils'

import type {AppWithTask} from '@/lib/db'
import {appIdAtom, appWithTaskAtom, taskIdAtom} from '@/stores/app'

interface HydrateProviderProps {
  children: React.ReactNode
  appId?: string
  taskId?: string
  task?: AppWithTask | null
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
      [appWithTaskAtom, task || null],
    ],
    {dangerouslyForceHydrate: true},
  )

  return <>{children}</>
}
