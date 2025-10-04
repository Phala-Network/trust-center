import {useAtom} from 'jotai'
import {Check} from 'lucide-react'
import type React from 'react'

import {AppLogo} from '@/components/app-logo'
import {useAttestationData} from '@/components/attestation-data-context'
import {
  type ReportItem,
  ReportItemCard,
} from '@/components/visualization/report-item-card'
import {REPORT_ITEMS} from '@/data/report-items'
import {appInfoAtom} from '@/stores/app'

interface TrustSection {
  id: string
  title: string
  items: ReportItem[]
}

// Trust verification sections configuration - now using shared data
const TRUST_SECTIONS: TrustSection[] = [
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

// Report Header Component
const ReportHeader: React.FC = () => {
  const [appInfo] = useAtom(appInfoAtom)

  return (
    <div className="space-y-2">
      <div className="p-3">
        <div className="flex items-center gap-4 mb-2">
          {/* App Logo */}
          <AppLogo appName={appInfo?.name} size="md" />

          {/* App Info */}
          <div className="flex-1 min-w-0">
            <h1 className="truncate font-semibold text-2xl">
              {appInfo?.name || 'Unknown Application'}
            </h1>
            {appInfo?.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {appInfo.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-green-50 px-3 py-4">
        <div className="flex items-center gap-2 text-green-600">
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
    // Only show items that have corresponding data in attestationData
    return attestationData.some((obj) => obj.id === item.id)
  })

  // Don't render the section if no items have data
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

// Main Report View Component
const ReportView: React.FC = () => {
  const {setSelectedObjectId} = useAttestationData()

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: de-select all objects when clicking on the report view
    // biome-ignore lint/a11y/useKeyWithClickEvents: de-select all objects when clicking on the report view
    <div
      className="space-y-4 pb-3"
      onClick={() => {
        setSelectedObjectId(null)
      }}
    >
      <ReportHeader />

      <div className="space-y-4 px-3">
        {TRUST_SECTIONS.map((section) => (
          <TrustSection key={section.id} section={section} />
        ))}
      </div>
    </div>
  )
}

export default ReportView
