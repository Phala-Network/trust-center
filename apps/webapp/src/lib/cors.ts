import {NextResponse} from 'next/server'

const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/[a-zA-Z0-9-]+\.phala\.network$/,
  /^https?:\/\/[a-zA-Z0-9-]+\.phala\.com$/,
  /^https?:\/\/[a-zA-Z0-9-]+\.clawdi\.ai$/,
  /^https?:\/\/[a-zA-Z0-9-]+\.redpill\.ai$/,
  /^https?:\/\/.*\.?localhost(:\d+)?$/,
]

const FRAME_ANCESTORS = [
  '*.phala.network',
  '*.phala.com',
  '*.clawdi.ai',
  '*.redpill.ai',
  '*.localhost:*',
  'localhost:*',
]

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))
}

export function addCorsHeaders(
  response: NextResponse,
  origin: string | null,
  methods = 'GET, OPTIONS',
) {
  if (origin && isAllowedOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Methods', methods)
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  }

  response.headers.set(
    'Content-Security-Policy',
    `frame-ancestors ${FRAME_ANCESTORS.join(' ')}`,
  )

  return response
}

export function corsPreflight(origin: string | null) {
  return addCorsHeaders(new NextResponse(null, {status: 204}), origin)
}
