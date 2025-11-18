import {Check, ExternalLink, HelpCircle} from 'lucide-react'
import Image from 'next/image'
import type React from 'react'

import {AppLogo} from '@/components/app-logo'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip'
import {getAppBadges} from '@/lib/app-badges'
import type {AppWithTask} from '@/lib/db'

// Shared Report Header Component
export const ReportHeader: React.FC<{
  app: AppWithTask
  showAttributes?: boolean
  showVerificationStatus?: boolean
  showBranding?: boolean
  showTrustCenterButton?: boolean
  appId?: string
  taskId?: string
}> = ({
  app,
  showAttributes = true,
  showVerificationStatus = true,
  showBranding = false,
  showTrustCenterButton = false,
  appId,
  taskId,
}) => {
  const badges = getAppBadges(app?.dstackVersion, app?.task.dataObjects)

  // Use profile display name if available, otherwise fallback to appName
  const displayName = app.profile?.displayName || app.appName
  // Show workspace displayName (all apps should have featured builder workspace profile)
  const displayUser = app.workspaceProfile?.displayName || undefined
  // Use customDomain if available, otherwise fallback to modelOrDomain
  const displayDomain = app.profile?.customDomain || app.modelOrDomain

  // Get avatar URL from profile (priority: app → workspace → user)
  const avatarUrl =
    app.profile?.fullAvatarUrl ||
    app.workspaceProfile?.fullAvatarUrl ||
    app.userProfile?.fullAvatarUrl

  return (
    <div>
      {/* Phala Trust Certificate Branding - optional */}
      {showBranding && (
        <div className="bg-gradient-to-br from-muted/40 to-muted/20 px-5 py-3 border-b border-border/50 mb-4">
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
            <span className="text-xs font-semibold text-muted-foreground">
              Trust Certificate
            </span>
          </div>
        </div>
      )}

      {/* Header section */}
      <div className="px-5 mb-4">
        <div className="flex items-center gap-4">
          {/* Use profile avatar if available, otherwise fallback to AppLogo */}
          {avatarUrl ? (
            <Avatar className="w-14 h-14 shrink-0 ring-2 ring-background shadow-sm rounded-lg">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback className="rounded-lg">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <AppLogo
              user={displayUser}
              appName={displayName}
              size="lg"
              className="w-14 h-14 shrink-0 ring-2 ring-background shadow-sm"
            />
          )}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            {displayUser && (
              <p className="text-xs font-medium text-muted-foreground/90 truncate leading-tight">
                {displayUser}
              </p>
            )}
            <h1 className="text-lg font-semibold tracking-tight truncate leading-tight">
              {displayName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
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
                    className="opacity-70 dark:hidden"
                  />
                  <Image
                    src="/dstack_dark.svg"
                    alt="DStack"
                    width={48}
                    height={12}
                    className="opacity-70 hidden dark:block"
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
        {/* Description in header section */}
        {app.profile?.description && (
          <div className="mt-3">
            <p className="text-sm text-muted-foreground/80 leading-relaxed">
              {app.profile.description}
            </p>
          </div>
        )}
      </div>

      {/* Attributes Section */}
      {showAttributes && (
        <div className="px-5 mb-4 space-y-3">
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
            <span className="flex-1 font-mono text-xs break-all">
              {app.contractAddress}
            </span>
          </div>

          <div className="flex items-center gap-3 text-sm pt-3 mt-3 border-t border-border/50">
            <span className="text-muted-foreground/70 min-w-[72px] font-medium text-xs uppercase tracking-wide">
              Attestation Time
            </span>
            <span className="text-muted-foreground">
              {new Date(app.task.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>
      )}

      {/* View in Trust Center button - above verification status */}
      {showTrustCenterButton && appId && taskId && (
        <div className="px-5 mb-4">
          <Button variant="outline" size="sm" className="w-full gap-2" asChild>
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

      {/* Verification Status Section */}
      {showVerificationStatus && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 px-5 py-4 mb-4">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" />
            <h2 className="font-medium">This App Has Been Verified</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="ml-1 text-emerald-600/70 dark:text-emerald-400/70 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  We display the complete chain of trust, including server
                  hardware, operating system, application code, network
                  infrastructure, and trust authority. Each component provides
                  verifiable attestation reports, along with all the information
                  and tools you need for independent verification.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
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
      <div className="flex-shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-900/50 p-1">
        <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
    </div>
  </div>
)
