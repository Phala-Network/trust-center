import { useAtom } from 'jotai'
import type React from 'react'
import { useEffect, useState } from 'react'

import type { VijilEvaluation } from '@/app/actions/vijil'
import { getLatestVijilEvaluation } from '@/app/actions/vijil'
import { useAttestationData } from '@/components/attestation-data-context'
import {
  type ReportItem,
  ReportItemCard,
} from '@/components/visualization/collapsible-report-item-card'
import {
  ReportHeader,
  SectionHeader,
} from '@/components/visualization/report-components'
import { VijilCard } from '@/components/visualization/vijil-card'
import {REPORT_ITEMS} from '@/data/report-items'
import {appWithTaskAtom} from '@/stores/app'

// Vijil whitelist check (client-side)
const VIJIL_WHITELIST = ['22b30e8e1b01d732e7dae67d7b0c2dfd67dfeb53']
const isVijilEnabled = (appId: string) => VIJIL_WHITELIST.includes(appId)

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

// Section Component
const TrustSection: React.FC<{
  section: TrustSection
}> = ({ section }) => {
  const { attestationData } = useAttestationData()

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
      <SectionHeader title={section.title} />

      <div className="space-y-3">
        {filteredItems.map((item) => (
          <ReportItemCard key={item.id} item={item} selectable={true} />
        ))}
      </div>
    </div>
  )
}

// Main Report View Component
const ReportView: React.FC = () => {
  const { setSelectedObjectId, attestationData } = useAttestationData()
  const [app] = useAtom(appWithTaskAtom)
  const [vijilEvaluation, setVijilEvaluation] =
    useState<VijilEvaluation | null>(null)
  const [vijilLoading, setVijilLoading] = useState(false)

  // Check if Vijil integration is enabled for this app
  const vijilEnabled = app?.app?.id ? isVijilEnabled(app.app.id) : false

  // Fetch Vijil evaluation if enabled
  useEffect(() => {
    if (!vijilEnabled || !attestationData || attestationData.length === 0 || !app?.task) {
      return
    }

    const fetchVijilEvaluation = async () => {
      setVijilLoading(true)
      try {
        // Find app-main object to get endpoint
        const appMainObj = attestationData.find((obj) => obj.id === 'app-main')
        let endpoint = appMainObj?.fields?.endpoint as string | undefined

        // Fallback: try to get endpoint from task metadata
        if (!endpoint && app.task.appMetadata) {
          const metadata = app.task.appMetadata as any
          endpoint = metadata?.endpoint
        }

        if (endpoint) {
          const evaluation = await getLatestVijilEvaluation(endpoint)
          setVijilEvaluation(evaluation)
        }
      } catch (error) {
        console.error('Error fetching Vijil evaluation:', error)
      } finally {
        setVijilLoading(false)
      }
    }

    fetchVijilEvaluation()
  }, [vijilEnabled, attestationData, app])

  if (!app) {
    return null
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: de-select all objects when clicking on the report view
    // biome-ignore lint/a11y/useKeyWithClickEvents: de-select all objects when clicking on the report view
    <div
      className="space-y-4 pb-3"
      onClick={() => {
        setSelectedObjectId(null)
      }}
    >
      <ReportHeader app={app} />

      <div className="space-y-4 px-3">
        {/* Vijil AI Agent Verification Section */}
        {vijilEnabled && vijilEvaluation && (
          <div className="space-y-4">
            <SectionHeader title="AI Agent Verified" />
            <VijilCard evaluation={vijilEvaluation} />
          </div>
        )}

        {TRUST_SECTIONS.map((section) => (
          <TrustSection key={section.id} section={section} />
        ))}
      </div>
    </div>
  )
}

export default ReportView
