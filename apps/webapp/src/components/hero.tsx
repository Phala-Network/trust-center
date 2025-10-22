import {ArrowRight, Check} from 'lucide-react'
import Image from 'next/image'

import {Button} from '@/components/ui/button'

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

        {/* Right: Report View Preview */}
        <div className="flex flex-col items-center justify-center px-4 sm:px-8 lg:px-0">
          <div className="w-full max-w-md space-y-3">
            {/* Header */}
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">
                    Example Application
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    TEE-verified deployment
                  </p>
                </div>
              </div>
            </div>

            {/* Success banner */}
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-green-900">
                  This App Has Been Verified
                </span>
              </div>
            </div>

            {/* Verification sections */}
            {[
              {
                title: 'TEE Hardware Verified',
                items: ['Intel TDX', 'NVIDIA H100'],
              },
              {title: 'Source Code Verified', items: ['Docker Compose Hash']},
              {
                title: 'Operating System Verified',
                items: ['Measurement Registers'],
              },
            ].map((section, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <div className="flex-shrink-0 rounded-full bg-green-100 p-1">
                    <Check className="h-3 w-3 text-green-600" />
                  </div>
                  <h4 className="text-xs font-medium text-foreground">
                    {section.title}
                  </h4>
                </div>
                <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                  <div className="space-y-1.5">
                    {section.items.map((item, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        <span className="text-xs text-muted-foreground">
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
