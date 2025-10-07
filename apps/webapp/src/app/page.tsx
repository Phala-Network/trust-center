import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import {Suspense} from 'react'

import {Hero} from '@/components/hero'
import {getApps, getDstackVersions} from '@/lib/db'
import {HomeClient} from './_components/home-client'

export default async function HomePage() {
  const queryClient = new QueryClient()

  // Prefetch initial data with empty filters
  await queryClient.prefetchQuery({
    queryKey: ['apps', {sortBy: 'appName'}],
    queryFn: () => getApps({sortBy: 'appName'}),
  })

  await queryClient.prefetchQuery({
    queryKey: ['dstack-versions', {}],
    queryFn: () => getDstackVersions(),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="min-h-screen">
        {/* Hero Section - Background (lighter) */}
        <section className="relative bg-background">
          <Hero />
        </section>

        {/* Applications Section - Muted (darker) */}
        <section id="verified-apps" className="bg-muted py-16 sm:py-20 lg:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center">
              <div className="text-center mb-10 sm:mb-12 lg:mb-16">
                <h2 className="text-2xl font-bold sm:text-3xl lg:text-4xl">
                  Verified Applications
                </h2>
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
