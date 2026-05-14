import {REPORT_ITEMS} from './report-items'
import type {DataObject, DataObjectId} from './schema'

/**
 * Layout strategy: keep the original hand-tuned prefix-offset layout (App
 * centered, KMS at +300/+1000, Gateway at -600/+1000) which already uses
 * space efficiently by interleaving KMS / Gateway "TEE Hardware" components
 * to the sides of App's middle rows.
 *
 * The ONLY non-trivial behavior on top of the static layout is intra-column
 * overlap repair: when a tall card (long intro + many fields) extends past
 * the editorial Y of the next card in the same column, the lower card is
 * pushed down so they don't visually overlap. Card heights are estimated
 * from data — fields × rowHeight + intro length + title strip.
 *
 * Layout is computed lazily from `attestationData` so unknown / missing
 * IDs aren't placed (caller falls back to {0, 0}).
 */

// Per-column physical width — original tuned values.
const COLUMN_WIDTHS: Record<string, number> = {
  '-2': 240,
  '-1': 220,
  '0': 260,
  '1': 240,
  '2': 200,
}

function getColumnX(column: number): number {
  const sortedColumns = Object.keys(COLUMN_WIDTHS)
    .map((c) => Number.parseInt(c, 10))
    .sort((a, b) => a - b)

  const columnIndex = sortedColumns.indexOf(column)
  if (columnIndex === -1) return 0

  let x = -250
  for (let i = 0; i < columnIndex; i++) {
    x += COLUMN_WIDTHS[String(sortedColumns[i])]
  }
  return x
}

// Logical column for each component type (negative = left of center).
const COMPONENT_COLUMN: Record<string, number> = {
  gpu: -2,
  'gpu-quote': -1,
  'os-code': -1,
  main: 0,
  code: 0,
  os: 0,
  cpu: 1,
  'event-logs-imr0': 1,
  'event-logs-imr1': 1,
  'event-logs-imr2': 1,
  'event-logs-imr3': 1,
  quote: 2,
}

// Editorial vertical position of each component type within its prefix block.
// Same values as the original BASE_LAYOUT so the overall visual matches.
const COMPONENT_Y: Record<string, number> = {
  main: 0,
  code: 300,
  cpu: -440,
  os: 510,
  'os-code': 410,
  quote: 7,
  gpu: 50,
  'gpu-quote': 50,
  'event-logs-imr0': -128,
  'event-logs-imr1': 210,
  'event-logs-imr2': 405,
  'event-logs-imr3': 545,
}

// Per-prefix offsets — the *minimums*. Both X and Y can be pushed outward
// when App's pushed bottom would otherwise leave KMS/Gateway columns
// horizontally colliding with App's stretched cards in the same Y band.
// We prefer pushing X (canvas widens) over pushing Y (canvas heightens)
// because horizontal scrolling matches the screen's wide aspect ratio.
const PREFIX_OFFSET_X_MIN: Record<string, number> = {
  app: 0,
  kms: 300,
  gateway: -600,
}
const PREFIX_OFFSET_Y_MIN: Record<string, number> = {
  app: 0,
  kms: 1000,
  gateway: 1000,
}

// Horizontal clearance between App's edge and the inner edge of a downstream
// prefix block when they would otherwise vertically overlap.
const INTER_PREFIX_HORIZONTAL_GAP = 60

const PREFIXES = ['app', 'kms', 'gateway'] as const
type Prefix = (typeof PREFIXES)[number]

// === Card-height estimation (used for intra-column overlap repair) ===
// Constants tuned against actual rendered cards: title strip with vendor
// icon ~60px, each field/calc list row ~28px (including its own padding +
// any separators), intro paragraph at text-xs leading-relaxed wrapping at
// ~34 chars per line in a 220px-wide card.

const TITLE_STRIP_HEIGHT = 64
const ROW_HEIGHT = 28
const CARD_PADDING_BOTTOM = 40
const INTRO_CHARS_PER_LINE = 34
const INTRO_LINE_HEIGHT = 22
const VERTICAL_GAP_BETWEEN_CARDS = 24

function estimateCardHeight(o: DataObject): number {
  let h = TITLE_STRIP_HEIGHT

  const reportItem = REPORT_ITEMS[o.id as keyof typeof REPORT_ITEMS]
  if (reportItem?.intro) {
    const lines = Math.max(
      1,
      Math.ceil(reportItem.intro.length / INTRO_CHARS_PER_LINE),
    )
    h += lines * INTRO_LINE_HEIGHT + 16
  }

  h += Object.keys(o.fields).length * ROW_HEIGHT

  const uniqueCalcs = new Set(
    o.calculations?.flatMap((c) => c.outputs) ?? [],
  ).size
  h += uniqueCalcs * ROW_HEIGHT

  h += CARD_PADDING_BOTTOM
  return h
}

interface PrefixGroup {
  byCol: Map<number, Array<{comp: string; y: number; height: number}>>
  /** Topmost editorial Y in the prefix (most-negative; e.g. cpu at -440). */
  naturalTop: number
  /** Bottom edge (y + height) of the deepest pushed card. */
  bottom: number
  /** Leftmost column index used. */
  leftCol: number
  /** Rightmost column index used. */
  rightCol: number
}

function gatherAndPush(
  prefix: Prefix,
  byId: Map<string, DataObject>,
): PrefixGroup {
  const byCol = new Map<
    number,
    Array<{comp: string; y: number; height: number}>
  >()
  let naturalTop = Number.POSITIVE_INFINITY

  for (const comp of Object.keys(COMPONENT_COLUMN)) {
    const id = `${prefix}-${comp}`
    const o = byId.get(id)
    if (!o) continue
    const col = COMPONENT_COLUMN[comp]
    if (!byCol.has(col)) byCol.set(col, [])
    byCol.get(col)!.push({
      comp,
      y: COMPONENT_Y[comp],
      height: estimateCardHeight(o),
    })
    if (COMPONENT_Y[comp] < naturalTop) naturalTop = COMPONENT_Y[comp]
  }

  // Push lower cards down per column to clear the previous card's footprint.
  let bottom = Number.NEGATIVE_INFINITY
  for (const items of byCol.values()) {
    items.sort((a, b) => a.y - b.y)
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1]
      const minY = prev.y + prev.height + VERTICAL_GAP_BETWEEN_CARDS
      if (items[i].y < minY) items[i].y = minY
    }
    for (const item of items) {
      const itemBottom = item.y + item.height
      if (itemBottom > bottom) bottom = itemBottom
    }
  }

  const cols = [...byCol.keys()]
  return {
    byCol,
    naturalTop: Number.isFinite(naturalTop) ? naturalTop : 0,
    bottom: Number.isFinite(bottom) ? bottom : 0,
    leftCol: cols.length > 0 ? Math.min(...cols) : 0,
    rightCol: cols.length > 0 ? Math.max(...cols) : 0,
  }
}

const colHalfWidth = (col: number): number =>
  (COLUMN_WIDTHS[String(col)] ?? 240) / 2

const colLeftEdge = (col: number): number => getColumnX(col) - colHalfWidth(col)
const colRightEdge = (col: number): number =>
  getColumnX(col) + colHalfWidth(col)

/**
 * Compute (x, y) per node from `attestationData`. Original layout, with two
 * safety nets: (1) intra-column overlap repair using estimated card heights,
 * (2) downstream prefix Y push when App's pushed bottom would otherwise leave
 * KMS / Gateway's columns colliding horizontally with App's stretched cards.
 */
export function computePositions(
  attestationData: DataObject[],
): Record<DataObjectId, {x: number; y: number}> {
  const positions = {} as Record<DataObjectId, {x: number; y: number}>
  const byId = new Map(attestationData.map((o) => [o.id as string, o]))

  // Pass 1 — gather + intra-column push for every prefix.
  const groups = new Map<Prefix, PrefixGroup>()
  for (const prefix of PREFIXES) {
    groups.set(prefix, gatherAndPush(prefix, byId))
  }

  // Pass 2 — downstream prefix X offsets. KMS sits at +300 / Gateway at -600
  // by default. But when App's pushed bottom would extend INTO their natural
  // Y range (i.e. App is tall enough that interleaving would collide), shift
  // them OUTWARD so their innermost column clears App's outermost column
  // horizontally. Y stays at the original 1000 baseline — they keep
  // interleaving with App's middle/bottom rows where horizontal clearance is
  // now guaranteed.
  const appGroup = groups.get('app') as PrefixGroup
  const appBottom = appGroup.bottom
  const appRightAbs = colRightEdge(appGroup.rightCol)
  const appLeftAbs = colLeftEdge(appGroup.leftCol)

  const prefixOffsetX: Record<Prefix, number> = {
    app: 0,
    kms: PREFIX_OFFSET_X_MIN.kms,
    gateway: PREFIX_OFFSET_X_MIN.gateway,
  }

  // KMS — shift right if App vertically reaches into KMS's Y band.
  {
    const g = groups.get('kms') as PrefixGroup
    const kmsTopY = PREFIX_OFFSET_Y_MIN.kms + g.naturalTop
    if (appBottom > kmsTopY && g.byCol.size > 0) {
      // KMS's leftmost column should sit to the right of App's right edge.
      // KMS innermost-left absolute X = prefixOffsetX.kms + colLeftEdge(g.leftCol)
      // Want: that > appRightAbs + GAP
      const required =
        appRightAbs + INTER_PREFIX_HORIZONTAL_GAP - colLeftEdge(g.leftCol)
      prefixOffsetX.kms = Math.max(PREFIX_OFFSET_X_MIN.kms, required)
    }
  }

  // Gateway — shift left if App vertically reaches into Gateway's Y band.
  {
    const g = groups.get('gateway') as PrefixGroup
    const gwTopY = PREFIX_OFFSET_Y_MIN.gateway + g.naturalTop
    if (appBottom > gwTopY && g.byCol.size > 0) {
      // Gateway's rightmost column should sit to the left of App's left edge.
      // Gateway innermost-right absolute X = prefixOffsetX.gateway + colRightEdge(g.rightCol)
      // Want: that < appLeftAbs - GAP
      const required =
        appLeftAbs - INTER_PREFIX_HORIZONTAL_GAP - colRightEdge(g.rightCol)
      prefixOffsetX.gateway = Math.min(
        PREFIX_OFFSET_X_MIN.gateway,
        required,
      )
    }
  }

  // Pass 3 — emit positions. Y always uses the original PREFIX_OFFSET_Y_MIN.
  for (const prefix of PREFIXES) {
    const offsetX = prefixOffsetX[prefix]
    const offsetY = PREFIX_OFFSET_Y_MIN[prefix]
    const g = groups.get(prefix) as PrefixGroup

    for (const items of g.byCol.values()) {
      for (const item of items) {
        const id = `${prefix}-${item.comp}` as DataObjectId
        positions[id] = {
          x: offsetX + getColumnX(COMPONENT_COLUMN[item.comp]),
          y: offsetY + item.y,
        }
      }
    }
  }

  return positions
}

/**
 * Backward-compat export for callers that need the full layout (all 33 IDs).
 * Builds an `attestationData`-shaped stub so every component appears in every
 * prefix and therefore every position is filled.
 */
const ALL_IDS_STUB: DataObject[] = Object.keys(COMPONENT_COLUMN).flatMap(
  (comp) =>
    PREFIXES.map(
      (prefix) =>
        ({
          id: `${prefix}-${comp}` as DataObjectId,
          name: '',
          fields: {},
          kind: prefix,
        }) as DataObject,
    ),
)

export const INITIAL_POSITIONS: Record<DataObjectId, {x: number; y: number}> =
  computePositions(ALL_IDS_STUB)
