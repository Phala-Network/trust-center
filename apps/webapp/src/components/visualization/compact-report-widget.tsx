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
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-center gap-2">
          <Image src="/logo.svg" alt="Phala" width={60} height={20} />
          <span className="text-xs font-semibold text-muted-foreground">
            Trust Certificate
          </span>
        </div>

        <div className="flex items-center gap-3">
          <AppLogo
            user={displayUser}
            appName={displayName}
            size="md"
            className="w-12 h-12 ring-2 ring-primary/20"
          />
          <div className="flex-1 min-w-0">
            {displayUser && (
              <p className="text-xs text-muted-foreground truncate">
                {displayUser}
              </p>
            )}
            <h1 className="text-lg font-bold truncate text-foreground">{displayName}</h1>
            <div className="flex gap-1.5 mt-1">
              {badges.versionBadge.show && (
                <Badge variant="secondary" className="h-5 px-2">
                  <Image src="/dstack.svg" alt="DStack" width={40} height={10} className="opacity-70" />
                  <span className="ml-1 text-[10px] font-semibold">
                    {badges.versionBadge.fullVersion}
                  </span>
                </Badge>
              )}
              {badges.kmsBadge.show && (
                <Badge variant="outline" className="h-5 px-2 text-[10px]">
                  {badges.kmsBadge.text}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Attributes Section */}
      {showAttributes && (
        <div className="px-4 pb-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground min-w-16 text-xs font-medium">
              Type
            </span>
            <span className="flex-1 text-xs truncate text-foreground">
              {task.appConfigType}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground min-w-16 text-xs font-medium">
              Domain
            </span>
            <span className="flex-1 text-xs truncate text-foreground">
              {task.modelOrDomain}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground min-w-16 text-xs font-medium">
              Contract
            </span>
            <span className="flex-1 text-xs font-mono truncate text-foreground">
              {task.contractAddress}
            </span>
          </div>

          <div className="flex items-center gap-2 pt-2 mt-2 border-t">
            <span className="text-muted-foreground min-w-16 text-xs font-medium">
              Created
            </span>
            <span className="flex-1 text-xs text-muted-foreground">
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
}> = ({section, defaultExpanded}) => {
  const {attestationData} = useAttestationData()

  const filteredItems = section.items.filter((item) => {
    return attestationData.some((obj) => obj.id === item.id)
  })

  if (filteredItems.length === 0) {
    return null
  }

  return (
    <div className="rounded-lg p-3.5">
      <div className="flex items-center gap-2 mb-3">
        <div className="rounded-full bg-primary text-primary-foreground p-1">
          <Check className="h-3.5 w-3.5" />
        </div>
        <h3 className="font-semibold text-sm text-foreground">
          {section.title}
        </h3>
      </div>

      <div className="space-y-2">
        {filteredItems.map((item) => (
          <CollapsibleReportItemCard
            key={item.id}
            item={item}
            defaultExpanded={defaultExpanded}
          />
        ))}
      </div>
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
    <div className="space-y-3">
      {finalConfig.showHeader && (
        <div className="rounded-lg overflow-hidden bg-card">
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
          />
        ))}
      </div>
    </div>
  )
}

export default CompactReportWidget
