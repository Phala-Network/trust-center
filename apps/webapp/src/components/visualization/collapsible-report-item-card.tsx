'use client'

import {Check, ChevronDown, Copy, ShieldCheck} from 'lucide-react'
import type React from 'react'
import {useEffect, useState} from 'react'

import {useAttestationData} from '@/components/attestation-data-context'
import type {DataObjectId} from '@/data/schema'
import {cn} from '@/lib/utils'

// Helper to get dark mode version of vendor icon
const getVendorIconSrc = (icon: string) => {
  const darkIcons: Record<string, string> = {
    '/intel.svg': '/intel.svg',
    '/nvidia.svg': '/nvidia_dark.svg',
    '/dstack.svg': '/dstack_dark.svg',
    '/logo.svg': '/logo_dark.svg',
  }
  return {
    light: icon,
    dark: darkIcons[icon] || icon,
  }
}

const shouldShowItaCertifiedBadge = (
  itemId: string,
  attestationData: Array<{id: string; fields?: Record<string, unknown>}>,
): boolean => {
  const itaValue = attestationData.find((o) => o.id === itemId)?.fields
    ?.intel_trust_authority

  if (typeof itaValue === 'string') {
    return itaValue.trim() !== '' && itaValue !== 'N/A'
  }

  return itaValue !== undefined && itaValue !== null
}

// Categorical card theme — shared between report view (col 1) and nodes view
// (col 3) so cards of the same kind read as the SAME color across columns.
// Per-vendor themes take precedence over kind themes; the hardware section's
// Intel + NVIDIA cards get strong brand-color title strips with lighter card
// bodies in the same hue.
type CardKind = 'gateway' | 'kms' | 'app'

interface CardTheme {
  /** Title-strip className — bg + text color (strong for vendors, pastel for kinds). */
  title: string
  /** Card-body className — lighter tint of the same hue. */
  card: string
}

const getKindFromItemId = (id: string): CardKind => {
  if (id.startsWith('gateway')) return 'gateway'
  if (id.startsWith('kms')) return 'kms'
  return 'app'
}

// Exported so node graph can render kind-tinted title strips on fallback
// nodes (Event Logs, TEE Hardware, etc.) that don't have a REPORT_ITEMS entry.
export type {CardKind, CardTheme}
export {getKindFromItemId}

// Strong-title + very-light-body themes for branded hardware cards.
const VENDOR_THEMES: Record<string, CardTheme> = {
  intel: {
    title: 'bg-intel-blue-500 text-white',
    card: 'bg-intel-blue-50',
  },
  nvidia: {
    title: 'bg-nvidia-green-500 text-white',
    card: 'bg-nvidia-green-50',
  },
}

// Kind themes — same rhythm as vendor cards: strong title (white text) +
// very light body in the same hue.
const KIND_THEMES: Record<CardKind, CardTheme> = {
  gateway: {
    title: 'bg-phala-orange-500 text-white',
    card: 'bg-phala-orange-50',
  },
  kms: {title: 'bg-primary-700 text-white', card: 'bg-primary-50'},
  app: {title: 'bg-phala-blue-500 text-white', card: 'bg-phala-blue-50'},
}

const getVendorFromIcon = (vendorIcon?: string): string | null => {
  if (!vendorIcon) return null
  if (vendorIcon.includes('intel')) return 'intel'
  if (vendorIcon.includes('nvidia')) return 'nvidia'
  return null
}

const getCardTheme = (item: ReportItem): CardTheme => {
  const vendor = getVendorFromIcon(item.vendorIcon)
  if (vendor && VENDOR_THEMES[vendor]) return VENDOR_THEMES[vendor]
  return KIND_THEMES[getKindFromItemId(item.id)]
}

// Kind-only theme (used by node-graph fallback nodes).
export const getKindTheme = (kind: CardKind): CardTheme => KIND_THEMES[kind]

const ItaCertifiedBadge: React.FC = () => (
  <span className="inline-flex items-center gap-1 rounded-[4px] border border-primary/40 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[.14em] text-primary-700 dark:text-primary">
    <ShieldCheck className="h-3.5 w-3.5" />
    ITA Certified
  </span>
)

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

  // For code blocks or JSON, show formatted with scroll and max height limit
  if (isCode || isJson) {
    return (
      <div className="space-y-1">
        <p className="block font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">
          {label}
        </p>
        <div className="relative rounded-[4px] bg-[var(--surface-trust-path)] text-white/85 border border-white/10">
          <div className="max-h-16 overflow-auto px-2 py-1.5">
            <pre className="text-xs font-mono whitespace-pre-wrap break-all">
              {displayValue}
            </pre>
          </div>
          {/* Fade overlay at bottom of scroll container */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[var(--surface-trust-path)] to-transparent" />
          {/* Copy button positioned at bottom-right */}
          <div className="absolute bottom-1 right-1">
            <CopyButton
              value={displayValue}
              className="bg-white/10 border-white/15 text-white/70 hover:bg-white/15 hover:text-white"
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <p className="block font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">
        {label}
      </p>
      <div className="relative rounded-[4px] bg-[var(--surface-trust-path)] text-white/85 px-2 py-1.5 pb-4 border border-white/10">
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
      <p className="block font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">
        CURL Request
      </p>
      <div className="relative rounded-[4px] bg-[var(--surface-trust-path)] text-white/85 border border-white/10">
        <div className="max-h-16 overflow-auto px-2 py-1.5">
          <pre className="text-xs font-mono whitespace-pre-wrap break-all">
            {curlCommand}
          </pre>
        </div>
        {/* Fade overlay at bottom of scroll container */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[var(--surface-trust-path)] to-transparent" />
        {/* Copy button positioned at bottom-right */}
        <div className="absolute bottom-1 right-1">
          <CopyButton
            value={curlCommand}
            className="bg-white/10 border-white/15 text-white/70 hover:bg-white/15 hover:text-white"
          />
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
      className="text-xs text-phala-blue-300 hover:text-foreground hover:underline transition-colors"
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
  const {attestationData} = useAttestationData()
  const icons = item.vendorIcon ? getVendorIconSrc(item.vendorIcon) : null
  const showItaBadge = shouldShowItaCertifiedBadge(item.id, attestationData)

  return (
    <div className="flex min-w-0 items-center gap-2">
      <h4 className="min-w-0 flex-1 truncate font-medium text-sm">
        {item.title}
      </h4>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {icons && (
          <>
            <img
              src={icons.light}
              alt="Vendor"
              className="block h-5 max-w-[72px] object-contain dark:hidden"
            />
            <img
              src={icons.dark}
              alt="Vendor"
              className="hidden h-5 max-w-[72px] object-contain dark:block"
            />
          </>
        )}
        {showItaBadge && <ItaCertifiedBadge />}
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
    <div className="pt-2 space-y-3">
      {/* Intro text */}
      <p className="text-xs italic leading-relaxed text-foreground/60">
        {item.intro}
      </p>

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

      {/* Fields section */}
      {item.fields && item.fields.length > 0 && (
        <div className="pt-1 space-y-3">
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
                <p className="block font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">
                  {f.label ?? f.field}
                </p>
                <div className="rounded-[4px] bg-[var(--surface-trust-path)] text-white/85 px-2 py-1.5 border border-white/10">
                  {valueString.startsWith('https://') ? (
                    <a
                      href={valueString}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block break-all text-xs text-phala-blue-300 underline hover:text-white transition-colors"
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
  const showItaBadge = shouldShowItaCertifiedBadge(item.id, attestationData)
  const theme = getCardTheme(item)

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'dark flex min-w-0 items-center gap-2 border-b border-black/10 px-3 py-2',
          theme.title,
        )}
      >
        <h4 className="min-w-0 flex-1 truncate font-medium text-sm">
          {item.title}
        </h4>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {icons && (
            <>
              <img
                src={icons.light}
                alt="Vendor"
                className="block h-5 max-w-[72px] object-contain dark:hidden"
              />
              <img
                src={icons.dark}
                alt="Vendor"
                className="hidden h-5 max-w-[72px] object-contain dark:block"
              />
            </>
          )}
          {showItaBadge && <ItaCertifiedBadge />}
        </div>
      </div>

      <div className="space-y-2 px-3 py-2">
        <p className="text-xs italic leading-relaxed text-foreground/60">
          {item.intro}
        </p>

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
                  <p className="block font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">
                    {f.label ?? f.field}
                  </p>
                  <div className="rounded-[4px] bg-[var(--surface-trust-path)] text-white/85 px-2 py-1.5 border border-white/10">
                    {valueString.startsWith('https://') ? (
                      <a
                        href={valueString}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block break-all text-xs text-phala-blue-300 underline hover:text-white transition-colors"
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
    </div>
  )
}

// Verification bookmark tab — sticks UP from the top-right of the card like a
// real folder/file tab. It's a sibling above the card (not inside it), so the
// area to its left is the panel background (transparent against the panel),
// not the card's kind tint. -mb-px overlaps the card's top border by 1px so
// the tab and the card read as one connected shape.
const VerificationEyebrow: React.FC<{title: string}> = ({title}) => (
  <div className="relative z-10 -mb-px flex justify-end">
    <div className="inline-flex w-fit items-center gap-1.5 rounded-t-[6px] border border-b-0 border-black/15 bg-card px-2.5 py-1.5">
      <span className="inline-flex size-3.5 items-center justify-center rounded-[2px] bg-emerald-100">
        <Check className="size-2.5 text-emerald-700" strokeWidth={3} />
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[.14em] text-emerald-800">
        {title}
      </span>
    </div>
  </div>
)

// Unified Report Item Card - supports both collapsible and expanded modes
export const ReportItemCard: React.FC<{
  item: ReportItem
  collapsible?: boolean
  defaultExpanded?: boolean
  showContent?: boolean
  selectable?: boolean
  /** When set, renders a "✓ {title} VERIFIED" eyebrow at the top of the card. */
  sectionTitle?: string
}> = ({
  item,
  collapsible = false,
  defaultExpanded = false,
  showContent = true,
  selectable = false,
  sectionTitle,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const {selectedObjectId, setSelectedObjectId} = useAttestationData()

  // Sync isExpanded state when defaultExpanded prop changes
  useEffect(() => {
    setIsExpanded(defaultExpanded)
  }, [defaultExpanded])
  const isSelected = selectable && selectedObjectId === item.id

  const handleClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (selectable) {
      e.stopPropagation()
      setSelectedObjectId(isSelected ? null : item.id)
    } else if (collapsible && showContent) {
      setIsExpanded(!isExpanded)
    }
  }

  const shouldShowContent = showContent && (isExpanded || !collapsible)

  const theme = getCardTheme(item)

  // For collapsible mode - always show title row with chevron, content conditionally
  if (collapsible) {
    return (
      <div>
        {sectionTitle && <VerificationEyebrow title={sectionTitle} />}
        <div
          className={cn(
            'w-full overflow-hidden rounded-[4px] border text-left transition-all duration-200',
            theme.card,
            'hover:border-muted-foreground/30 cursor-pointer',
          )}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleClick(e)
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div
            className={cn(
              'dark px-3 py-2 border-b border-black/10',
              theme.title,
            )}
          >
            <CardHeader
              item={item}
              showChevron={showContent}
              isExpanded={isExpanded}
            />
          </div>
          {shouldShowContent && (
            <div className="p-3">
              <CardContent item={item} />
            </div>
          )}
        </div>
      </div>
    )
  }

  // For non-collapsible mode (report view style)
  // Use div instead of button to avoid nesting button elements (CopyButton inside)
  return (
    <div>
      {sectionTitle && <VerificationEyebrow title={sectionTitle} />}
      <div
        className={cn(
          'w-full overflow-hidden rounded-[4px] border text-left transition-all duration-200',
          theme.card,
          selectable && isSelected && 'border-primary ring-2 ring-primary/30',
          selectable &&
            !isSelected &&
            'border-border hover:border-muted-foreground/30 cursor-pointer',
          !selectable && 'border-border',
        )}
        onClick={selectable ? handleClick : undefined}
        onKeyDown={
          selectable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleClick(e)
                }
              }
            : undefined
        }
        role={selectable ? 'button' : undefined}
        tabIndex={selectable ? 0 : undefined}
      >
        <ReportItemContent item={item} />
      </div>
    </div>
  )
}

// Legacy alias for backward compatibility
export const CollapsibleReportItemCard = ReportItemCard
