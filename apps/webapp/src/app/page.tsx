import {Activity, CheckCircle} from 'lucide-react'
import Link from 'next/link'

import {AppLogo} from '@/components/app-logo'
import {getApps} from '@/lib/task-api'

export const dynamic = 'force-dynamic'

function AppCard({app}: {app: any}) {
  return (
    <Link
      href={`/app/${app.appId}`}
      className="bg-background flex gap-4 rounded-lg border border-border p-4 hover:shadow-md transition-all duration-200 sm:gap-6 sm:p-5"
    >
      {/* App Logo */}
      <AppLogo appName={app.appName} size="lg" className="sm:w-16 sm:h-16" />

      {/* App Content */}
      <div className="flex flex-col justify-between flex-1 min-w-0">
        <div>
          <h3 className="text-base font-medium sm:text-lg truncate">
            {app.appName}
          </h3>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {app.appConfigType} • {app.modelOrDomain}
          </p>
          <p className="text-muted-foreground mt-1 text-xs truncate">
            Contract: {app.contractAddress}
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground sm:text-sm mt-3">
          <Activity className="size-3 sm:size-4 flex-shrink-0" />
          <span>Created: {new Date(app.createdAt).toLocaleDateString()}</span>
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
          Your TEE applications will appear here once they're registered and
          generating attestation reports.
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

export default async function HomePage() {
  // Fetch data at the top level using new App API
  const apps = await getApps({includeStats: true, sortBy: 'appName'})
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
            <AppList apps={apps} />
          </div>
        </div>
      </section>
    </div>
  )
}
