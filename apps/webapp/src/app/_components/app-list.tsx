'use client'

import slugify from '@sindresorhus/slugify'
import {AlertCircle, SearchX} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import {memo} from 'react'

import {AppLogo} from '@/components/app-logo'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {Badge} from '@/components/ui/badge'
import {getAppBadges} from '@/lib/app-badges'
import {type AppWithTask} from '@/lib/db'
import {isReportStale} from '@/lib/utils'

const AppCard = memo(function AppCard({app}: {app: AppWithTask}) {
  const badges = getAppBadges(app.dstackVersion, app.task.dataObjects)
  const stale = isReportStale(app.task.createdAt)

  // Determine display name: use profile displayName if available, fallback to appName
  const displayName = app.profile?.displayName || app.appName
  // Show workspace displayName (all apps should have featured builder workspace profile)
  const displayOwner = app.workspaceProfile?.displayName || undefined
  // Use customDomain if available, otherwise fallback to domain
  const displayDomain = app.profile?.customDomain || app.domain

  // Avatar priority: app → workspace → user
  const avatarUrl =
    app.profile?.fullAvatarUrl ||
    app.workspaceProfile?.fullAvatarUrl ||
    app.userProfile?.fullAvatarUrl

  return (
    <Link
      href={`/app/${app.id}`}
      className="group block bg-card rounded-xl border border-border hover:border-border/80 hover:shadow-lg transition-all duration-300 overflow-hidden"
    >
      {/* Header with gradient background */}
      <div className="bg-gradient-to-br from-muted/40 to-muted/20 p-5 border-b border-border/50">
        <div className="flex items-center gap-4">
          {/* Use profile avatar if available (app/workspace/user priority), otherwise fallback to AppLogo */}
          {avatarUrl ? (
            <Avatar className="w-14 h-14 flex-shrink-0 ring-2 ring-background shadow-sm rounded-lg">
              <AvatarImage src={avatarUrl} alt={displayName} className="object-contain" />
              <AvatarFallback className="rounded-lg">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <AppLogo
              user={displayOwner}
              appName={app.appName}
              size="lg"
              className="w-14 h-14 flex-shrink-0 ring-2 ring-background shadow-sm"
            />
          )}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            {/* Owner: show workspace displayName if available, otherwise user field */}
            {displayOwner && (
              <div className="text-xs font-medium text-muted-foreground/90 truncate leading-tight">
                {displayOwner}
              </div>
            )}
            <h3 className="text-lg font-semibold tracking-tight truncate leading-tight">
              {displayName}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {badges.versionBadge.show && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1.5 text-xs h-5 px-2"
                >
                  <Image
                    src="/dstack.svg"
                    alt="DStack"
                    width={48}
                    height={12}
                    className="opacity-70"
                  />
                  <span className="font-semibold">
                    {badges.versionBadge.fullVersion}
                  </span>
                </Badge>
              )}
              {badges.kmsBadge.show && (
                <Badge
                  variant="outline"
                  className="text-xs h-5 px-2 font-medium"
                >
                  {badges.kmsBadge.text}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Attributes Section */}
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground/70 min-w-[72px] font-medium text-xs uppercase tracking-wide">
            Domain
          </span>
          <span className="flex-1 truncate text-foreground">
            {displayDomain}
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

        <div className="flex items-center gap-3 text-sm pt-3 mt-3 border-t border-border/50">
          <span className="text-muted-foreground/70 min-w-[72px] font-medium text-xs uppercase tracking-wide">
            Created
          </span>
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <span className="text-muted-foreground">
              {new Date(app.task.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
            {/* {stale && (
              <Badge
                variant="outline"
                className="flex items-center gap-1 text-xs h-5 px-2 text-amber-600 border-amber-600/30 bg-amber-50/50 dark:bg-amber-950/20"
              >
                <AlertCircle className="h-3 w-3" />
                May be outdated
              </Badge>
            )} */}
          </div>
        </div>
      </div>
    </Link>
  )
})

interface AppListProps {
  apps: AppWithTask[]
  hasFilters?: boolean
  total?: number
}

export function AppList({apps, hasFilters = false, total}: AppListProps) {
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
            ? "Try adjusting your search terms or filters to find what you're looking for."
            : 'No verified applications are available at the moment.'}
        </p>
      </div>
    )
  }

  const displayTotal = total ?? apps.length

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {apps.length === displayTotal ? (
            <>
              {displayTotal}{' '}
              {displayTotal === 1 ? 'application' : 'applications'}{' '}
              {hasFilters && 'found'}
            </>
          ) : (
            <>
              Showing {apps.length} of {displayTotal}{' '}
              {displayTotal === 1 ? 'application' : 'applications'}{' '}
              {hasFilters && 'found'}
            </>
          )}
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
