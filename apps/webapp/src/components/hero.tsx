'use client'

import {ArrowRight} from 'lucide-react'
import Image from 'next/image'

import {AttestationDataProvider} from '@/components/attestation-data-context'
import {Button} from '@/components/ui/button'
import CompactReportWidget from '@/components/visualization/compact-report-widget'

// Mock app data for hero preview (AppWithTask structure)
const mockApp = {
  // App fields
  id: 'mock-app-id',
  profileId: 1,
  appName: 'AI Assistant',
  appConfigType: 'redpill' as const,
  contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
  modelOrDomain: 'app.example.com',
  dstackVersion: 'v0.5.3',
  workspaceId: 1,
  creatorId: 1,
  isPublic: true,
  deleted: false,
  customUser: null,
  createdAt: new Date().toISOString(),
  updatedAt: null,
  lastSyncedAt: null,
  // Task fields (TaskWithCounts extends Task which includes app fields for backward compatibility)
  task: {
    id: 'mock-task-id',
    appId: 'mock-app-id',
    appName: 'AI Assistant',
    appConfigType: 'redpill' as const,
    contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
    modelOrDomain: 'app.example.com',
    dstackVersion: 'v0.5.3',
    isPublic: true,
    verificationFlags: null,
    status: 'completed',
    errorMessage: null,
    s3Filename: null,
    s3Key: null,
    s3Bucket: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    user: null,
    dataObjects: [
      'app-cpu',
      'app-gpu',
      'app-code',
      'gateway-main',
      'app-os',
      'kms-main',
    ],
    dataObjectsCount: 6,
  },
}

// Mock attestation data objects
const mockAttestationData = [
  {id: 'app-cpu' as const, name: 'App CPU', fields: {}, kind: 'app' as const},
  {id: 'app-gpu' as const, name: 'App GPU', fields: {}, kind: 'app' as const},
  {id: 'app-code' as const, name: 'App Code', fields: {}, kind: 'app' as const},
  {
    id: 'gateway-main' as const,
    name: 'Gateway',
    fields: {},
    kind: 'gateway' as const,
  },
  {id: 'app-os' as const, name: 'App OS', fields: {}, kind: 'app' as const},
  {id: 'kms-main' as const, name: 'KMS', fields: {}, kind: 'kms' as const},
]

// Widget preview component - directly passing data via props
function WidgetPreview() {
  return (
    <AttestationDataProvider
      attestationData={mockAttestationData}
      loading={false}
      error={null}
    >
      <CompactReportWidget
        app={mockApp}
        config={{
          showAttributes: true,
          defaultExpanded: false,
          showSectionContent: false,
          darkMode: false,
          embedded: true,
        }}
      />
    </AttestationDataProvider>
  )
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
        <div className="flex items-center justify-center">
          <div className="flex flex-col items-center justify-center px-4 sm:px-8 lg:px-0">
            {/* Height-limited container with fade - matching Hero29 structure */}
            <div className="relative w-full h-[700px] overflow-hidden">
              {/* Fade out gradient at bottom - covers border too */}
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />

              {/* Border container matching Hero29 style exactly */}
              <div className="h-full border bg-muted rounded-xl p-4">
                {/* Inner container with rounded border like img in Hero29 */}
                <div className="h-full overflow-y-auto rounded-md border border-border/30 bg-background/50">
                  <WidgetPreview />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
