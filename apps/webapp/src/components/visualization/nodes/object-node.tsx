import type {NodeProps} from '@xyflow/react'
import type React from 'react'

import {Separator} from '@/components/ui/separator'
import {getReportItem} from '@/data/report-items'
import {cn} from '@/lib/utils'
import {
  getKindTheme,
  ReportItemContent,
} from '../collapsible-report-item-card'
import {HandleGroup} from './handle-group'
import {ItemWithHandles} from './item-with-handles'
import type {ObjectNodeData} from './types'

interface ObjectNodeProps extends NodeProps {
  data: ObjectNodeData
}

// Categorical node-type colors — picked to stay distinct AND visible on both
// the light report canvas and the dark `--surface-trust-path` nodes canvas.
// Mirrors the original logic (per-kind switch + default + highlighted state),
// just swapped onto the v3 palette family (phala-blue + base-300 + primary).
const getBorderColor = (kind?: 'gateway' | 'kms' | 'app') => {
  switch (kind) {
    case 'gateway':
      return 'border-phala-blue-400'
    case 'kms':
      return 'border-phala-blue-200'
    case 'app':
      return 'border-base-300'
    default:
      return 'border-base-200'
  }
}

export const ObjectNode: React.FC<ObjectNodeProps> = (props) => {
  const {id, data} = props
  const {name, fields, calculations, isHighlighted, isDimmed, kind, edges} =
    data

  const reportItem = getReportItem(id)

  return (
    <div
      className={cn(
        'relative min-w-[120px] max-w-[220px] select-none overflow-hidden bg-card text-left text-xs transition-all duration-200',
        isHighlighted
          ? 'border-2 border-primary shadow-lg ring-2 ring-primary/40'
          : `border-2 ${getBorderColor(kind)}`,
        isDimmed && 'opacity-30',
      )}
      draggable={false}
    >
      <HandleGroup id={id} itemType="object" edges={edges} />

      {reportItem ? (
        <ReportItemContent
          item={{
            id: reportItem.id,
            title: reportItem.title,
            intro: reportItem.intro,
            vendorIcon: reportItem.vendorIcon,
          }}
        />
      ) : (
        <div
          className={cn(
            'dark w-full border-b border-black/10 px-2 py-1.5 font-medium text-sm',
            kind ? getKindTheme(kind).title : 'bg-muted',
          )}
        >
          {name}
        </div>
      )}
      {fields.length > 0 && (
        <>
          <Separator className="my-1" />
          <ul className="space-y-0 px-2 pb-1.5">
            {fields.map((field: string) => (
              <ItemWithHandles
                key={field}
                id={id}
                item={field}
                itemType="field"
                edges={edges}
              />
            ))}
          </ul>
        </>
      )}
      {calculations && calculations.length > 0 && (
        <>
          <Separator className="my-1" />
          <ul className="space-y-0 px-2 pb-1.5">
            {calculations.map((calculation: string) => (
              <ItemWithHandles
                key={calculation}
                id={id}
                item={calculation}
                itemType="calculation"
                edges={edges}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
