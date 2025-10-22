import type {NextConfig} from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Allow /widget routes to be embedded in iframes
        source: '/widget/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL',
          },
        ],
      },
      {
        // Deny all other routes from being embedded
        source: '/((?!widget).*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
        ],
      },
    ]
  },
}

export default nextConfig
