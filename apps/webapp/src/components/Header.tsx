'use client'

import {FileText, Network, RotateCcw} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import type React from 'react'
import {useMemo} from 'react'

import {useAttestationData} from '@/components/AttestationDataContext'
import {Input} from '@/components/ui/input'
import {useLayout} from '@/hooks/use-layout'
import {Button} from './ui/button'

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
    </header>
  )
}
