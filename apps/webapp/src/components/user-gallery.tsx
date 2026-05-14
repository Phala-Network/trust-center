'use client'

import {ArrowRight} from 'lucide-react'
import Link from 'next/link'

import {AppLogo} from '@/components/app-logo'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {Button} from '@/components/ui/button'
import {useUsers} from '@/lib/queries'

interface FeaturedUser {
  user: string
  displayName: string
  count: number
  avatarUrl: string | null
}

/**
 * Compact horizontal strip of featured-builder chips. Designed to sit aside
 * the verified-apps section title rather than as its own full-bleed section.
 */
export function UserGalleryStrip({max = 6}: {max?: number} = {}) {
  const {data: users = []} = useUsers()

  if (users.length === 0) return null

  const visible = users.slice(0, max)
  const overflow = users.length - visible.length

  return (
    <div className="flex flex-col items-end gap-3">
      <p className="font-mono text-xs uppercase tracking-[.14em] text-muted-foreground">
        Featured builders
      </p>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {visible.map((item: FeaturedUser) => (
          <Link
            key={item.user}
            href={`/${item.user}`}
            className="group inline-flex items-center gap-3 rounded-[4px] border border-border bg-card px-4 py-2.5 transition-colors hover:border-primary-700 dark:hover:border-primary"
            title={`${item.displayName} · ${item.count} ${item.count === 1 ? 'app' : 'apps'}`}
          >
            {item.avatarUrl ? (
              <Avatar className="size-10 shrink-0 rounded-[4px]">
                <AvatarImage
                  src={item.avatarUrl}
                  alt={item.displayName}
                  className="object-contain"
                />
                <AvatarFallback className="rounded-[4px] font-mono text-xs">
                  {item.displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <AppLogo
                user={item.displayName}
                appName={item.displayName}
                size="md"
                className="size-10 shrink-0"
              />
            )}
            <span className="max-w-[220px] truncate text-base leading-none text-foreground">
              {item.displayName}
            </span>
            <span className="font-mono text-sm tabular-nums text-muted-foreground">
              {item.count}
            </span>
          </Link>
        ))}
        {overflow > 0 && (
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            +{overflow} more
          </span>
        )}
      </div>
    </div>
  )
}

export function UserGallery() {
  const {data: users = []} = useUsers()

  if (users.length === 0) {
    return null
  }

  return (
    <div className="space-y-8">
      {/* Section header — eyebrow + display title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[.14em] text-muted-foreground">
            Featured builders
          </p>
          <h2 className="font-display text-[clamp(28px,2.4vw,40px)] leading-[1.08] text-foreground">
            Trusted workspaces, verified.
          </h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-[4px] self-start sm:self-end"
          asChild
        >
          <a
            href="https://docs.phala.com/phala-cloud/attestation/feature-builder"
            target="_blank"
            rel="noopener noreferrer"
          >
            Become a featured builder
            <ArrowRight className="ml-1 size-4" />
          </a>
        </Button>
      </div>

      {/* Hairline grid */}
      <div className="grid gap-px border border-border bg-border sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {users.map(
          (item: {
            user: string
            displayName: string
            count: number
            avatarUrl: string | null
          }) => {
            const logoUrl = item.avatarUrl

            return (
              <Link
                key={item.user}
                href={`/${item.user}`}
                className="group flex items-center gap-3 bg-card p-4 transition-colors hover:bg-muted/40"
              >
                {logoUrl ? (
                  <Avatar className="size-12 shrink-0 rounded-[4px]">
                    <AvatarImage
                      src={logoUrl}
                      alt={item.displayName}
                      className="object-contain"
                    />
                    <AvatarFallback className="rounded-[4px] text-sm font-semibold">
                      {item.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <AppLogo
                    user={item.displayName}
                    appName={item.displayName}
                    size={48}
                    className="size-12 shrink-0"
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <h3 className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary-700 dark:group-hover:text-primary">
                    {item.displayName}
                  </h3>
                  <p className="font-mono text-[11px] uppercase tracking-[.08em] text-muted-foreground">
                    {item.count} {item.count === 1 ? 'app' : 'apps'}
                  </p>
                </div>
              </Link>
            )
          },
        )}
      </div>
    </div>
  )
}
