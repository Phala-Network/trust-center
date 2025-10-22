'use client'

import {useAtom} from 'jotai'
import {Activity, Check} from 'lucide-react'
import Image from 'next/image'
import type React from 'react'

import {AppLogo} from '@/components/app-logo'
import {useAttestationData} from '@/components/attestation-data-context'
import {Badge} from '@/components/ui/badge'
import {
  type ReportItem,
  CollapsibleReportItemCard,
} from '@/components/visualization/collapsible-report-item-card'
import {REPORT_ITEMS} from '@/data/report-items'
import {getAppBadges} from '@/lib/app-badges'
import {taskAtom} from '@/stores/app'

interface TrustSection {
  id: string
  title: string
  items: ReportItem[]
}

// Configuration interface for widget customization
export interface CompactReportWidgetConfig {
  showHeader?: boolean
  showAttributes?: boolean
  showVerificationStatus?: boolean
  defaultExpanded?: boolean
  showSectionContent?: boolean
  customAppName?: string
  customAppUser?: string
  sections?: {
    hardware?: boolean
    sourceCode?: boolean
    zeroTrust?: boolean
    os?: boolean
    authority?: boolean
  }
}

const DEFAULT_CONFIG: Required<CompactReportWidgetConfig> = {
  showHeader: true,
  showAttributes: true,
  showVerificationStatus: true,
  defaultExpanded: false,
  showSectionContent: true,
  sections: {
    hardware: true,
    sourceCode: true,
    zeroTrust: true,
    os: true,
    authority: true,
  },
}

// Trust verification sections configuration
const ALL_TRUST_SECTIONS: TrustSection[] = [
  {
    id: 'hardware',
    title: 'TEE Hardware Verified',
    items: [REPORT_ITEMS['app-cpu'], REPORT_ITEMS['app-gpu']],
  },
  {
    id: 'source_code',
    title: 'Source Code Verified',
    items: [REPORT_ITEMS['app-code']],
  },
  {
    id: 'zero_trust',
    title: 'Network End-to-End Encrypted',
    items: [REPORT_ITEMS['gateway-main']],
  },
  {
    id: 'os',
    title: 'Operating System Verified',
    items: [REPORT_ITEMS['app-os']],
  },
  {
    id: 'authority',
    title: 'Distributed Root-of-Trust Verified',
    items: [REPORT_ITEMS['kms-main']],
  },
]

// Map section IDs to config keys
const SECTION_CONFIG_MAP: Record<
  string,
  keyof CompactReportWidgetConfig['sections']
> = {
  hardware: 'hardware',
  source_code: 'sourceCode',
  zero_trust: 'zeroTrust',
  os: 'os',
  authority: 'authority',
}

// Compact Report Header Component
const CompactReportHeader: React.FC<{
  showAttributes: boolean
  showVerificationStatus: boolean
  customAppName?: string
  customAppUser?: string
}> = ({showAttributes, showVerificationStatus, customAppName, customAppUser}) => {
  const [task] = useAtom(taskAtom)
  const badges = getAppBadges(task?.dstackVersion, task?.dataObjects)

  if (!task) {
    return null
  }

  const displayName = customAppName || task.appName
  const displayUser = customAppUser || task.user

  return (
    <>
      {/* Phala Trust Certificate Header */}
      <div className="bg-gradient-to-br from-muted/40 to-muted/20 p-5 border-b border-border/50">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Image src="/logo.svg" alt="Phala" width={60} height={20} />
          <span className="text-xs font-semibold text-muted-foreground">
            Trust Certificate
          </span>
        </div>

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
            <h1 className="text-lg font-semibold tracking-tight truncate leading-tight text-foreground">{displayName}</h1>
            <div className="flex items-center gap-2 mt-1">
              {badges.versionBadge.show && (
                <Badge variant="secondary" className="flex items-center gap-1.5 text-xs h-5 px-2">
                  <Image src="/dstack.svg" alt="DStack" width={48} height={12} className="opacity-70" />
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
        <div className="p-5 space-y-3">
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
            <span className="flex-1 text-muted-foreground text-sm">
              {new Date(task.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>
      )}

      {/* Verification Status Badge */}
      {showVerificationStatus && (
        <div className="border-t px-4 py-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground mx-auto mb-2">
            <Check className="h-5 w-5" />
          </div>
          <h2 className="font-semibold text-sm text-center text-foreground">Verified & Trusted</h2>
          <p className="mt-1 text-xs text-muted-foreground text-center leading-relaxed">
            Complete chain of trust verification including hardware, OS, source
            code, network infrastructure, and trust authority.
          </p>
        </div>
      )}
    </>
  )
}

// Section Component - Redesigned as Badge Card
const TrustSection: React.FC<{
  section: TrustSection
  defaultExpanded: boolean
  showContent: boolean
}> = ({section, defaultExpanded, showContent}) => {
  const {attestationData} = useAttestationData()

  const filteredItems = section.items.filter((item) => {
    return attestationData.some((obj) => obj.id === item.id)
  })

  if (filteredItems.length === 0) {
    return null
  }

  return (
    <div className="rounded-lg p-3.5 bg-card border border-border shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="rounded-full bg-primary text-primary-foreground p-1 flex-shrink-0">
          <Check className="h-3.5 w-3.5" />
        </div>
        <h3 className="font-semibold text-sm text-foreground">
          {section.title}
        </h3>
      </div>

      {showContent && (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <CollapsibleReportItemCard
              key={item.id}
              item={item}
              defaultExpanded={defaultExpanded}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Main Compact Report Widget Component
const CompactReportWidget: React.FC<{
  config?: CompactReportWidgetConfig
}> = ({config = {}}) => {
  // Merge with default config
  const finalConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    sections: {
      ...DEFAULT_CONFIG.sections,
      ...config.sections,
    },
  }

  // Filter sections based on config
  const visibleSections = ALL_TRUST_SECTIONS.filter((section) => {
    const configKey = SECTION_CONFIG_MAP[section.id]
    return configKey ? finalConfig.sections[configKey] : true
  })

  return (
    <div className="relative p-4">
      {/* Dotted background layer */}
      <div
        className="absolute inset-0 pointer-events-none opacity-15"
        style={{
          backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      />

      {/* Widget content */}
      <div className="space-y-3 text-foreground max-w-sm relative mx-auto">
        {finalConfig.showHeader && (
          <div className="rounded-lg overflow-hidden bg-card border border-border shadow-sm">
            <CompactReportHeader
              showAttributes={finalConfig.showAttributes}
              showVerificationStatus={finalConfig.showVerificationStatus}
              customAppName={config.customAppName}
              customAppUser={config.customAppUser}
            />
          </div>
        )}

        <div className="space-y-2">
          {visibleSections.map((section) => (
            <TrustSection
              key={section.id}
              section={section}
              defaultExpanded={finalConfig.defaultExpanded}
              showContent={finalConfig.showSectionContent}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default CompactReportWidget
