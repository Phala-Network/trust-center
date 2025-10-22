import type {NextConfig} from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Allow /widget routes to be embedded in any iframe
        source: '/widget/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors *",
          },
        ],
      },
      {
        // Allow all other routes to be embedded only by *.phala.com and *.phala.network
        source: '/((?!widget).*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://*.phala.com https://*.phala.network",
          },
        ],
      },
    ]
  },
}

export default nextConfig
