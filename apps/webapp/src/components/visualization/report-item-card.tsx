import {Lock} from 'lucide-react'
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

// Shared content component
export const ReportItemContent: React.FC<{item: ReportItem}> = ({item}) => {
  const {attestationData} = useAttestationData()

  return (
    <div className="flex h-full flex-col justify-start space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-medium text-gray-900 text-sm">{item.title}</h4>
        {item.vendorIcon && (
          // biome-ignore lint/performance/noImgElement: size is not fixed
          <img
            src={item.vendorIcon}
            alt="Vendor"
            className="block h-4 w-auto"
          />
        )}
      </div>

      <p className="text-gray-600 text-xs">{item.intro}</p>

      {/* Dynamic field rendering */}
      {item.fields && item.fields.length > 0 && (
        <div className="space-y-2">
          {item.fields.map((f) => {
            const obj = attestationData.find((o) => o.id === f.objectId)
            const value = obj?.fields?.[f.field]
            const isPlaceholder = obj?.isPlaceholder

            if (value == null || value === 'N/A') return null
            const valueString = String(value)
            return (
              <div key={`${f.objectId}-${f.field}`} className="relative">
                <p className="block font-medium text-xs text-muted-foreground">
                  {f.label ?? f.field}
                </p>
                {isPlaceholder ? (
                  <p className="line-clamp-3 break-all text-xs text-muted-foreground">
                    -
                  </p>
                ) : valueString.startsWith('https://') ? (
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
              className="text-blue-500 text-xs underline hover:text-blue-600 hover:underline"
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
  const {selectedObjectId, setSelectedObjectId, attestationData} =
    useAttestationData()
  const isSelected = selectedObjectId === item.id

  // Check if this item corresponds to a placeholder data object
  const correspondingDataObject = attestationData.find(
    (obj) => obj.id === item.id,
  )
  const isPlaceholder = correspondingDataObject?.isPlaceholder

  const handleSelect = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()

    // Don't allow selection of placeholder items
    if (isPlaceholder) {
      return
    }

    if (isSelected) {
      setSelectedObjectId(null)
    } else {
      setSelectedObjectId(item.id)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className={cn(
          'w-full rounded-lg border bg-white p-3 text-left transition-all duration-200',
          isPlaceholder
            ? 'cursor-not-allowed opacity-60 border-muted'
            : 'cursor-pointer',
          isSelected
            ? 'border-yellow-300 ring-2 ring-yellow-300'
            : 'border-muted',
          !isPlaceholder && 'hover:border-muted-foreground',
        )}
        onClick={handleSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleSelect(e)
          }
        }}
        disabled={isPlaceholder}
      >
        <ReportItemContent item={item} />
      </button>
      {isPlaceholder && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
          <Lock className="h-8 w-8 text-muted-foreground/60" />
        </div>
      )}
    </div>
  )
}
