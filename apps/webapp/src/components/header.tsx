'use client'

import {FileText, Network, RotateCcw, Palette} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import type React from 'react'
import {useMemo, useState} from 'react'
import {useAtom} from 'jotai'

import {useAttestationData} from '@/components/attestation-data-context'
import {Input} from '@/components/ui/input'
import {useLayout} from '@/hooks/use-layout'
import {appIdAtom, taskIdAtom} from '@/stores/app'
import {Button} from './ui/button'
import WidgetPlaygroundModal from './widget-playground-modal'

export default function Header() {
  const {
    attestationData,
    searchTerm,
    setSearchTerm,
    showAutocomplete,
    setShowAutocomplete,
    compactMode,
    setCompactMode,
    setSelectedObjectId,
  } = useAttestationData()

  // Use the layout hook
  const {isClient, showModeSwitch, showResetButton, resetLayout} = useLayout()

  // Get app and task IDs from atoms
  const [appId] = useAtom(appIdAtom)
  const [taskId] = useAtom(taskIdAtom)

  // Widget playground modal state
  const [showWidgetModal, setShowWidgetModal] = useState(false)

  // Filter objects based on search term
  const filteredObjects = useMemo(() => {
    if (!searchTerm.trim()) return []
    const term = searchTerm.toLowerCase()
    return attestationData
      .filter((o) => o.name.toLowerCase().includes(term))
      .slice(0, 10) // Limit to 10 results
  }, [searchTerm, attestationData])

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchTerm(value)
    setShowAutocomplete(value.length > 0)
  }

  // Handle object selection from autocomplete
  const handleObjectSelect = (objectId: string) => {
    setSelectedObjectId(objectId)
    setSearchTerm('')
    setShowAutocomplete(false)
  }

  // Handle mode switch in compact mode
  const handleModeSwitch = () => {
    const newMode = compactMode === 'report' ? 'nodes' : 'report'
    setCompactMode(newMode)
  }

  // Generate widget URL
  const widgetUrl = useMemo(() => {
    if (!appId) return null
    if (taskId) {
      return `/widget/app/${appId}/${taskId}`
    }
    return `/widget/app/${appId}`
  }, [appId, taskId])

  return (
    <header className="flex items-center gap-6 border-b px-4 py-2">
      <Link href="/" className="flex items-center gap-3">
        <Image src="/logo.svg" alt="Phala" width={72} height={24} />
        <hr className="h-6 border-r" />
        <h1 className="text-sm font-semibold">Trust Center</h1>
      </Link>
      <div className="relative max-w-sm flex-1 md:max-w-md">
        <Input
          placeholder="Search objects…"
          value={searchTerm}
          onChange={handleSearchChange}
          onFocus={() => setShowAutocomplete(searchTerm.length > 0)}
          onBlur={() => {
            // Use requestAnimationFrame to allow click events to process before hiding autocomplete
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                setShowAutocomplete(false)
              })
            })
          }}
        />
        {showAutocomplete && filteredObjects.length > 0 && (
          <div className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-auto rounded-md border bg-white shadow-lg">
            {filteredObjects.map((object) => (
              <button
                key={object.id}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                onClick={() => handleObjectSelect(object.id)}
              >
                {object.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="ml-auto flex items-center gap-2">
        {isClient && widgetUrl && (
          <Button
            variant="outline"
            onClick={() => setShowWidgetModal(true)}
            title="Customize widget"
          >
            <Palette className="size-4" />
            Widget
          </Button>
        )}
        {isClient && showModeSwitch && (
          <Button
            variant="outline"
            onClick={handleModeSwitch}
            title={`Switch to ${compactMode === 'report' ? 'nodes' : 'report'} view`}
          >
            {compactMode === 'report' ? (
              <>
                <Network className="size-4" />
                Nodes
              </>
            ) : (
              <>
                <FileText className="size-4" />
                Report
              </>
            )}
          </Button>
        )}
        {isClient && showResetButton && (
          <Button
            onClick={resetLayout}
            title="Reset layout to default"
            variant="outline"
          >
            <RotateCcw className="size-4" />
            Reset
          </Button>
        )}
      </div>

      {/* Widget Playground Modal */}
      {widgetUrl && (
        <WidgetPlaygroundModal
          open={showWidgetModal}
          onOpenChange={setShowWidgetModal}
          widgetUrl={widgetUrl}
          appId={appId}
          taskId={taskId}
        />
      )}
    </header>
  )
}
