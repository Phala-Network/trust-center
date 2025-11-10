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
  const app = await getApp(appId, true) // Only show public apps

  // Return default metadata if app not found or not completed
  if (!app || app.status !== 'completed') {
    return {
      title: 'Report Not Found',
      description: 'Trust report not yet generated',
    }
  }

  return {
    title: `${app.appName}`,
    description: `Trust report for ${app.appName} by Phala`,
  }
}

export default async function AppPage({params, searchParams}: AppPageProps) {
  const {['app-id']: appId} = await params

  // Get the app directly from database (only public apps)
  const app = await getApp(appId, true)

  // Show "check back later" message if app not found or report not completed
  if (!app || app.status !== 'completed') {
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

  // Convert App to Task format for AppLayout compatibility
  const task = {
    id: app.id,
    appId: app.appId,
    appProfileId: app.appProfileId,
    appName: app.appName,
    appConfigType: app.appConfigType as 'redpill' | 'phala_cloud',
    contractAddress: app.contractAddress,
    modelOrDomain: app.modelOrDomain,
    verificationFlags: app.verificationFlags,
    status: app.status,
    errorMessage: app.errorMessage,
    s3Filename: app.s3Filename,
    s3Key: app.s3Key,
    s3Bucket: app.s3Bucket,
    createdAt: app.createdAt,
    startedAt: app.startedAt,
    finishedAt: app.finishedAt,
    user: app.user,
    dstackVersion: app.dstackVersion,
    dataObjects: app.dataObjects,
    isPublic: app.isPublic,
  }

  return (
    <AppLayout
      searchParams={searchParams}
      appId={appId}
      taskId={app.id}
      task={task}
    />
  )
}
