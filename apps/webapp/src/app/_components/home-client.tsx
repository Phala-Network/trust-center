'use client'

import {Loader2} from 'lucide-react'
import {parseAsArrayOf, parseAsString, useQueryStates} from 'nuqs'

import {AppFilters} from '@/components/app-filters'
import {useApps} from '@/lib/queries'
import {AppList} from './app-list'

export function HomeClient() {
  const [{keyword, dstackVersions, users}] = useQueryStates({
    keyword: parseAsString.withDefault(''),
    dstackVersions: parseAsArrayOf(parseAsString).withDefault([]),
    users: parseAsArrayOf(parseAsString).withDefault([]),
  })

  const {data: apps = [], isFetching, isLoading} = useApps({
    sortBy: 'appName',
    keyword: keyword || undefined,
    dstackVersions: dstackVersions.length > 0 ? dstackVersions : undefined,
    users: users.length > 0 ? users : undefined,
  })

  const hasFilters =
    Boolean(keyword) || dstackVersions.length > 0 || users.length > 0

  return (
    <div className="w-full space-y-8">
      <AppFilters />

      {/* Loading state for initial load */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading applications...</p>
        </div>
      ) : (
        <div className="relative">
          {/* Subtle loading indicator for background fetches */}
          {isFetching && (
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-10">
              <div className="flex items-center gap-2 bg-muted/80 backdrop-blur-sm text-muted-foreground px-3 py-1.5 rounded-full text-xs border border-border/50">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Updating...</span>
              </div>
            </div>
          )}
          <AppList apps={apps} hasFilters={hasFilters} />
        </div>
      )}
    </div>
  )
}
