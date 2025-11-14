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
  ReportItemCard,
} from '@/components/visualization/report-item-card'
import {REPORT_ITEMS} from '@/data/report-items'
import {getAppBadges} from '@/lib/app-badges'
import {appWithTaskAtom} from '@/stores/app'

interface TrustSection {
  id: string
  title: string
  items: ReportItem[]
}

// Configuration interface for widget customization
export interface ReportWidgetConfig {
  showHeader?: boolean
  showAttributes?: boolean
  showVerificationStatus?: boolean
  sections?: {
    hardware?: boolean
    sourceCode?: boolean
    zeroTrust?: boolean
    os?: boolean
    authority?: boolean
  }
}

const DEFAULT_CONFIG: Required<ReportWidgetConfig> = {
  showHeader: true,
  showAttributes: true,
  showVerificationStatus: true,
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
  keyof NonNullable<ReportWidgetConfig['sections']>
> = {
  hardware: 'hardware',
  source_code: 'sourceCode',
  zero_trust: 'zeroTrust',
  os: 'os',
  authority: 'authority',
}

// Report Header Component
const ReportHeader: React.FC<{
  showAttributes: boolean
  showVerificationStatus: boolean
}> = ({showAttributes, showVerificationStatus}) => {
  const [app] = useAtom(appWithTaskAtom)
  const badges = getAppBadges(app?.dstackVersion, app?.task.dataObjects)

  if (!app) {
    return null
  }

  const displayUser =
    app.workspaceProfile?.displayName || app.customUser || undefined

  return (
    <div className="space-y-2">
      {/* Header section */}
      <div className="p-5">
        <div className="flex items-center gap-4">
          <AppLogo
            user={displayUser}
            appName={app.appName}
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
              {app.appName}
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
      {showAttributes && (
        <div className="px-5 space-y-3">
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
      )}

      {/* Verification Status Section */}
      {showVerificationStatus && (
        <div className="bg-green-50 px-5 py-4">
          <div className="flex items-center gap-2 text-green-600">
            <Check className="h-4 w-4" />
            <h2 className="font-medium">This App Has Been Verified</h2>
          </div>
          <p className="mt-2 text-muted-foreground text-xs">
            We display the complete chain of trust, including server hardware,
            operating system, application code, network infrastructure, and
            trust authority. Each component provides verifiable attestation
            reports, along with all the information and tools you need for
            independent verification.
          </p>
        </div>
      )}
    </div>
  )
}

// Section Header Component
const SectionHeader: React.FC<{
  section: TrustSection
}> = ({section}) => (
  <div>
    <div className="flex items-center gap-2 px-1">
      <div className="flex-shrink-0 rounded-full bg-green-100 p-1">
        <Check className="h-4 w-4 text-green-600" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-gray-700">{section.title}</h3>
      </div>
    </div>
  </div>
)

// Section Component
const TrustSection: React.FC<{
  section: TrustSection
}> = ({section}) => {
  const {attestationData} = useAttestationData()

  const filteredItems = section.items.filter((item) => {
    return attestationData.some((obj) => obj.id === item.id)
  })

  if (filteredItems.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <SectionHeader section={section} />

      <div className="space-y-3">
        {filteredItems.map((item) => (
          <ReportItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}

// Main Report Widget Component with configuration support
const ReportWidget: React.FC<{
  config?: ReportWidgetConfig
}> = ({config = {}}) => {
  const {setSelectedObjectId} = useAttestationData()

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
    // biome-ignore lint/a11y/noStaticElementInteractions: de-select all objects when clicking on the report view
    // biome-ignore lint/a11y/useKeyWithClickEvents: de-select all objects when clicking on the report view
    <div
      className="space-y-4 pb-3"
      onClick={() => {
        setSelectedObjectId(null)
      }}
    >
      {finalConfig.showHeader && (
        <ReportHeader
          showAttributes={finalConfig.showAttributes}
          showVerificationStatus={finalConfig.showVerificationStatus}
        />
      )}

      <div className="space-y-4 px-3">
        {visibleSections.map((section) => (
          <TrustSection key={section.id} section={section} />
        ))}
      </div>
    </div>
  )
}

export default ReportWidget
