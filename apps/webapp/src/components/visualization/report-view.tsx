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

  // Check if Vijil integration is enabled for this app
  const vijilEnabled = app?.app?.id ? isVijilEnabled(app.app.id) : false

  console.log('[VijilCard] Initial state:', {
    appId: app?.app?.id,
    vijilEnabled,
    attestationDataLength: attestationData?.length,
    taskExists: !!app?.task,
  })

  // Fetch Vijil evaluation if enabled
  useEffect(() => {
    console.log('[VijilCard] useEffect triggered:', {
      vijilEnabled,
      attestationDataLength: attestationData?.length,
      appId: app?.app?.id,
      taskId: app?.task?.id,
    })

    if (!vijilEnabled) {
      console.log('[VijilCard] Vijil not enabled for this app')
      return
    }

    if (!attestationData || attestationData.length === 0) {
      console.log('[VijilCard] No attestation data available')
      return
    }

    if (!app?.task) {
      console.log('[VijilCard] No task available')
      return
    }

    const fetchVijilEvaluation = async () => {
      try {
        // Build endpoint from app-id and domain
        // Format: https://{app-id}-8000.{domain}/v1
        const appId = app.app?.id
        if (!appId) {
          console.log('[VijilCard] No appId available')
          return
        }

        // Extract domain from attestationData or task metadata
        const appMainObj = attestationData.find((obj) => obj.id === 'app-main')
        console.log('[VijilCard] Found app-main object:', {
          found: !!appMainObj,
          endpoint: appMainObj?.fields?.endpoint,
        })

        let domain: string | undefined

        // Try to get domain from app-main endpoint
        const rawEndpoint = appMainObj?.fields?.endpoint as string | undefined
        if (rawEndpoint) {
          console.log('[VijilCard] Trying to extract domain from endpoint:', rawEndpoint)
          // Extract domain from URL like https://something-8090.dstack-pha-prod7.phala.network
          // Match any port number, not just 8000
          const match = rawEndpoint.match(/https:\/\/[^-]+-\d+\.(.+?)(?:\/|$)/)
          if (match) {
            domain = match[1]
            console.log('[VijilCard] Extracted domain from endpoint:', domain)
          } else {
            console.log('[VijilCard] Failed to match domain pattern in endpoint')
          }
        }

        // Try extracting from all attestationData objects with endpoint field
        if (!domain) {
          console.log('[VijilCard] Trying to find endpoint in all attestationData objects')
          for (const obj of attestationData) {
            const endpoint = obj?.fields?.endpoint as string | undefined
            if (endpoint) {
              console.log(`[VijilCard] Found endpoint in ${obj.id}:`, endpoint)
              const match = endpoint.match(/https:\/\/[^-]+-\d+\.(.+?)(?:\/|$)/)
              if (match) {
                domain = match[1]
                console.log('[VijilCard] Successfully extracted domain:', domain)
                break
              }
            }
          }
          if (!domain) {
            console.log('[VijilCard] No valid endpoint found in any attestationData object')
          }
        }

        if (!domain) {
          console.log('[VijilCard] Could not determine domain')
          return
        }

        // Construct Vijil endpoint: https://{app-id}-8000.{domain}/v1
        const vijilEndpoint = `https://${appId}-8000.${domain}/v1`
        console.log('[VijilCard] Fetching Vijil evaluation from:', vijilEndpoint)

        const evaluation = await getLatestVijilEvaluation(vijilEndpoint)
        console.log('[VijilCard] Received evaluation:', {
          id: evaluation?.id,
          score: evaluation?.score,
          hasEvaluation: !!evaluation,
        })
        setVijilEvaluation(evaluation)
      } catch (error) {
        console.error('[VijilCard] Error fetching Vijil evaluation:', error)
      }
    }

    fetchVijilEvaluation()
  }, [vijilEnabled, attestationData, app])

  if (!app) {
    console.log('[VijilCard] No app available, returning null')
    return null
  }

  console.log('[VijilCard] Rendering ReportView:', {
    vijilEnabled,
    hasEvaluation: !!vijilEvaluation,
    evaluationId: vijilEvaluation?.id,
    willRenderVijilCard: vijilEnabled && !!vijilEvaluation,
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
