'use client'

import {useAtom} from 'jotai'
import type React from 'react'

import {useAttestationData} from '@/components/attestation-data-context'
import {
  type ReportItem,
  ReportItemCard,
} from '@/components/visualization/collapsible-report-item-card'
import {
  ReportHeader,
  SectionHeader,
} from '@/components/visualization/report-components'
import {REPORT_ITEMS} from '@/data/report-items'
import type {AppWithTask} from '@/lib/db'
import {appWithTaskAtom} from '@/stores/app'

interface TrustSection {
  id: string
  title: string
  items: ReportItem[]
}

// Configuration interface for widget customization
export interface CompactReportWidgetConfig {
  showAttributes?: boolean
  defaultExpanded?: boolean
  showSectionContent?: boolean
  darkMode?: boolean
  embedded?: boolean
  showTrustCenterButton?: boolean
  appId?: string
  taskId?: string
  sections?: {
    hardware?: boolean
    gpuAttestation?: boolean
    tdxAttestation?: boolean
    sourceCode?: boolean
    zeroTrust?: boolean
    os?: boolean
    authority?: boolean
  }
}

const DEFAULT_CONFIG: CompactReportWidgetConfig & {
  showAttributes: boolean
  defaultExpanded: boolean
  showSectionContent: boolean
  darkMode: boolean
  embedded: boolean
  showTrustCenterButton: boolean
  sections: Required<NonNullable<CompactReportWidgetConfig['sections']>>
} = {
  showAttributes: true,
  defaultExpanded: false,
  showSectionContent: true,
  darkMode: false,
  embedded: false,
  showTrustCenterButton: false,
  sections: {
    hardware: true,
    gpuAttestation: true,
    tdxAttestation: true,
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
    id: 'gpu_attestation',
    title: 'GPU Attestation',
    items: [REPORT_ITEMS['app-gpu-quote']],
  },
  {
    id: 'tdx_attestation',
    title: 'TDX Attestation',
    items: [REPORT_ITEMS['app-quote']],
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
  keyof NonNullable<CompactReportWidgetConfig['sections']>
> = {
  hardware: 'hardware',
  gpu_attestation: 'gpuAttestation',
  tdx_attestation: 'tdxAttestation',
  source_code: 'sourceCode',
  zero_trust: 'zeroTrust',
  os: 'os',
  authority: 'authority',
}

// Helper to check if an item has available data
const hasItemData = (
  item: ReportItem,
  attestationData: Array<{id: string; fields?: Record<string, unknown>}>,
): boolean => {
  // Check if the item's own ID exists in attestation data
  if (attestationData.some((obj) => obj.id === item.id)) {
    return true
  }

  // For items that reference fields from other objects, check if those fields exist
  if (item.fields && item.fields.length > 0) {
    return item.fields.some((f) => {
      const obj = attestationData.find((o) => o.id === f.objectId)
      const value = obj?.fields?.[f.field]
      return value !== undefined && value !== null && value !== 'N/A'
    })
  }

  return false
}

// Section Component - with widget-specific features
const TrustSection: React.FC<{
  section: TrustSection
  defaultExpanded: boolean
  showContent: boolean
}> = ({section, defaultExpanded, showContent}) => {
  const {attestationData} = useAttestationData()

  const filteredItems = section.items.filter((item) => {
    return hasItemData(item, attestationData)
  })

  if (filteredItems.length === 0) {
    return null
  }

  return (
    <div className="space-y-4 px-5 py-4">
      <SectionHeader title={section.title} />

      <div className="space-y-3">
        {filteredItems.map((item) => (
          <ReportItemCard
            key={item.id}
            item={item}
            collapsible={true}
            defaultExpanded={defaultExpanded}
            showContent={showContent}
          />
        ))}
      </div>
    </div>
  )
}

// Main Compact Report Widget Component
const CompactReportWidget: React.FC<{
  config?: CompactReportWidgetConfig
  app?: AppWithTask
}> = ({config = {}, app: appProp}) => {
  const [appFromAtom] = useAtom(appWithTaskAtom)
  const app = appProp || appFromAtom

  if (!app) {
    return null
  }

  // Merge with default config
  const finalConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    sections: {
      ...DEFAULT_CONFIG.sections,
      ...(config.sections || {}),
    },
  }

  // Filter sections based on config
  const visibleSections = ALL_TRUST_SECTIONS.filter((section) => {
    const configKey = SECTION_CONFIG_MAP[section.id]
    return configKey ? finalConfig.sections[configKey] : true
  })

  const cardClassName = finalConfig.embedded
    ? 'text-foreground max-w-sm relative overflow-hidden bg-card'
    : 'text-foreground max-w-sm relative mx-auto rounded-lg overflow-hidden bg-card border border-border shadow-sm'

  return (
    <div
      className={`${finalConfig.embedded ? 'relative' : 'relative p-4'} ${finalConfig.darkMode ? 'dark' : ''}`}
    >
      {/* Dotted background layer - only show when not embedded */}
      {!finalConfig.embedded && (
        <div
          className="absolute inset-0 pointer-events-none opacity-15"
          style={{
            backgroundImage:
              'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        />
      )}

      {/* Widget content - unified card */}
      <div className={cardClassName}>
        <ReportHeader
          app={app}
          showAttributes={finalConfig.showAttributes}
          showVerificationStatus={true}
          showBranding={true}
          showTrustCenterButton={finalConfig.showTrustCenterButton}
          appId={finalConfig.appId}
          taskId={finalConfig.taskId}
        />

        <div>
          {visibleSections.map((section) => (
            <TrustSection
              key={section.id}
              section={section}
              defaultExpanded={finalConfig.defaultExpanded}
              showContent={finalConfig.showSectionContent}
            />
          ))}
        </div>

        {/* Powered by Phala footer */}
        <div className="border-t border-border/50 px-5 py-3 bg-muted/20">
          <a
            href="https://phala.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Powered by</span>
            <span className="font-semibold">Phala</span>
          </a>
        </div>
      </div>
    </div>
  )
}

export default CompactReportWidget
