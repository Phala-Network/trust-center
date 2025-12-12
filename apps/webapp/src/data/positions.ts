import type {DataObjectId} from './schema'

const COLUMN_WIDTHS: Record<number, number> = {
  '-2': 240,
  '-1': 220,
  '0': 260,
  '1': 240,
  '2': 200,
}

const getColumnX = (column: number): number => {
  const sortedColumns = Object.keys(COLUMN_WIDTHS)
    .map((col) => parseInt(col))
    .sort((a, b) => a - b)

  const columnIndex = sortedColumns.indexOf(column)
  if (columnIndex === -1) return 0

  let x = -250
  for (let i = 0; i < columnIndex; i++) {
    x += COLUMN_WIDTHS[sortedColumns[i]]
  }

  return x
}

const BASE_LAYOUT: Record<string, {x: number; y: number}> = {
  main: {x: getColumnX(0), y: 0},
  code: {x: getColumnX(0), y: 300},
  cpu: {x: getColumnX(1), y: -420},
  os: {x: getColumnX(0), y: 510},
  'os-code': {x: getColumnX(-1), y: 410},
  quote: {x: getColumnX(2), y: 7},
  gpu: {x: getColumnX(-2), y: 50},
  'gpu-quote': {x: getColumnX(-1), y: 50},
  'event-logs-imr0': {x: getColumnX(1), y: -128},
  'event-logs-imr1': {x: getColumnX(1), y: 210},
  'event-logs-imr2': {x: getColumnX(1), y: 405},
  'event-logs-imr3': {x: getColumnX(1), y: 545},
}

// Prefix base positions and their offsets
const PREFIX_CONFIG = {
  app: {baseX: 0, baseY: 0, name: 'App'},
  kms: {baseX: 300, baseY: 1000, name: 'KMS'},
  gateway: {baseX: -600, baseY: 1000, name: 'Gateway'},
} as const

type PrefixType = keyof typeof PREFIX_CONFIG

// Generate positions by combining prefix base + component offset
function generatePositions(): Record<DataObjectId, {x: number; y: number}> {
  const positions = {} as Record<DataObjectId, {x: number; y: number}>

  // Iterate through each prefix
  ;(Object.keys(PREFIX_CONFIG) as PrefixType[]).forEach((prefix) => {
    const prefixConfig = PREFIX_CONFIG[prefix]

    // Apply base layout to each component type
    Object.keys(BASE_LAYOUT).forEach((componentType) => {
      const componentLayout = BASE_LAYOUT[componentType]
      const componentId = `${prefix}-${componentType}` as DataObjectId

      positions[componentId] = {
        x: prefixConfig.baseX + componentLayout.x,
        y: prefixConfig.baseY + componentLayout.y,
      }
    })
  })

  return positions
}

export const INITIAL_POSITIONS: Record<DataObjectId, {x: number; y: number}> =
  generatePositions()
