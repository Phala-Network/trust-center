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
          <div className="relative w-full max-w-md h-[700px] overflow-hidden">
            {/* Fade out gradient at bottom */}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />

            {/* Widget container with scroll */}
            <div className="h-full overflow-y-auto">
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
  )
}
