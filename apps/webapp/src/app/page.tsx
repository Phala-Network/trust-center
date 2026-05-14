import {dehydrate, HydrationBoundary, QueryClient} from '@tanstack/react-query'
import {Suspense} from 'react'

import Footer from '@/components/footer'
import {Hero} from '@/components/hero'
import {PhalaNavbar} from '@/components/navbar'
import {UserGalleryStrip} from '@/components/user-gallery'
import {getApps, getDstackVersions, getUsers} from '@/lib/db'
import {HomeClient} from './_components/home-client'

export default async function HomePage() {
  const queryClient = new QueryClient()

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

  await queryClient.prefetchQuery({
    queryKey: ['users'],
    queryFn: () => getUsers(),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PhalaNavbar />
      <main className="min-h-screen pt-[72px]">
        <section className="relative bg-background">
          <Hero />
        </section>

        <section
          id="verified-apps"
          className="border-border border-t bg-background py-16 md:py-20"
        >
          <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-12">
            <div className="space-y-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="mb-3 font-mono text-[11px] uppercase tracking-[.14em] text-muted-foreground">
                    Verified applications
                  </p>
                  <h2 className="font-display text-[clamp(30px,2.8vw,46px)] leading-[1.08] text-foreground">
                    Browse the registry.
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                    Every public TEE application on dstack with a completed
                    verification, filterable by dstack version.
                  </p>
                </div>
                <Suspense fallback={null}>
                  <UserGalleryStrip max={6} />
                </Suspense>
              </div>
              <Suspense fallback={<div className="h-96 w-full" />}>
                <HomeClient />
              </Suspense>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </HydrationBoundary>
  )
}
