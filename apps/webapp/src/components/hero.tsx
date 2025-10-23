'use client'

import {ArrowRight} from 'lucide-react'
import Image from 'next/image'

import {AttestationDataProvider} from '@/components/attestation-data-context'
import {Button} from '@/components/ui/button'
import {HydrateProvider} from '@/components/hydrate-provider'
import CompactReportWidget from '@/components/visualization/compact-report-widget'

// Mock task data for hero preview
const mockTask = {
  id: 'mock-task-id',
  appId: 'mock-app-id',
  appName: 'AI Assistant',
  user: 'example-user',
  appConfigType: 'redpill' as const,
  contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
  modelOrDomain: 'app.example.com',
  verificationFlags: null,
  status: 'completed' as const,
  result: {},
  bullJobId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  dstackVersion: 'v0.5.3',
  dataObjects: ['app-cpu', 'app-gpu', 'app-code', 'gateway-main', 'app-os', 'kms-main'],
}

// Mock attestation data objects
const mockAttestationData = [
  {id: 'app-cpu' as const, name: 'App CPU', fields: {}, kind: 'app' as const},
  {id: 'app-gpu' as const, name: 'App GPU', fields: {}, kind: 'app' as const},
  {id: 'app-code' as const, name: 'App Code', fields: {}, kind: 'app' as const},
  {id: 'gateway-main' as const, name: 'Gateway', fields: {}, kind: 'gateway' as const},
  {id: 'app-os' as const, name: 'App OS', fields: {}, kind: 'app' as const},
  {id: 'kms-main' as const, name: 'KMS', fields: {}, kind: 'kms' as const},
]

const mockAppInfo = {
  appId: 'mock-app-id',
  appName: 'AI Assistant',
}

export function Hero() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid items-center gap-6 py-12 sm:gap-8 sm:py-16 lg:grid-cols-2 lg:gap-12 lg:py-20">
        {/* Left: Logo, Title, Description, CTA */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left lg:pl-8">
          {/* Logo */}
          <div className="mb-4">
            <Image
              src="/logo.svg"
              alt="Phala"
              width={160}
              height={40}
              className="h-8 w-auto sm:h-10"
            />
          </div>

          <h1 className="my-3 text-4xl font-bold text-pretty sm:my-4 sm:text-5xl lg:text-6xl">
            Trust Center
          </h1>
          <p className="mb-6 max-w-xl text-sm text-muted-foreground sm:text-base lg:text-lg">
            Comprehensive platform for verifying Trusted Execution Environment
            attestations. View real-time verification data, attestation reports,
            and ensure the integrity of your secure computing environments.
          </p>
          <div className="flex w-full flex-col justify-center gap-2 sm:flex-row lg:justify-start">
            <Button asChild className="w-full sm:w-auto" size="lg">
              <a
                href="https://cloud.phala.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Get Started
                <ArrowRight className="ml-2 size-4" />
              </a>
            </Button>
          </div>
        </div>

        {/* Right: Widget Preview - using actual CompactReportWidget */}
        <div className="flex flex-col items-center justify-center px-4 sm:px-8 lg:px-0">
          {/* SVG Grid Background - behind everything */}
          <div className="absolute inset-0 overflow-hidden opacity-50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 1400 900"
              className="h-full w-full"
            >
              <defs>
                <filter id="blur1" x="-20%" y="-20%" width="140%" height="140%">
                  <feFlood floodOpacity="0" result="BackgroundImageFix" />
                  <feBlend
                    mode="normal"
                    in="SourceGraphic"
                    in2="BackgroundImageFix"
                    result="shape"
                  />
                  <feGaussianBlur
                    stdDeviation="100"
                    result="effect1_foregroundBlur"
                  />
                </filter>
                <pattern
                  id="innerGrid"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth="0.5"
                    strokeOpacity={0.1}
                  />
                </pattern>
                <pattern
                  id="grid"
                  width="160"
                  height="160"
                  patternUnits="userSpaceOnUse"
                >
                  <rect width="160" height="160" fill="url(#innerGrid)" />
                  <path
                    d="M 70 80 H 90 M 80 70 V 90"
                    fill="none"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth="1"
                    strokeOpacity={0.05}
                  />
                </pattern>
              </defs>
              <g filter="url(#blur1)">
                <rect width="1400" height="900" fill="hsl(var(--muted))" fillOpacity="0.2" />
                <circle cx="800" cy="600" fill="hsl(var(--primary))" fillOpacity="0.15" r="200" />
                <circle cx="1100" cy="400" fill="hsl(var(--primary))" fillOpacity="0.1" r="150" />
              </g>
              <rect width="1400" height="900" fill="url(#grid)" />
            </svg>
          </div>

          {/* Height-limited container with fade */}
          <div className="relative w-full max-w-md h-[700px] overflow-hidden">
            {/* Fade out gradient at bottom - covers border too */}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />

            {/* Border container matching Hero29 style */}
            <div className="h-full border border-background/40 bg-background/20 rounded-xl p-4 overflow-hidden">
              {/* Widget container with scroll */}
              <div className="h-full overflow-y-auto rounded-md">
                <HydrateProvider
                  task={mockTask}
                  appId={mockAppInfo.appId}
                  taskId={mockTask.id}
                >
                  <AttestationDataProvider
                    attestationData={mockAttestationData}
                    loading={false}
                    error={null}
                  >
                    <CompactReportWidget
                      config={{
                        showAttributes: true,
                        defaultExpanded: false,
                        showSectionContent: false,
                        darkMode: false,
                        embedded: true,
                      }}
                    />
                  </AttestationDataProvider>
                </HydrateProvider>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
