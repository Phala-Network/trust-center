import type {Metadata} from 'next'
import {Geist, Geist_Mono} from 'next/font/google'

import {Providers} from '@/components/providers'
import fontVariables from '@/lib/fonts'

import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    template: '%s | Phala Trust Center',
    default: 'Phala Trust Center',
  },
  description:
    'Verify TEE applications on dstack - Hardware, OS, and source code attestation',
  metadataBase: new URL('https://trust.phala.com'),
  openGraph: {
    title: 'Phala Trust Center',
    description:
      'Verify TEE applications on dstack - Hardware, OS, and source code attestation',
    url: 'https://trust.phala.com',
    siteName: 'Phala Trust Center',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@PhalaNetwork',
    title: 'Phala Trust Center',
    description:
      'Verify TEE applications on dstack - Hardware, OS, and source code attestation',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fontVariables} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
