import {NextResponse} from 'next/server'
import type {NextRequest} from 'next/server'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Check if this is an embed route
  if (pathname.includes('/embed')) {
    const referer = request.headers.get('referer') || ''
    const origin = request.headers.get('origin') || ''
    const host = request.headers.get('host') || ''

    // Allow localhost for development
    const isDevelopment = host.includes('localhost') || host.includes('127.0.0.1')

    // Check if the request is from an allowed domain
    const allowedDomains = ['.phala.com', '.phala.network']
    const isAllowedReferer = allowedDomains.some(
      (domain) => referer.includes(domain) || referer.includes('localhost'),
    )
    const isAllowedOrigin = allowedDomains.some(
      (domain) => origin.includes(domain) || origin.includes('localhost'),
    )

    // For direct access (no referer/origin), only allow in development
    const isDirectAccess = !referer && !origin
    if (isDirectAccess && !isDevelopment) {
      return new NextResponse(
        'Forbidden: Embed only accessible via iframe from *.phala.com or *.phala.network',
        {
          status: 403,
          headers: {
            'Content-Type': 'text/plain',
          },
        },
      )
    }

    // For iframe access, check if from allowed domain
    if (!isDirectAccess && !isAllowedReferer && !isAllowedOrigin && !isDevelopment) {
      return new NextResponse(
        'Forbidden: Embed only accessible via iframe from *.phala.com or *.phala.network',
        {
          status: 403,
          headers: {
            'Content-Type': 'text/plain',
          },
        },
      )
    }

    // Set Content-Security-Policy to allow embedding from specific domains
    const response = NextResponse.next()
    response.headers.set(
      'Content-Security-Policy',
      "frame-ancestors 'self' https://*.phala.com https://*.phala.network http://localhost:*",
    )
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/app/:path*/embed'],
}
