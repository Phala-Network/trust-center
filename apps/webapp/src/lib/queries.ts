'use client'

import {useQuery} from '@tanstack/react-query'

import type {App} from './db'
import {getApps, getDstackVersions, getUsers} from './db'

export function useApps(params?: {
  keyword?: string
  appConfigType?: string
  dstackVersions?: string[]
  users?: string[]
  sortBy?: 'appName' | 'taskCount' | 'lastCreated'
  sortOrder?: 'asc' | 'desc'
  page?: number
  perPage?: number
}) {
  return useQuery({
    queryKey: ['apps', params],
    queryFn: () => getApps(params),
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
