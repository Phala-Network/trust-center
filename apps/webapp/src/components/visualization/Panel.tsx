import {ArrowLeft} from 'lucide-react'
import React, {useEffect} from 'react'

import {cn} from '@/lib/utils'
import {Button} from '../ui/button'
import NodesView from './NodesView'
import ReportView from './ReportView'
import ValuesView from './ValuesView'

interface PanelProps {
  view: 'report' | 'values' | 'nodes'
  onBack?: () => void
}

const Panel: React.FC<PanelProps> = ({view, onBack}) => {
  const panelBodyRef = React.useRef<HTMLDivElement>(null)

  // Reset scroll to top when view changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: we only want to reset the scroll when the view changes
  useEffect(() => {
    if (panelBodyRef.current) {
      panelBodyRef.current.scrollTop = 0
    }
  }, [view])

  return (
    <div className="flex h-full flex-col border-r last:border-none dark:border-border/50">
      {/* Panel header - only show back button for compact mode on values view */}
      {view === 'values' && onBack && (
        <div className="flex items-center gap-2 border-b px-2 py-1 text-sm">
          <Button onClick={onBack} variant="ghost">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </div>
      )}

      {/* Panel body */}
      <div ref={panelBodyRef} className={cn('flex-1 overflow-auto')}>
        {view === 'report' && <ReportView />}
        {view === 'values' && <ValuesView />}
        {view === 'nodes' && <NodesView />}
      </div>
    </div>
  )
}

export default Panel
