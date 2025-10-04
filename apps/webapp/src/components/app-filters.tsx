'use client'

import {Search} from 'lucide-react'
import {useRouter, useSearchParams} from 'next/navigation'
import {useEffect, useState, useTransition} from 'react'

import {Checkbox} from '@/components/ui/checkbox'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Button} from '@/components/ui/button'

interface AppFiltersProps {
  dstackVersions: Array<{version: string; count: number}>
}

export function AppFilters({dstackVersions}: AppFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const keyword = searchParams.get('keyword') || ''
  const dstackVersionsParam = searchParams.get('dstackVersions') || ''
  const selectedVersions = dstackVersionsParam ? dstackVersionsParam.split(',') : []

  // Local state for search input with debounce
  const [searchValue, setSearchValue] = useState(keyword)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      updateKeyword(searchValue)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchValue])

  // Sync with URL params when navigating back
  useEffect(() => {
    setSearchValue(keyword)
  }, [keyword])

  const updateKeyword = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set('keyword', value)
    } else {
      params.delete('keyword')
    }
    startTransition(() => {
      router.push(`/?${params.toString()}`)
    })
  }

  const toggleVersion = (version: string) => {
    const params = new URLSearchParams(searchParams.toString())
    const currentVersions = selectedVersions.slice()

    const index = currentVersions.indexOf(version)
    if (index > -1) {
      currentVersions.splice(index, 1)
    } else {
      currentVersions.push(version)
    }

    if (currentVersions.length > 0) {
      params.set('dstackVersions', currentVersions.join(','))
    } else {
      params.delete('dstackVersions')
    }

    startTransition(() => {
      router.push(`/?${params.toString()}`)
    })
  }

  const clearVersions = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('dstackVersions')
    startTransition(() => {
      router.push(`/?${params.toString()}`)
    })
  }

  return (
    <div className="w-full mb-8 space-y-6">
      {/* Search Input */}
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by app name or app ID..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* DStack Version Filters */}
      {dstackVersions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">DStack Versions</h3>
            {selectedVersions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearVersions}
                className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {dstackVersions.map((item) => (
              <div
                key={item.version}
                className="flex items-center space-x-2 bg-muted/50 rounded-md px-3 py-2 hover:bg-muted transition-colors"
              >
                <Checkbox
                  id={item.version}
                  checked={selectedVersions.includes(item.version)}
                  onCheckedChange={() => toggleVersion(item.version)}
                />
                <Label
                  htmlFor={item.version}
                  className="text-sm font-normal cursor-pointer flex items-center gap-1.5"
                >
                  {item.version}
                  <span className="text-xs text-muted-foreground">({item.count})</span>
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      {isPending && (
        <div className="text-sm text-muted-foreground">Loading...</div>
      )}
    </div>
  )
}
