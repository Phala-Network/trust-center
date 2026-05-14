import {useAtom} from 'jotai'
import {Fragment, type FC} from 'react'

import {useAttestationData} from '@/components/attestation-data-context'
import {
  type ReportItem,
  ReportItemCard,
} from '@/components/visualization/collapsible-report-item-card'
import {ReportHeader} from '@/components/visualization/report-components'
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

// Vertical line that connects two consecutive cards in the trust chain.
// Sits in the gap between cards; the height controls the spacing.
const Connector: FC = () => (
  <div
    className="flex h-12 items-center justify-center"
    aria-hidden="true"
  >
    <div className="h-full w-px bg-border" />
  </div>
)

// Main Report View Component
const ReportView: FC = () => {
  const {setSelectedObjectId, attestationData} = useAttestationData()
  const [app] = useAtom(appWithTaskAtom)

  if (!app) {
    return null
  }

  // Flatten all sections into a single linear chain so connectors flow across
  // sections too. sectionTitle is set on the first card of each section so
  // the verification bookmark tab renders once per section.
  const cards: Array<{item: ReportItem; sectionTitle?: string}> = []
  for (const section of TRUST_SECTIONS) {
    const visible = section.items.filter((it) =>
      attestationData.some((obj) => obj.id === it.id),
    )
    visible.forEach((item, i) => {
      cards.push({item, sectionTitle: i === 0 ? section.title : undefined})
    })
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: de-select all objects when clicking on the report view
    // biome-ignore lint/a11y/useKeyWithClickEvents: de-select all objects when clicking on the report view
    <div
      className="min-h-full bg-muted/40 pt-4 pb-6"
      onClick={() => {
        setSelectedObjectId(null)
      }}
    >
      <div className="mx-auto max-w-[460px] px-3">
        <ReportHeader app={app} />

        {cards.map((c) => (
          <Fragment key={c.item.id}>
            <Connector />
            <ReportItemCard
              item={c.item}
              selectable={true}
              sectionTitle={c.sectionTitle}
            />
          </Fragment>
        ))}
      </div>
    </div>
  )
}

export default ReportView
