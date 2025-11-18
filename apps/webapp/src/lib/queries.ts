'use client'

import type {InfiniteData} from '@tanstack/react-query'
import {useInfiniteQuery, useQuery} from '@tanstack/react-query'

import type {AppWithTask, PaginatedApps} from './db'
import {getApps, getDstackVersions, getUsers} from './db'

export function useApps(
  params?: {
    keyword?: string
    appConfigType?: string
    dstackVersions?: string[]
    users?: string[]
    sortBy?: 'appName' | 'taskCount' | 'lastCreated'
    sortOrder?: 'asc' | 'desc'
    perPage?: number
  },
  options?: {
    placeholderData?: (
      previousData: InfiniteData<PaginatedApps, number> | undefined,
    ) => InfiniteData<PaginatedApps, number> | undefined
  },
) {
  return useInfiniteQuery({
    queryKey: ['apps', params],
    queryFn: ({pageParam}: {pageParam: number}) =>
      getApps({...params, page: pageParam, perPage: params?.perPage ?? 24}),
    getNextPageParam: (lastPage: PaginatedApps) => {
      return lastPage.hasMore ? lastPage.page + 1 : undefined
    },
    initialPageParam: 1,
    select: (data: InfiniteData<PaginatedApps, number>) => ({
      pages: data.pages,
      pageParams: data.pageParams,
      apps: data.pages.flatMap((page) => page.apps),
      total: data.pages[0]?.total ?? 0,
    }),
    ...options,
  })
}

export function useDstackVersions(params?: {keyword?: string}) {
  return useQuery({
    queryKey: ['dstack-versions', params],
    queryFn: () => getDstackVersions(params),
  })
}

export function useUsers(params?: {keyword?: string}) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => getUsers(params),
  })
}
