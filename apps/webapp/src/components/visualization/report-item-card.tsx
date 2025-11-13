import type React from 'react'

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

// Shared content component
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
                    className="block break-all text-xs/snug underline hover:underline"
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
              className="text-green-600 text-xs underline hover:text-green-700"
              onClick={(e) => {
                e.stopPropagation()
              }}
            >
              {link.text}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

export const ReportItemCard: React.FC<{item: ReportItem}> = ({item}) => {
  const {selectedObjectId, setSelectedObjectId} = useAttestationData()
  const isSelected = selectedObjectId === item.id

  const handleSelect = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()

    if (isSelected) {
      setSelectedObjectId(null)
    } else {
      setSelectedObjectId(item.id)
    }
  }

  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-lg border bg-card p-3 text-left transition-all duration-200 cursor-pointer',
        isSelected
          ? 'border-yellow-500 ring-2 ring-yellow-500/50'
          : 'border-border',
        'hover:border-muted-foreground',
      )}
      onClick={handleSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleSelect(e)
        }
      }}
    >
      <ReportItemContent item={item} />
    </button>
  )
}
