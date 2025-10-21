'use client'

import {ChevronDown} from 'lucide-react'
import {useState} from 'react'
import type React from 'react'

import {useAttestationData} from '@/components/attestation-data-context'
import type {DataObjectId} from '@/data/schema'
import {cn} from '@/lib/utils'

export interface ReportItem {
  id: string
  title: string
  intro: string
  links?: Array<{
    text: string
    url: string
  }>
  vendorIcon?: string
  fields?: Array<{
    objectId: DataObjectId
    field: string
    label?: string
  }>
}

// Collapsible card content
const CollapsibleContent: React.FC<{
  item: ReportItem
  isExpanded: boolean
}> = ({item, isExpanded}) => {
  const {attestationData} = useAttestationData()

  return (
    <div
      className={cn(
        'overflow-hidden transition-all duration-200',
        isExpanded ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0',
      )}
    >
      <div className="space-y-2 pt-2 border-t">
        <p className="text-muted-foreground text-xs leading-relaxed">{item.intro}</p>

        {/* Dynamic field rendering */}
        {item.fields && item.fields.length > 0 && (
          <div className="space-y-2">
            {item.fields.map((f) => {
              const obj = attestationData.find((o) => o.id === f.objectId)
              const value = obj?.fields?.[f.field]

              if (value == null || value === 'N/A') return null
              const valueString = String(value)
              return (
                <div key={`${f.objectId}-${f.field}`} className="relative">
                  <p className="block font-medium text-xs text-muted-foreground">
                    {f.label ?? f.field}
                  </p>
                  {valueString.startsWith('https://') ? (
                    <a
                      href={valueString}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block break-all text-xs/snug underline hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {valueString}
                    </a>
                  ) : (
                    <p className="line-clamp-3 break-all text-xs">
                      {valueString}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {item.links && item.links.length > 0 && (
          <div className="flex flex-col items-start gap-1">
            {item.links.map((link, index) => (
              <a
                key={`${item.id}-link-${index}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary text-xs underline hover:opacity-80"
                onClick={(e) => e.stopPropagation()}
              >
                {link.text}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export const CollapsibleReportItemCard: React.FC<{
  item: ReportItem
  defaultExpanded?: boolean
}> = ({item, defaultExpanded = false}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div
      className={cn(
        'w-full rounded-md border bg-card transition-all duration-200',
        !defaultExpanded && 'hover:border-primary/20',
      )}
    >
      <button
        type="button"
        className="w-full px-3 py-2 text-left flex items-center justify-between gap-2"
        onClick={() => !defaultExpanded && setIsExpanded(!isExpanded)}
        disabled={defaultExpanded}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">
            {item.title}
          </h4>
          {item.vendorIcon && (
            // biome-ignore lint/performance/noImgElement: size is not fixed
            <img
              src={item.vendorIcon}
              alt="Vendor"
              className="block h-3.5 w-auto flex-shrink-0"
            />
          )}
        </div>
        {!defaultExpanded && (
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200 flex-shrink-0',
              isExpanded && 'rotate-180',
            )}
          />
        )}
      </button>

      <div className="px-3 pb-2">
        <CollapsibleContent item={item} isExpanded={defaultExpanded || isExpanded} />
      </div>
    </div>
  )
}
