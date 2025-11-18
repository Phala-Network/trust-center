import {dehydrate, HydrationBoundary, QueryClient} from '@tanstack/react-query'
import {Suspense} from 'react'

import {Hero} from '@/components/hero'
import {PhalaNavbar} from '@/components/navbar'
import {UserGallery} from '@/components/user-gallery'
import {getApps, getDstackVersions, getUsers} from '@/lib/db'
import {HomeClient} from './_components/home-client'

export default async function HomePage() {
  const queryClient = new QueryClient()

  // Prefetch initial data with empty filters (first page)
  await queryClient.prefetchInfiniteQuery({
    queryKey: ['apps', {sortBy: 'appName', perPage: 24}],
    queryFn: () => getApps({sortBy: 'appName', page: 1, perPage: 24}),
    initialPageParam: 1,
    pages: 1,
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.page + 1 : undefined
    },
  })

  await queryClient.prefetchQuery({
    queryKey: ['dstack-versions', {}],
    queryFn: () => getDstackVersions(),
  })

  // Prefetch featured builders for gallery
  await queryClient.prefetchQuery({
    queryKey: ['users'],
    queryFn: () => getUsers(),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PhalaNavbar />
      <div className="min-h-screen pt-[72px]">
        {/* Hero Section - Background (lighter) */}
        <section className="relative bg-background">
          <Hero />
        </section>

        {/* Featured Builders Section - Muted background */}
        <section className="bg-muted pt-16 pb-8 sm:pt-20 sm:pb-10 lg:pt-24 lg:pb-12">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <Suspense fallback={<div className="w-full h-64" />}>
              <UserGallery />
            </Suspense>
          </div>
        </section>

        {/* Applications Section - Muted background */}
        <section
          id="verified-apps"
          className="bg-muted pt-8 pb-16 sm:pt-10 sm:pb-20 lg:pt-12 lg:pb-24"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight">
                  Verified Applications
                </h2>
                <p className="text-sm text-muted-foreground">
                  Browse all verified TEE applications on dstack
                </p>
              </div>
              <Suspense fallback={<div className="w-full h-96" />}>
                <HomeClient />
              </Suspense>
            </div>
          </div>
        </section>
      </div>
    </HydrationBoundary>
  )
}
