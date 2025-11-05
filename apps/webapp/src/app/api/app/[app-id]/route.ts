import {NextRequest, NextResponse} from 'next/server'

import {getApp} from '@/lib/db'

interface RouteParams {
  params: Promise<{
    'app-id': string
  }>
}

// Helper function to check if origin is allowed
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false

  const allowedPatterns = [
    /^https?:\/\/[a-zA-Z0-9-]+\.phala\.network$/,
    /^https?:\/\/[a-zA-Z0-9-]+\.phala\.com$/,
    /^https?:\/\/.*\.?localhost(:\d+)?$/,
  ]

  return allowedPatterns.some((pattern) => pattern.test(origin))
}

// Helper function to add CORS headers
function addCorsHeaders(response: NextResponse, origin: string | null) {
  if (origin && isAllowedOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  }
  return response
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  const response = new NextResponse(null, {status: 204})
  return addCorsHeaders(response, origin)
}

export async function GET(request: NextRequest, {params}: RouteParams) {
  const {'app-id': appId} = await params
  const origin = request.headers.get('origin')

  // Get the app directly from database (same logic as embed page - no isPublic check)
  const app = await getApp(appId)

  // Return 404 if app not found
  if (!app) {
    const response = NextResponse.json({error: 'App not found'}, {status: 404})
    return addCorsHeaders(response, origin)
  }

  // Return only id and status fields
  const response = NextResponse.json({
    id: app.id,
    status: app.status,
  })

  return addCorsHeaders(response, origin)
}
