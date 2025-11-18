import {dehydrate, HydrationBoundary, QueryClient} from '@tanstack/react-query'
import {Suspense} from 'react'
import {getApps, getDstackVersions, getUsers} from '@/lib/db'
import {HomeClient} from '@/app/_components/home-client'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {PhalaNavbar} from '@/components/navbar'
import {notFound} from 'next/navigation'

interface UserPageProps {
  params: Promise<{
    username: string
  }>
}

export const generateMetadata = async ({params}: UserPageProps) => {
  const {username} = await params
  const decodedUsername = decodeURIComponent(username)

  // Get all users (featured builders)
  const allUsers = await getUsers()
  const profile = allUsers.find((u) => u.user === decodedUsername)

  if (!profile) {
    return {
      title: 'User Not Found',
      description: 'The requested user profile could not be found',
    }
  }

  return {
    title: `${profile.displayName} - Trust Center`,
    description: `View applications by ${profile.displayName} on Phala Trust Center`,
  }
}

export default async function UserPage({params, searchParams}: UserPageProps & {searchParams: Promise<{[key: string]: string | string[] | undefined}>}) {
  const {username} = await params
  const decodedUsername = decodeURIComponent(username)

  // Get all users (featured builders)
  const allUsers = await getUsers()

  // Find the matching user
  const profile = allUsers.find((u) => u.user === decodedUsername)

  if (!profile) {
    notFound()
  }

  const queryClient = new QueryClient()

  // Prefetch initial data filtered by username
  await queryClient.prefetchInfiniteQuery({
    queryKey: ['apps', {sortBy: 'appName', username: decodedUsername, perPage: 24}],
    queryFn: () => getApps({sortBy: 'appName', username: decodedUsername, page: 1, perPage: 24}),
    initialPageParam: 1,
    pages: 1,
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.page + 1 : undefined
    },
  })

  // Prefetch dstack versions filtered by username
  await queryClient.prefetchQuery({
    queryKey: ['dstack-versions', {username: decodedUsername}],
    queryFn: () => getDstackVersions({username: decodedUsername}),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PhalaNavbar />
      <div className="min-h-screen pt-[72px]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Profile Header */}
          <div className="mb-12 flex items-start gap-6">
            <div className="shrink-0">
              <Avatar className="w-24 h-24 rounded-lg">
                {profile.avatarUrl && (
                  <AvatarImage
                    src={profile.avatarUrl}
                    alt={profile.displayName}
                  />
                )}
                <AvatarFallback className="rounded-lg text-3xl font-bold">
                  {profile.displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 space-y-2">
              <h1 className="text-3xl font-bold">{profile.displayName}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  {profile.count} {profile.count === 1 ? 'app' : 'apps'}
                </span>
              </div>
            </div>
          </div>

          {/* Apps List with Filters */}
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">Applications</h2>
              <p className="text-sm text-muted-foreground">
                Verified applications by {profile.displayName}
              </p>
            </div>
            <Suspense fallback={<div className="w-full h-96" />}>
              <HomeClient username={decodedUsername} />
            </Suspense>
          </div>
        </div>
      </div>
    </HydrationBoundary>
  )
}
