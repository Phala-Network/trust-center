'use client'

import type {InfiniteData} from '@tanstack/react-query'
import {Loader2} from 'lucide-react'
import {parseAsArrayOf, parseAsString, useQueryStates} from 'nuqs'
import {useEffect} from 'react'
import {useInView} from 'react-intersection-observer'

import {AppFilters} from '@/components/app-filters'
import type {PaginatedApps} from '@/lib/db'
import {useApps} from '@/lib/queries'
import {AppList} from './app-list'

export function HomeClient() {
  const [{keyword, dstackVersions, users}] = useQueryStates({
    keyword: parseAsString.withDefault(''),
    dstackVersions: parseAsArrayOf(parseAsString).withDefault([]),
    users: parseAsArrayOf(parseAsString).withDefault([]),
  })

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isFetching,
  } = useApps(
    {
      sortBy: 'appName',
      keyword: keyword || undefined,
      dstackVersions: dstackVersions.length > 0 ? dstackVersions : undefined,
      users: users.length > 0 ? users : undefined,
      perPage: 24,
    },
    {
      // Keep previous data while fetching new data to prevent flicker
      placeholderData: (
        previousData: InfiniteData<PaginatedApps, number> | undefined,
      ) => previousData,
    },
  )

  // Data is already transformed by select option in useApps
  const apps = data?.apps ?? []
  const total = data?.total ?? 0

  const hasFilters =
    Boolean(keyword) || dstackVersions.length > 0 || users.length > 0

  // Set up intersection observer for infinite scroll
  const {ref: loadMoreRef, inView} = useInView({
    threshold: 0,
    rootMargin: '100px',
  })

  // Load more when the sentinel comes into view
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div className="w-full space-y-8">
      <AppFilters />

      {/* Loading state for initial load */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Loading applications...
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Subtle loading indicator for background fetches */}
          {isFetching && !isFetchingNextPage && (
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-10">
              <div className="flex items-center gap-2 bg-muted/80 backdrop-blur-sm text-muted-foreground px-3 py-1.5 rounded-full text-xs border border-border/50">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Updating...</span>
              </div>
            </div>
          )}
          <AppList apps={apps} hasFilters={hasFilters} total={total} />

          {/* Infinite scroll sentinel */}
          {hasNextPage && (
            <div ref={loadMoreRef} className="py-8 flex justify-center">
              {isFetchingNextPage && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading more...</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
