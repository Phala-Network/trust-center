'use client'

import {
  QueryClient,
  QueryClientProvider,
  isServer,
} from '@tanstack/react-query'
import {Provider as JotaiProvider} from 'jotai'
import {NuqsAdapter} from 'nuqs/adapters/next/app'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (isServer) {
    return makeQueryClient()
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient()
  }
  return browserQueryClient
}

export function Providers({children}: {children: React.ReactNode}) {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <JotaiProvider>{children}</JotaiProvider>
      </NuqsAdapter>
    </QueryClientProvider>
  )
}
