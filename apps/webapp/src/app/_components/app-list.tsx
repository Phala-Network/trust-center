import {Activity, Database, SearchX} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import {memo} from 'react'

import {AppLogo} from '@/components/app-logo'
import {Badge} from '@/components/ui/badge'
import type {App} from '@/lib/db'

const AppCard = memo(function AppCard({app}: {app: App}) {
  return (
    <Link
      href={`/app/${app.appId}`}
      className="group block bg-card rounded-xl border border-border hover:border-border/80 hover:shadow-lg transition-all duration-300 overflow-hidden"
    >
      {/* Header with gradient background */}
      <div className="bg-gradient-to-br from-muted/40 to-muted/20 p-5 border-b border-border/50">
        <div className="flex items-start gap-4">
          <AppLogo
            appId={app.appId}
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
          {app.dataObjectsCount && app.dataObjectsCount > 0 && (
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
})

interface AppListProps {
  apps: App[]
  hasFilters?: boolean
}

export function AppList({apps, hasFilters = false}: AppListProps) {
  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-24 px-4">
        <div className="bg-muted/50 rounded-full p-6 mb-6">
          <SearchX className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="text-2xl font-semibold mb-2">
          {hasFilters ? 'No matches found' : 'No applications yet'}
        </h3>
        <p className="text-muted-foreground max-w-md leading-relaxed">
          {hasFilters
            ? 'Try adjusting your search terms or filters to find what you\'re looking for.'
            : 'No verified applications are available at the moment.'}
        </p>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {apps.length} {apps.length === 1 ? 'application' : 'applications'}{' '}
          {hasFilters && 'found'}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {apps.map((app) => (
          <AppCard key={app.id} app={app} />
        ))}
      </div>
    </div>
  )
}
