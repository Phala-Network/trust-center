'use client'

import {debounce} from 'es-toolkit'
import {Search, X} from 'lucide-react'
import {parseAsArrayOf, parseAsString, useQueryStates} from 'nuqs'
import {useEffect, useMemo, useState, useTransition} from 'react'

import {AppLogo} from '@/components/app-logo'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {Button} from '@/components/ui/button'
import {Checkbox} from '@/components/ui/checkbox'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {useDstackVersions, useUsers} from '@/lib/queries'

// Avatar base URL for Phala Cloud R2
const AVATAR_BASE_URL = 'https://cloud-r2.phala.com'

export function AppFilters() {
  const [, startTransition] = useTransition()

  const [
    {keyword, dstackVersions: selectedVersions, users: selectedUsers},
    setQuery,
  ] = useQueryStates(
    {
      keyword: parseAsString.withDefault(''),
      dstackVersions: parseAsArrayOf(parseAsString).withDefault([]),
      users: parseAsArrayOf(parseAsString).withDefault([]),
    },
    {
      // shallow: true (default) only updates URL without triggering server re-render
      // This allows client-side react-query to handle filtering without page refresh
      // Pass startTransition for non-blocking UI updates
      startTransition,
    },
  )

  // Fetch dstack versions and users with react-query
  const {data: dstackVersions = []} = useDstackVersions({keyword})
  const {data: users = []} = useUsers({keyword})

  // Local state only for debounced search input
  const [searchValue, setSearchValue] = useState(keyword)

  // Sync search value when keyword changes (e.g., browser back/forward)
  useEffect(() => {
    setSearchValue(keyword)
  }, [keyword])

  // Debounced update function using es-toolkit
  const debouncedSetQuery = useMemo(
    () =>
      debounce((value: string) => {
        setQuery({keyword: value || null})
      }, 300),
    [setQuery],
  )

  // Update search on input change
  useEffect(() => {
    if (searchValue !== keyword) {
      debouncedSetQuery(searchValue)
    }
  }, [searchValue, keyword, debouncedSetQuery])

  const toggleVersion = (version: string) => {
    const newVersions = selectedVersions.includes(version)
      ? selectedVersions.filter((v) => v !== version)
      : [...selectedVersions, version]

    // nuqs handles optimistic updates automatically
    setQuery({dstackVersions: newVersions.length > 0 ? newVersions : null})
  }

  const toggleUser = (user: string) => {
    const newUsers = selectedUsers.includes(user)
      ? selectedUsers.filter((u) => u !== user)
      : [...selectedUsers, user]

    // nuqs handles optimistic updates automatically
    setQuery({users: newUsers.length > 0 ? newUsers : null})
  }

  const clearVersions = () => {
    setQuery({dstackVersions: null})
  }

  const clearUsers = () => {
    setQuery({users: null})
  }

  const clearSearch = () => {
    setSearchValue('')
    setQuery({keyword: null})
  }

  const hasActiveFilters =
    keyword || selectedVersions.length > 0 || selectedUsers.length > 0

  return (
    <div className="w-full space-y-6">
      {/* Search and Clear All Row */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by app name or app ID..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchValue && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-muted"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </div>
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              clearSearch()
              clearVersions()
              clearUsers()
            }}
            className="whitespace-nowrap"
          >
            Clear all filters
          </Button>
        )}
      </div>

      {/* DStack Version Filters */}
      {dstackVersions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              dstack version
            </h3>
            {selectedVersions.length > 0 && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {selectedVersions.length} selected
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {dstackVersions.map((item) => (
              <label
                key={item.version}
                className="inline-flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 cursor-pointer hover:bg-accent hover:border-accent-foreground/20 transition-colors has-[:checked]:bg-primary/10 has-[:checked]:border-primary has-[:checked]:text-primary"
              >
                <Checkbox
                  id={item.version}
                  checked={selectedVersions.includes(item.version)}
                  onCheckedChange={() => toggleVersion(item.version)}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <span className="text-sm font-medium">
                  {item.version.replace(/^(dstack-|v)/, '')}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({item.count})
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Owner Filters */}
      {users.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Filter by owner
            </h3>
            {selectedUsers.length > 0 && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {selectedUsers.length} selected
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {users.map((item) => {
              const fullAvatarUrl = item.avatarUrl
                ? `${AVATAR_BASE_URL}/${item.avatarUrl}`
                : null

              return (
                <label
                  key={item.user}
                  className="inline-flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 cursor-pointer hover:bg-accent hover:border-accent-foreground/20 transition-colors has-[:checked]:bg-primary/10 has-[:checked]:border-primary has-[:checked]:text-primary"
                >
                  <Checkbox
                    id={item.user}
                    checked={selectedUsers.includes(item.user)}
                    onCheckedChange={() => toggleUser(item.user)}
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  {fullAvatarUrl ? (
                    <Avatar className="w-5 h-5 rounded-lg">
                      <AvatarImage src={fullAvatarUrl} alt={item.user} />
                      <AvatarFallback className="rounded-lg text-[10px]">
                        {item.user.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <AppLogo
                      user={item.user}
                      appName={item.user}
                      size="xs"
                      className="w-5 h-5"
                    />
                  )}
                  <span className="text-sm font-medium">{item.user}</span>
                  <span className="text-xs text-muted-foreground">
                    ({item.count})
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
