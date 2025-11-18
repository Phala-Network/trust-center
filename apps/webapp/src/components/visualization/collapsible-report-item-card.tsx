'use client'

import {ChevronDown} from 'lucide-react'
import type React from 'react'
import {useState} from 'react'

import {useAttestationData} from '@/components/attestation-data-context'
import type {DataObjectId} from '@/data/schema'
import {cn} from '@/lib/utils'

// Helper to get dark mode version of vendor icon
const getVendorIconSrc = (icon: string) => {
  const darkIcons: Record<string, string> = {
    '/nvidia.svg': '/nvidia_dark.svg',
    '/dstack.svg': '/dstack_dark.svg',
    '/logo.svg': '/logo_dark.svg',
  }
  return {
    light: icon,
    dark: darkIcons[icon] || icon,
  }
}

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

// Shared card content component - using report view's original style
export const ReportItemContent: React.FC<{item: ReportItem}> = ({item}) => {
  const {attestationData} = useAttestationData()

  return (
    <div className="flex h-full flex-col justify-start space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-medium text-foreground text-sm">{item.title}</h4>
        {item.vendorIcon &&
          (() => {
            const icons = getVendorIconSrc(item.vendorIcon)
            return (
              <>
                <img
                  src={icons.light}
                  alt="Vendor"
                  className="block h-4 w-auto dark:hidden"
                />
                <img
                  src={icons.dark}
                  alt="Vendor"
                  className="hidden dark:block h-4 w-auto"
                />
              </>
            )
          })()}
      </div>

      <p className="text-muted-foreground text-xs">{item.intro}</p>

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
                    className="block break-all text-xs/snug text-muted-foreground underline hover:underline"
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
              className="text-muted-foreground text-xs underline hover:opacity-80"
              onClick={(e) => e.stopPropagation()}
            >
              {link.text}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

// Unified Report Item Card - supports both collapsible and expanded modes
export const ReportItemCard: React.FC<{
  item: ReportItem
  collapsible?: boolean
  defaultExpanded?: boolean
  showContent?: boolean
  selectable?: boolean
}> = ({
  item,
  collapsible = false,
  defaultExpanded = false,
  showContent = true,
  selectable = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const {selectedObjectId, setSelectedObjectId} = useAttestationData()
  const isSelected = selectable && selectedObjectId === item.id

  const handleClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (selectable) {
      e.stopPropagation()
      setSelectedObjectId(isSelected ? null : item.id)
    } else if (collapsible && !defaultExpanded && showContent) {
      setIsExpanded(!isExpanded)
    }
  }

  const shouldShowContent =
    showContent && (defaultExpanded || isExpanded || !collapsible)

  // For collapsible mode - always show title row with chevron, content conditionally
  if (collapsible) {
    return (
      <button
        type="button"
        className={cn(
          'w-full rounded-lg border bg-card text-left transition-all duration-200',
          !defaultExpanded && 'hover:border-primary/20 cursor-pointer',
        )}
        onClick={handleClick}
        disabled={defaultExpanded}
      >
        <div className="p-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-medium text-sm truncate text-foreground flex-1 min-w-0">
              {item.title}
            </h4>
            <div className="flex items-center gap-2 flex-shrink-0 h-4">
              {item.vendorIcon &&
                (() => {
                  const icons = getVendorIconSrc(item.vendorIcon)
                  return (
                    <>
                      <img
                        src={icons.light}
                        alt="Vendor"
                        className="block h-4 w-auto dark:hidden"
                      />
                      <img
                        src={icons.dark}
                        alt="Vendor"
                        className="hidden dark:block h-4 w-auto"
                      />
                    </>
                  )
                })()}
              {!defaultExpanded && showContent && (
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform duration-200',
                    isExpanded && 'rotate-180',
                  )}
                />
              )}
            </div>
          </div>
          {shouldShowContent && (
            <div className="mt-2">
              <div className="pt-2 border-t space-y-2">
                <p className="text-muted-foreground text-xs">{item.intro}</p>

                {item.fields &&
                  item.fields.length > 0 &&
                  (() => {
                    const {attestationData} = useAttestationData()
                    return (
                      <div className="space-y-2">
                        {item.fields.map((f) => {
                          const obj = attestationData.find(
                            (o) => o.id === f.objectId,
                          )
                          const value = obj?.fields?.[f.field]

                          if (value == null || value === 'N/A') return null
                          const valueString = String(value)
                          return (
                            <div
                              key={`${f.objectId}-${f.field}`}
                              className="relative"
                            >
                              <p className="block font-medium text-xs text-muted-foreground">
                                {f.label ?? f.field}
                              </p>
                              {valueString.startsWith('https://') ? (
                                <a
                                  href={valueString}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block break-all text-xs/snug text-muted-foreground underline hover:underline"
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
                    )
                  })()}

                {item.links && item.links.length > 0 && (
                  <div className="flex flex-col items-start gap-1">
                    {item.links.map((link, index) => (
                      <a
                        key={`${item.id}-link-${index}`}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground text-xs underline hover:opacity-80"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {link.text}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </button>
    )
  }

  // For non-collapsible mode (report view style)
  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-lg border bg-card text-left transition-all duration-200',
        selectable &&
          isSelected &&
          'border-yellow-500 ring-2 ring-yellow-500/50',
        selectable &&
          !isSelected &&
          'border-border hover:border-muted-foreground cursor-pointer',
        !selectable && 'border-border',
      )}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (selectable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          handleClick(e)
        }
      }}
      disabled={!selectable}
    >
      <div className="p-3">
        <ReportItemContent item={item} />
      </div>
    </button>
  )
}

// Legacy alias for backward compatibility
export const CollapsibleReportItemCard = ReportItemCard
