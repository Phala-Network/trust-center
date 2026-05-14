import {Check, Copy, ExternalLink} from 'lucide-react'
import Image from 'next/image'
import type React from 'react'
import {useState} from 'react'

import {AppLogo} from '@/components/app-logo'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {getAppBadges} from '@/lib/app-badges'
import type {AppWithTask} from '@/lib/db'

const CopyHashButton: React.FC<{value: string}> = ({value}) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      console.error('Failed to copy')
    }
  }

  return (
    <button
      type="button"
      aria-label="Copy address"
      className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
      onClick={handleCopy}
    >
      <Copy className="size-3" />
      {copied ? 'copied' : 'copy'}
    </button>
  )
}

const truncateMiddle = (s: string, head = 6, tail = 4): string =>
  s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s

// Top branding component - Phala Trust Certificate
export const TopBranding: React.FC = () => (
  <div className="border-b border-border bg-muted/40 px-5 py-3">
    <div className="flex items-center justify-center gap-2">
      <Image
        src="/logo.svg"
        alt="Phala"
        width={60}
        height={20}
        className="dark:hidden"
      />
      <Image
        src="/logo_dark.svg"
        alt="Phala"
        width={60}
        height={20}
        className="hidden dark:block"
      />
      <span className="font-mono text-[11px] uppercase tracking-[.14em] text-muted-foreground">
        Trust Certificate
      </span>
    </div>
  </div>
)

// Shared Report Header Component
export const ReportHeader: React.FC<{
  app: AppWithTask
  showAttributes?: boolean
  showVerificationStatus?: boolean
  showTrustCenterButton?: boolean
  showAppInfo?: boolean
  appId?: string
  taskId?: string
}> = ({
  app,
  showAttributes = true,
  showVerificationStatus = true,
  showTrustCenterButton = false,
  showAppInfo = true,
  appId,
  taskId,
}) => {
  const badges = getAppBadges(app?.dstackVersion, app?.task.dataObjects)

  // Check if app has GPU attestation
  const hasGpu = app?.task.dataObjects?.includes('app-gpu') ?? false

  // Use profile display name if available, otherwise fallback to appName
  const displayName = app.profile?.displayName || app.appName
  // Show workspace displayName (all apps should have featured builder workspace profile)
  const displayUser = app.workspaceProfile?.displayName || undefined
  // Use customDomain if available, otherwise fallback to domain
  const displayDomain = app.profile?.customDomain || app.domain

  // Get avatar URL from profile (priority: app → workspace → user)
  const avatarUrl =
    app.profile?.fullAvatarUrl ||
    app.workspaceProfile?.fullAvatarUrl ||
    app.userProfile?.fullAvatarUrl

  return (
    <div className="overflow-hidden rounded-[4px] border border-border bg-card">
      {/* Identity row — eyebrow + title + status pill in one tight zone */}
      {showAppInfo && (
        <div className="px-5 pt-4 pb-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">
              App
            </p>
            {showVerificationStatus && (
              <span className="inline-flex items-center gap-1.5 border border-emerald-300 bg-emerald-50 px-2 py-1 font-mono text-[10px] uppercase tracking-[.14em] text-emerald-800">
                <Check className="size-3 text-emerald-700" strokeWidth={3} />
                Verified
              </span>
            )}
          </div>

          <div className="flex items-start gap-3">
            {avatarUrl ? (
              <Avatar className="size-12 shrink-0 rounded-[4px] border border-border">
                <AvatarImage
                  src={avatarUrl}
                  alt={displayName}
                  className="object-contain"
                />
                <AvatarFallback className="rounded-[4px]">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <AppLogo
                appId={app.id ?? undefined}
                appName={displayName}
                size="md"
                className="size-12 shrink-0"
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              {displayUser && (
                <p className="truncate font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">
                  {displayUser}
                </p>
              )}
              <h1 className="truncate font-display text-2xl leading-tight text-foreground">
                {displayName}
              </h1>
              {/* compact one-liner: dstack version · attested by intel/nvidia */}
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                {badges.versionBadge.show && (
                  <span className="inline-flex items-center gap-1">
                    <Image
                      src="/dstack.svg"
                      alt="dstack"
                      width={42}
                      height={11}
                      className="opacity-70 dark:hidden"
                    />
                    <Image
                      src="/dstack_dark.svg"
                      alt="dstack"
                      width={42}
                      height={11}
                      className="opacity-70 hidden dark:block"
                    />
                    <span className="font-mono text-[11px]">
                      {badges.versionBadge.fullVersion}
                    </span>
                  </span>
                )}
                <span className="text-muted-foreground/40">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span>attested by</span>
                  <Image
                    src="/intel_white.png"
                    alt="Intel"
                    width={28}
                    height={11}
                  />
                  {hasGpu && (
                    <>
                      <span>+</span>
                      <Image
                        src="/nvidia.svg"
                        alt="NVIDIA"
                        width={42}
                        height={11}
                        className="dark:hidden"
                      />
                      <Image
                        src="/nvidia_dark.svg"
                        alt="NVIDIA"
                        width={42}
                        height={11}
                        className="hidden dark:block"
                      />
                    </>
                  )}
                </span>
                {badges.kmsBadge.show && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <Badge
                      variant="outline"
                      className="h-5 rounded-[4px] px-2 font-mono text-[10px] uppercase tracking-wider"
                    >
                      {badges.kmsBadge.text}
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </div>

          {app.profile?.description && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground/80">
              {app.profile.description}
            </p>
          )}
        </div>
      )}

      {/* Compact metadata grid */}
      {showAppInfo && showAttributes && (
        <div className="border-t border-border">
          <dl className="divide-y divide-border">
            <div className="flex items-center gap-3 px-5 py-2 text-sm">
              <dt className="w-[72px] shrink-0 font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">
                Domain
              </dt>
              <dd className="min-w-0 flex-1 truncate text-foreground">
                {displayDomain}
              </dd>
            </div>
            <div className="flex items-center gap-3 px-5 py-2 text-sm">
              <dt className="w-[72px] shrink-0 font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">
                Contract
              </dt>
              <dd
                className="min-w-0 flex-1 truncate font-mono text-xs text-foreground"
                title={app.contractAddress}
              >
                {truncateMiddle(app.contractAddress, 8, 6)}
              </dd>
              <CopyHashButton value={app.contractAddress} />
            </div>
            <div className="flex items-center gap-3 px-5 py-2 text-sm">
              <dt className="w-[72px] shrink-0 font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">
                Time
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
        </div>
      )}

      {/* View in Trust Center button (widget-mode only) */}
      {showTrustCenterButton && appId && taskId && (
        <div className="border-t border-border px-5 py-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 rounded-[4px]"
            asChild
          >
            <a
              href={`/app/${appId}/${taskId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View in Trust Center
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      )}
    </div>
  )
}

// Shared Section Header Component
export const SectionHeader: React.FC<{
  title: string
}> = ({title}) => (
  <div>
    <div className="flex items-center gap-2 px-1">
      <div className="flex-shrink-0 rounded-[4px] bg-primary/15 p-1">
        <Check className="h-4 w-4 text-primary-700 dark:text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-mono text-[11px] uppercase tracking-[.14em] text-muted-foreground">
          {title}
        </h3>
      </div>
    </div>
  </div>
)
