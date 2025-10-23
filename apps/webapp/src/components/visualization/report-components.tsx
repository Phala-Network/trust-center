import {Activity, Check} from 'lucide-react'
import Image from 'next/image'
import type React from 'react'

import {AppLogo} from '@/components/app-logo'
import {Badge} from '@/components/ui/badge'
import type {Task} from '@phala/trust-center-db'
import {getAppBadges} from '@/lib/app-badges'

// Shared Report Header Component
export const ReportHeader: React.FC<{
  task: Task
  showAttributes?: boolean
  showVerificationStatus?: boolean
  customAppName?: string
  showBranding?: boolean
}> = ({
  task,
  showAttributes = true,
  showVerificationStatus = true,
  customAppName,
  showBranding = false,
}) => {
  const badges = getAppBadges(task?.dstackVersion, task?.dataObjects)
  const displayName = customAppName || task.appName
  const displayUser = task.user

  return (
    <div className="space-y-2">
      {/* Phala Trust Certificate Branding - optional */}
      {showBranding && (
        <div className="bg-gradient-to-br from-muted/40 to-muted/20 px-5 py-3 border-b border-border/50">
          <div className="flex items-center justify-center gap-2">
            <Image src="/logo.svg" alt="Phala" width={60} height={20} className="dark:hidden" />
            <Image src="/logo_dark.svg" alt="Phala" width={60} height={20} className="hidden dark:block" />
            <span className="text-xs font-semibold text-muted-foreground">
              Trust Certificate
            </span>
          </div>
        </div>
      )}

      {/* Header section */}
      <div className="p-5">
        <div className="flex items-center gap-4">
          <AppLogo
            user={displayUser}
            appName={displayName}
            size="lg"
            className="w-14 h-14 flex-shrink-0 ring-2 ring-background shadow-sm"
          />
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
                <Badge variant="secondary" className="flex items-center gap-1.5 text-xs h-5 px-2">
                  <Image src="/dstack.svg" alt="DStack" width={48} height={12} className="opacity-70 dark:hidden" />
                  <Image src="/dstack_dark.svg" alt="DStack" width={48} height={12} className="opacity-70 hidden dark:block" />
                  <span className="font-semibold">
                    {badges.versionBadge.fullVersion}
                  </span>
                </Badge>
              )}
              {badges.kmsBadge.show && (
                <Badge variant="outline" className="text-xs h-5 px-2 font-medium">
                  {badges.kmsBadge.text}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Attributes Section */}
      {showAttributes && (
        <div className="px-5 space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground/70 min-w-[72px] font-medium text-xs uppercase tracking-wide">
              Type
            </span>
            <span className="flex-1 font-medium text-foreground">
              {task.appConfigType}
            </span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground/70 min-w-[72px] font-medium text-xs uppercase tracking-wide">
              Domain
            </span>
            <span className="flex-1 truncate text-foreground">
              {task.modelOrDomain}
            </span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground/70 min-w-[72px] font-medium text-xs uppercase tracking-wide">
              Contract
            </span>
            <span className="flex-1 truncate font-mono text-xs">
              {task.contractAddress}
            </span>
          </div>

          <div className="flex items-center gap-3 text-sm pt-3 mt-3 border-t border-border/50">
            <span className="text-muted-foreground/70 min-w-[72px] font-medium text-xs uppercase tracking-wide">
              Created
            </span>
            <div className="flex items-center gap-2 flex-1">
              <Activity className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className="text-muted-foreground">
                {new Date(task.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Verification Status Section */}
      {showVerificationStatus && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 px-5 py-4">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" />
            <h2 className="font-medium">This App Has Been Verified</h2>
          </div>
          <p className="mt-2 text-muted-foreground text-xs">
            We display the complete chain of trust, including server hardware,
            operating system, application code, network infrastructure, and trust
            authority. Each component provides verifiable attestation reports,
            along with all the information and tools you need for independent
            verification.
          </p>
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
