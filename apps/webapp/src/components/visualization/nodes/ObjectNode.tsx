import type {NodeProps} from '@xyflow/react'
import {Lock} from 'lucide-react'
import type React from 'react'

import {Separator} from '@/components/ui/separator'
import {getReportItem} from '@/data/report-items'
import {cn} from '@/lib/utils'
import {ReportItemContent} from '../ReportItemCard'
import {HandleGroup} from './HandleGroup'
import {ItemWithHandles} from './ItemWithHandles'
import type {ObjectNodeData} from './types'

interface ObjectNodeProps extends NodeProps {
  data: ObjectNodeData
}

const getBorderColor = (
  kind?: 'gateway' | 'kms' | 'app',
  isPlaceholder?: boolean,
) => {
  if (isPlaceholder) {
    return ''
  }

  switch (kind) {
    case 'gateway':
      return 'border-blue-300'
    case 'kms':
      return 'border-green-300'
    case 'app':
      return 'border-purple-300'
    default:
      return 'border-gray-200'
  }
}

export const ObjectNode: React.FC<ObjectNodeProps> = (props) => {
  const {id, data} = props
  const {
    name,
    fields,
    calculations,
    isHighlighted,
    isDimmed,
    kind,
    edges,
    isPlaceholder,
  } = data

  const reportItem = getReportItem(id)

  return (
    <div
      className={cn(
        'relative min-w-[120px] max-w-[220px] select-none rounded-md bg-background p-2 text-left text-xs transition-all duration-200',
        isHighlighted
          ? 'border-2 border-yellow-300 shadow-lg ring-2 ring-yellow-300'
          : `border-2 ${getBorderColor(kind, isPlaceholder)}`,
        isDimmed && 'opacity-30',
        isPlaceholder && 'opacity-60',
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
        <div className="w-full font-medium text-sm">{name}</div>
      )}
      {fields.length > 0 && (
        <>
          <Separator className="my-2" />
          <ul className="space-y-0">
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
          <Separator className="my-2" />
          <ul className="space-y-0">
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
      {isPlaceholder && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-md">
          <Lock className="h-6 w-6 text-muted-foreground/60" />
        </div>
      )}
    </div>
  )
}
