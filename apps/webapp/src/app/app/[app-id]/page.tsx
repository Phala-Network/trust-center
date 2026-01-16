import AppLayout from '@/components/app-layout'
import {getApp} from '@/lib/db'

interface AppPageProps {
  params: Promise<{
    'app-id': string
  }>
  searchParams: Promise<{selected?: string}>
}

export const generateMetadata = async ({params}: AppPageProps) => {
  const {['app-id']: appId} = await params
  const app = await getApp(appId) // Allow direct access, only filter isPublic in list pages

  // Return default metadata if app not found or not completed
  if (!app || app.task.status !== 'completed') {
    return {
      title: 'Report Not Found',
      description: 'Trust report not yet generated',
    }
  }

  // Use displayName if available, otherwise fallback to appName
  const displayName = app.profile?.displayName || app.appName
  const displayUser = app.workspaceProfile?.displayName || app.customUser
  const description =
    app.profile?.description ||
    `Verified TEE application${displayUser ? ` by ${displayUser}` : ''} - Hardware, OS, and source code attestation verified on Phala Trust Center`

  const url = `https://trust.phala.com/app/${appId}`

  // Don't index non-public apps
  const robots = app.isPublic
    ? undefined
    : {
        index: false,
        follow: false,
      }

  return {
    title: displayName,
    description,
    openGraph: {
      title: `${displayName} - Verified on Phala Trust Center`,
      description,
      url,
      siteName: 'Phala Trust Center',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      site: '@PhalaNetwork',
      title: `${displayName} - Verified on Phala Trust Center`,
      description,
    },
    alternates: {
      canonical: url,
    },
    ...(robots && {robots}),
  }
}

export default async function AppPage({params, searchParams}: AppPageProps) {
  const {['app-id']: appId} = await params

  // Get the app directly from database (allow direct access, only filter isPublic in list pages)
  const app = await getApp(appId)

  // Show "check back later" message if app not found or report not completed
  if (!app || app.task.status !== 'completed') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-6">
          <h1 className="text-2xl font-semibold">Report Not Found</h1>
          <p className="text-muted-foreground">
            The verification report for this app has not been generated yet.
            Please check back later.
          </p>
        </div>
      </div>
    )
  }

  return <AppLayout searchParams={searchParams} app={app} />
}
