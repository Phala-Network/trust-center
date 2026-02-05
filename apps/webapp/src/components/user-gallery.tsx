'use client'

import Link from 'next/link'

import {AppLogo} from '@/components/app-logo'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {useUsers} from '@/lib/queries'

export function UserGallery() {
  const {data: users = []} = useUsers()

  if (users.length === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Featured Builders</h2>
        <p className="text-sm text-muted-foreground">
          Trusted workspaces deploying verified applications on dstack
        </p>
      </div>

      {/* User Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {users.map(
          (item: {
            user: string
            displayName: string
            count: number
            avatarUrl: string | null
          }) => {
            // avatarUrl is either a featured builder logo (/logos/...) or database avatarUrl
            const logoUrl = item.avatarUrl

            return (
              <Link
                key={item.user}
                href={`/${item.user}`}
                className="group flex items-center gap-3 p-4 bg-card rounded-xl border border-border hover:border-border/80 hover:shadow-lg transition-all duration-300"
              >
                {logoUrl ? (
                  <Avatar className="w-12 h-12 rounded-lg shrink-0">
                    <AvatarImage src={logoUrl} alt={item.displayName} className="object-contain" />
                    <AvatarFallback className="rounded-lg text-sm font-semibold">
                      {item.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <AppLogo
                    user={item.displayName}
                    appName={item.displayName}
                    size={48}
                    className="w-12 h-12 rounded-lg shrink-0"
                  />
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <h3 className="text-sm font-semibold truncate">
                    {item.displayName}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {item.count} {item.count === 1 ? 'app' : 'apps'}
                  </p>
                </div>
              </Link>
            )
          },
        )}
      </div>
    </div>
  )
}
