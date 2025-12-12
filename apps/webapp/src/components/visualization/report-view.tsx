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
import {appWithTaskAtom} from '@/stores/app'

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
    items: [REPORT_ITEMS['app-gpu'], REPORT_ITEMS['app-cpu']],
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
    <div className="mb-6">
      <SectionHeader title={section.title} />

      <div className="space-y-3 mt-3">
        {filteredItems.map((item) => (
          <ReportItemCard key={item.id} item={item} selectable={true} />
        ))}
      </div>
    </div>
  )
}

// Main Report View Component
const ReportView: React.FC = () => {
  const {setSelectedObjectId} = useAttestationData()
  const [app] = useAtom(appWithTaskAtom)

  if (!app) {
    return null
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: de-select all objects when clicking on the report view
    // biome-ignore lint/a11y/useKeyWithClickEvents: de-select all objects when clicking on the report view
    <div
      className="pt-4 pb-6"
      onClick={() => {
        setSelectedObjectId(null)
      }}
    >
      <ReportHeader app={app} />

      <div className="px-3">
        {TRUST_SECTIONS.map((section) => (
          <TrustSection key={section.id} section={section} />
        ))}
      </div>
    </div>
  )
}

export default ReportView
