'use client'

import {SearchX} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import {memo} from 'react'

import {AppLogo} from '@/components/app-logo'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {Badge} from '@/components/ui/badge'
import {getAppBadges} from '@/lib/app-badges'
import {type AppWithTask} from '@/lib/db'

const AppCard = memo(function AppCard({app}: {app: AppWithTask}) {
  const badges = getAppBadges(
    app.dstackVersion,
    app.chainId,
    app.kmsContractAddress,
    app.task.dataObjects,
  )

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
      className="group block overflow-hidden rounded-[4px] border border-border bg-card transition-colors hover:border-primary-700 dark:hover:border-primary"
    >
      {/* Identity row */}
      <div className="border-border border-b p-4">
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <Avatar className="size-12 shrink-0 rounded-[4px] border border-border">
              <AvatarImage
                src={avatarUrl}
                alt={displayName}
                className="object-contain"
              />
              <AvatarFallback className="rounded-[4px] font-mono text-xs">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <AppLogo
              appId={app.id}
              appName={displayName}
              size="md"
              className="size-12 shrink-0"
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            {displayOwner && (
              <p className="truncate font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">
                {displayOwner}
              </p>
            )}
            <h3 className="truncate font-display text-lg leading-tight text-foreground">
              {displayName}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {badges.versionBadge.show && (
                <Badge
                  variant="secondary"
                  className="flex h-5 items-center gap-1.5 rounded-[4px] px-2 font-mono text-[10px]"
                >
                  <Image
                    src="/dstack.svg"
                    alt="dstack"
                    width={36}
                    height={10}
                    className="opacity-70 dark:hidden"
                  />
                  <Image
                    src="/dstack_dark.svg"
                    alt="dstack"
                    width={36}
                    height={10}
                    className="hidden opacity-70 dark:block"
                  />
                  <span>{badges.versionBadge.fullVersion}</span>
                </Badge>
              )}
              {badges.kmsBadge.show && (
                <Badge
                  variant="outline"
                  className="h-5 rounded-[4px] px-2 font-mono text-[10px] uppercase tracking-wider"
                >
                  {badges.kmsBadge.text}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metadata grid */}
      <dl className="divide-y divide-border">
        <div className="flex items-center gap-3 px-4 py-2 text-sm">
          <dt className="w-[72px] shrink-0 font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">
            Domain
          </dt>
          <dd className="min-w-0 flex-1 truncate text-foreground">
            {displayDomain}
          </dd>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 text-sm">
          <dt className="w-[72px] shrink-0 font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">
            Contract
          </dt>
          <dd
            className="min-w-0 flex-1 truncate font-mono text-xs text-foreground"
            title={app.contractAddress}
          >
            {app.contractAddress}
          </dd>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 text-sm">
          <dt className="w-[72px] shrink-0 font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">
            Created
          </dt>
          <dd className="min-w-0 flex-1 font-mono text-xs text-muted-foreground">
            {new Date(app.task.createdAt).toLocaleString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
          </dd>
        </div>
      </dl>
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
      <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
        <div className="mb-6 rounded-[4px] border border-border bg-muted/40 p-5">
          <SearchX className="size-10 text-muted-foreground" />
        </div>
        <h3 className="mb-2 font-display text-2xl text-foreground">
          {hasFilters ? 'No matches found' : 'No applications yet'}
        </h3>
        <p className="max-w-md leading-relaxed text-muted-foreground">
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
        <p className="font-mono text-[11px] uppercase tracking-[.14em] text-muted-foreground">
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {apps.map((app) => (
          <AppCard key={app.id} app={app} />
        ))}
      </div>
    </div>
  )
}
