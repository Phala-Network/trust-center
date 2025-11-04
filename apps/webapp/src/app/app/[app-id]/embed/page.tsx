import {getApp} from '@/lib/db'
import EmbedLayout from '@/components/embed-layout'

interface EmbedPageProps {
  params: Promise<{
    'app-id': string
  }>
  searchParams: Promise<{selected?: string}>
}

export const generateMetadata = async ({params}: EmbedPageProps) => {
  const {['app-id']: appId} = await params
  const app = await getApp(appId) // No isPublic check for embed

  // Return default metadata if app not found or not completed
  if (!app || app.status !== 'completed') {
    return {
      title: 'Report Not Found',
      description: 'Trust report not yet generated',
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  return {
    title: `${app.appName} - Embedded Report`,
    description: `Trust report for ${app.appName} by Phala`,
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function EmbedPage({
  params,
  searchParams,
}: EmbedPageProps) {
  const {['app-id']: appId} = await params

  // Get the app directly from database (no isPublic check, protected by iframe restriction)
  const app = await getApp(appId)

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

  // Convert App to Task format for EmbedLayout compatibility
  const task = {
    id: app.id,
    appId: app.appId,
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
    <EmbedLayout
      searchParams={searchParams}
      appId={appId}
      taskId={app.id}
      task={task}
    />
  )
}
