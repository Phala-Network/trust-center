import {Provider} from 'jotai'
import type {Metadata} from 'next'
import {Geist, Geist_Mono} from 'next/font/google'

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
    'Phala is the new cloud for confidential AI helping build AI people can trust.',
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
        <Provider>{children}</Provider>
      </body>
    </html>
  )
}
