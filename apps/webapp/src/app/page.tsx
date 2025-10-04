import {Activity, CheckCircle, Database} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import {AppFilters} from '@/components/app-filters'
import {AppLogo} from '@/components/app-logo'
import {Badge} from '@/components/ui/badge'
import {getApps, getDstackVersions} from '@/lib/db'

export const dynamic = 'force-dynamic'

function AppCard({app}: {app: any}) {
  return (
    <Link
      href={`/app/${app.appId}`}
      className="group block bg-card rounded-xl border border-border hover:border-border/80 hover:shadow-lg transition-all duration-300 overflow-hidden"
    >
      {/* Header with gradient background */}
      <div className="bg-gradient-to-br from-muted/40 to-muted/20 p-5 border-b border-border/50">
        <div className="flex items-start gap-4">
          <AppLogo
            appName={app.appName}
            size="lg"
            className="w-14 h-14 flex-shrink-0 ring-2 ring-background shadow-sm"
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold tracking-tight truncate">
              {app.appName}
            </h3>
            <p className="text-xs text-muted-foreground/80 truncate mt-0.5 font-mono">
              {app.appId}
            </p>
          </div>
          {app.dataObjectsCount > 0 && (
            <Badge
              variant="secondary"
              className="flex items-center gap-1.5 text-xs flex-shrink-0 shadow-sm"
            >
              <Database className="h-3 w-3" />
              <span className="font-semibold">{app.dataObjectsCount}</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Attributes Section */}
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground/70 min-w-[72px] font-medium text-xs uppercase tracking-wide">
            Type
          </span>
          <span className="flex-1 font-medium text-foreground">
            {app.appConfigType}
          </span>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground/70 min-w-[72px] font-medium text-xs uppercase tracking-wide">
            Domain
          </span>
          <span className="flex-1 truncate text-foreground">
            {app.modelOrDomain}
          </span>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground/70 min-w-[72px] font-medium text-xs uppercase tracking-wide">
            Contract
          </span>
          <span className="flex-1 truncate font-mono text-xs">
            {app.contractAddress}
          </span>
        </div>

        {app.dstackVersion && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground/70 min-w-[72px] font-medium text-xs uppercase tracking-wide">
              Version
            </span>
            <div className="flex items-center gap-2 flex-1">
              <Image
                className="opacity-70"
                src="/dstack.svg"
                alt="DStack"
                width={60}
                height={14}
              />
              <span className="font-medium text-foreground">
                {app.dstackVersion.replace('dstack-', '')}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 text-sm pt-3 mt-3 border-t border-border/50">
          <span className="text-muted-foreground/70 min-w-[72px] font-medium text-xs uppercase tracking-wide">
            Created
          </span>
          <div className="flex items-center gap-2 flex-1">
            <Activity className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="text-muted-foreground">
              {new Date(app.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

function AppStats({totalApps}: {totalApps: number}) {
  return (
    <div className="flex items-center justify-center">
      <div className="flex items-center gap-2 text-lg font-medium text-muted-foreground">
        <CheckCircle className="w-5 h-5 text-green-500" />
        <span>
          {totalApps} {totalApps === 1 ? 'app has' : 'apps have'} been verified
        </span>
      </div>
    </div>
  )
}

function AppList({apps}: {apps: any[]}) {
  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16">
        <h3 className="text-xl font-medium">No Applications Found</h3>
        <p className="text-muted-foreground mt-2 max-w-md">
          No applications match your search criteria. Try adjusting your
          filters.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 w-full">
      {apps.map((app) => (
        <AppCard key={app.id} app={app} />
      ))}
    </div>
  )
}

interface HomePageProps {
  searchParams: Promise<{
    keyword?: string
    dstackVersions?: string
  }>
}

export default async function HomePage({searchParams}: HomePageProps) {
  const params = await searchParams
  const selectedVersions = params.dstackVersions
    ? params.dstackVersions.split(',')
    : []
  const apps = await getApps({
    sortBy: 'appName',
    keyword: params.keyword,
    dstackVersions: selectedVersions,
  })
  const dstackVersions = await getDstackVersions({keyword: params.keyword})
  const totalApps = apps.length

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <section className="py-16 sm:py-24 lg:py-32">
          <div className="text-center">
            <h1 className="mx-auto my-4 mb-6 max-w-3xl text-2xl font-bold sm:text-3xl lg:text-5xl">
              Phala Trust Center
            </h1>
            <p className="mx-auto mb-6 max-w-2xl text-sm text-muted-foreground sm:mb-8 sm:text-base lg:text-xl">
              Trusted Execution Environment attestation data visualization and
              reporting dashboard for secure computing environments.
            </p>
            <div className="flex justify-center px-4 lg:mt-10">
              <AppStats totalApps={totalApps} />
            </div>
          </div>
        </section>
      </div>

      {/* Applications Section */}
      <section className="bg-muted/50 py-16 sm:py-24 lg:py-32 min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center">
            <h2 className="text-2xl font-medium mb-8 sm:text-3xl sm:mb-12 md:text-4xl md:mb-16">
              Verified Apps
            </h2>
            <AppFilters dstackVersions={dstackVersions} />
            <AppList apps={apps} />
          </div>
        </div>
      </section>
    </div>
  )
}
