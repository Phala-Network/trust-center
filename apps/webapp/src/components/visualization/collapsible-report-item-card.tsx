'use client'

import {ChevronDown, Copy} from 'lucide-react'
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

export interface ReportItemField {
  objectId: DataObjectId
  field: string
  label?: string
  copyable?: boolean
  isJson?: boolean
  isCode?: boolean
  truncate?: boolean
}

export interface ReportItemLink {
  text: string
  url: string
  isAction?: boolean
  urlWithQuote?: boolean
}

export interface CurlRequest {
  method: string
  url: string
  headers: Record<string, string>
  bodyFields: string[]
}

export interface ReportItem {
  id: string
  title: string
  vendorTitle?: string
  intro: string
  links?: ReportItemLink[]
  vendorIcon?: string
  fields?: ReportItemField[]
  curlRequest?: CurlRequest
}

// Copy button component
const CopyButton: React.FC<{
  value: string
  className?: string
}> = ({value, className}) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      console.error('Failed to copy')
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-border bg-muted/50 hover:bg-muted transition-colors',
        className,
      )}
    >
      <Copy className="h-3 w-3" />
      <span>{copied ? 'Copied!' : 'Copy'}</span>
    </button>
  )
}

// Helper to format JSON value for display
const formatJsonValue = (value: string): string => {
  try {
    // Try to parse and re-stringify with formatting
    const parsed = JSON.parse(value)
    return JSON.stringify(parsed, null, 2)
  } catch {
    // If it's not valid JSON, return as-is
    return value
  }
}

// Copyable field component with copy button inside value area (bottom-right)
const CopyableField: React.FC<{
  label: string
  value: string
  isJson?: boolean
  isCode?: boolean
  truncate?: boolean
}> = ({label, value, isJson, isCode, truncate}) => {
  // Format JSON values with proper indentation
  // For isCode, also try to format if it looks like JSON
  const displayValue = isJson || isCode ? formatJsonValue(value) : value

  const truncatedValue =
    truncate && displayValue.length > 100
      ? `${displayValue.slice(0, 100)}...`
      : displayValue

  // For code blocks or JSON, show formatted with scroll and max 4 lines visible
  if (isCode || isJson) {
    return (
      <div className="space-y-1">
        <p className="block font-medium text-xs text-muted-foreground">
          {label}
        </p>
        <div className="relative rounded bg-muted/50 border border-border">
          <div className="max-h-24 overflow-auto px-2 py-1.5 pb-7">
            <pre className="text-xs font-mono whitespace-pre">
              {displayValue}
            </pre>
          </div>
          <div className="absolute bottom-1.5 right-1.5">
            <CopyButton value={displayValue} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <p className="block font-medium text-xs text-muted-foreground">{label}</p>
      <div className="relative rounded bg-muted/50 px-2 py-1.5 pb-7 border border-border">
        <p
          className={cn(
            'text-xs font-mono break-all',
            truncate && 'line-clamp-4',
          )}
        >
          {truncatedValue}
        </p>
        <div className="absolute bottom-1.5 right-1.5">
          <CopyButton value={displayValue} />
        </div>
      </div>
    </div>
  )
}

// CURL request display component with copy button inside (bottom-right)
const CurlRequestDisplay: React.FC<{
  curlRequest: CurlRequest
  fieldValues: Record<string, unknown>
}> = ({curlRequest, fieldValues}) => {
  const buildCurlCommand = () => {
    const headerLines = Object.entries(curlRequest.headers)
      .map(([key, value]) => `     --header '${key}: ${value}'`)
      .join(' \\\n')

    const bodyObject: Record<string, unknown> = {}
    for (const fieldName of curlRequest.bodyFields) {
      if (fieldValues[fieldName] !== undefined) {
        bodyObject[fieldName] = fieldValues[fieldName]
      }
    }

    const bodyJson = JSON.stringify(bodyObject)

    return `curl --request ${curlRequest.method} \\
     --url ${curlRequest.url} \\
${headerLines} \\
     --data '${bodyJson}'`
  }

  const curlCommand = buildCurlCommand()

  return (
    <div className="space-y-1">
      <p className="block font-medium text-xs text-muted-foreground">
        CURL Request
      </p>
      <div className="relative rounded bg-muted/50 px-2 py-1.5 pb-7 border border-border overflow-x-auto">
        <pre className="text-xs font-mono whitespace-pre-wrap break-all">
          {curlCommand}
        </pre>
        <div className="absolute bottom-1.5 right-1.5">
          <CopyButton value={curlCommand} />
        </div>
      </div>
    </div>
  )
}

// Link component with unified styling (no icon)
const ReportLink: React.FC<{
  link: ReportItemLink
  quoteValue?: string
}> = ({link, quoteValue}) => {
  let finalUrl = link.url
  if (link.urlWithQuote && quoteValue) {
    finalUrl = `${link.url}?quote=${encodeURIComponent(quoteValue)}`
  }

  return (
    <a
      href={finalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
      onClick={(e) => e.stopPropagation()}
    >
      {link.text}
    </a>
  )
}

// Card header with vendor icon and title
const CardHeader: React.FC<{
  item: ReportItem
  showChevron?: boolean
  isExpanded?: boolean
}> = ({item, showChevron, isExpanded}) => {
  const icons = item.vendorIcon ? getVendorIconSrc(item.vendorIcon) : null

  return (
    <div className="flex items-center justify-between gap-2">
      <h4 className="font-medium text-sm truncate text-foreground flex-1 min-w-0">
        {item.title}
      </h4>
      <div className="flex items-center gap-2 shrink-0 h-4">
        {icons && (
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
        )}
        {showChevron && (
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              isExpanded && 'rotate-180',
            )}
          />
        )}
      </div>
    </div>
  )
}

// Card content with vendor title, intro, fields, links, and curl request
const CardContent: React.FC<{
  item: ReportItem
}> = ({item}) => {
  const {attestationData} = useAttestationData()

  // Collect all field values for curl request
  const fieldValues: Record<string, unknown> = {}
  let quoteValue: string | undefined

  if (item.fields) {
    for (const f of item.fields) {
      const obj = attestationData.find((o) => o.id === f.objectId)
      const value = obj?.fields?.[f.field]
      if (value !== undefined && value !== null) {
        fieldValues[f.field] = value
        // Track quote value for URL building
        if (f.field === 'intel_attestation_report') {
          quoteValue = String(value)
        }
      }
    }
  }

  return (
    <div className="pt-2 border-t space-y-3">
      {/* Intro text */}
      <p className="text-muted-foreground text-xs">{item.intro}</p>

      {/* Links section */}
      {item.links && item.links.length > 0 && (
        <div className="flex flex-col items-start gap-1">
          {item.links.map((link, index) => (
            <ReportLink
              key={`${item.id}-link-${index}`}
              link={link}
              quoteValue={quoteValue}
            />
          ))}
        </div>
      )}

      {/* Divider before fields */}
      {item.fields && item.fields.length > 0 && (
        <div className="border-t border-border/50 pt-3 space-y-3">
          {item.fields.map((f) => {
            const value = fieldValues[f.field]
            if (value === undefined || value === null || value === 'N/A') {
              return null
            }

            const valueString =
              typeof value === 'object'
                ? JSON.stringify(value, null, 2)
                : String(value)

            if (f.copyable) {
              return (
                <CopyableField
                  key={`${f.objectId}-${f.field}`}
                  label={f.label ?? f.field}
                  value={valueString}
                  isJson={f.isJson}
                  isCode={f.isCode}
                  truncate={f.truncate}
                />
              )
            }

            return (
              <div key={`${f.objectId}-${f.field}`} className="space-y-1">
                <p className="block font-medium text-xs text-muted-foreground">
                  {f.label ?? f.field}
                </p>
                <div className="rounded bg-muted/50 px-2 py-1.5 border border-border">
                  {valueString.startsWith('https://') ? (
                    <a
                      href={valueString}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block break-all text-xs text-muted-foreground underline hover:text-foreground transition-colors"
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
              </div>
            )
          })}
        </div>
      )}

      {/* CURL request section */}
      {item.curlRequest && (
        <CurlRequestDisplay
          curlRequest={item.curlRequest}
          fieldValues={fieldValues}
        />
      )}
    </div>
  )
}

// Shared card content component - using report view's original style
export const ReportItemContent: React.FC<{item: ReportItem}> = ({item}) => {
  const {attestationData} = useAttestationData()

  // Collect field values and quote value
  const fieldValues: Record<string, unknown> = {}
  let quoteValue: string | undefined

  if (item.fields) {
    for (const f of item.fields) {
      const obj = attestationData.find((o) => o.id === f.objectId)
      const value = obj?.fields?.[f.field]
      if (value !== undefined && value !== null) {
        fieldValues[f.field] = value
        if (f.field === 'intel_attestation_report') {
          quoteValue = String(value)
        }
      }
    }
  }

  const icons = item.vendorIcon ? getVendorIconSrc(item.vendorIcon) : null

  return (
    <div className="flex h-full flex-col justify-start space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-medium text-foreground text-sm">{item.title}</h4>
        {icons && (
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
        )}
      </div>

      <p className="text-muted-foreground text-xs">{item.intro}</p>

      {/* Links */}
      {item.links && item.links.length > 0 && (
        <div className="flex flex-col items-start gap-1">
          {item.links.map((link, index) => (
            <ReportLink
              key={`${item.id}-link-${index}`}
              link={link}
              quoteValue={quoteValue}
            />
          ))}
        </div>
      )}

      {/* Dynamic field rendering */}
      {item.fields && item.fields.length > 0 && (
        <div className="space-y-2">
          {item.fields.map((f) => {
            const value = fieldValues[f.field]
            if (value === undefined || value === null || value === 'N/A') {
              return null
            }

            const valueString =
              typeof value === 'object'
                ? JSON.stringify(value, null, 2)
                : String(value)

            if (f.copyable) {
              return (
                <CopyableField
                  key={`${f.objectId}-${f.field}`}
                  label={f.label ?? f.field}
                  value={valueString}
                  isJson={f.isJson}
                  isCode={f.isCode}
                  truncate={f.truncate}
                />
              )
            }

            return (
              <div key={`${f.objectId}-${f.field}`} className="space-y-1">
                <p className="block font-medium text-xs text-muted-foreground">
                  {f.label ?? f.field}
                </p>
                <div className="rounded bg-muted/50 px-2 py-1.5 border border-border">
                  {valueString.startsWith('https://') ? (
                    <a
                      href={valueString}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block break-all text-xs text-muted-foreground underline hover:text-foreground transition-colors"
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
              </div>
            )
          })}
        </div>
      )}

      {/* CURL request */}
      {item.curlRequest && (
        <CurlRequestDisplay
          curlRequest={item.curlRequest}
          fieldValues={fieldValues}
        />
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
      <div
        className={cn(
          'w-full rounded-lg border bg-card text-left transition-all duration-200',
          !defaultExpanded && 'hover:border-primary/20 cursor-pointer',
        )}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick(e)
          }
        }}
        role="button"
        tabIndex={defaultExpanded ? -1 : 0}
      >
        <div className="p-3">
          <CardHeader
            item={item}
            showChevron={!defaultExpanded && showContent}
            isExpanded={isExpanded}
          />
          {shouldShowContent && (
            <div className="mt-2">
              <CardContent item={item} />
            </div>
          )}
        </div>
      </div>
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
