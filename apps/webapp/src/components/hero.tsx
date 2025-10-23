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

        {/* Right: Widget Preview - matching compact-report-widget style */}
        <div className="flex flex-col items-center justify-center px-4 sm:px-8 lg:px-0">
          <div className="relative p-4 w-full max-w-sm">
            {/* Dotted background layer */}
            <div
              className="absolute inset-0 pointer-events-none opacity-15"
              style={{
                backgroundImage:
                  'radial-gradient(circle, currentColor 1px, transparent 1px)',
                backgroundSize: '16px 16px',
              }}
            />

            {/* Widget card */}
            <div className="text-foreground relative mx-auto rounded-lg overflow-hidden bg-card border border-border shadow-sm">
              {/* Phala Trust Certificate Header */}
              <div className="bg-gradient-to-br from-muted/40 to-muted/20 px-5 py-3 border-b border-border/50">
                <div className="flex items-center justify-center gap-2">
                  <Image src="/logo.svg" alt="Phala" width={60} height={20} />
                  <span className="text-xs font-semibold text-muted-foreground">
                    Trust Certificate
                  </span>
                </div>
              </div>

              {/* Header section */}
              <div className="p-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 flex-shrink-0 ring-2 ring-background shadow-sm rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-xs font-medium text-muted-foreground/90 truncate leading-tight">
                      example-user
                    </p>
                    <h1 className="text-lg font-semibold tracking-tight truncate leading-tight text-foreground">
                      AI Assistant
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1.5 text-xs h-5 px-2 bg-secondary rounded">
                        <Image
                          src="/dstack.svg"
                          alt="DStack"
                          width={48}
                          height={12}
                          className="opacity-70"
                        />
                        <span className="font-semibold">v0.5.3</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attributes Section */}
              <div className="px-5 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground/70 min-w-[72px] font-medium text-xs uppercase tracking-wide">
                    Type
                  </span>
                  <span className="flex-1 font-medium text-foreground">
                    redpill
                  </span>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground/70 min-w-[72px] font-medium text-xs uppercase tracking-wide">
                    Domain
                  </span>
                  <span className="flex-1 truncate text-foreground">
                    app.example.com
                  </span>
                </div>
              </div>

              {/* Verification Status */}
              <div className="border-t px-4 py-3 mt-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground mx-auto mb-2">
                  <Check className="h-5 w-5" />
                </div>
                <h2 className="font-semibold text-sm text-center text-foreground">
                  Verified & Trusted
                </h2>
                <p className="mt-1 text-xs text-muted-foreground text-center leading-relaxed">
                  Complete chain of trust verification including hardware, OS,
                  source code, and network infrastructure.
                </p>
              </div>

              {/* Trust Sections */}
              <div className="space-y-4 px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-primary text-primary-foreground p-1 flex-shrink-0">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">
                    TEE Hardware Verified
                  </h3>
                </div>
              </div>

              <div className="space-y-4 px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-primary text-primary-foreground p-1 flex-shrink-0">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">
                    Source Code Verified
                  </h3>
                </div>
              </div>

              <div className="space-y-4 px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-primary text-primary-foreground p-1 flex-shrink-0">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">
                    Network End-to-End Encrypted
                  </h3>
                </div>
              </div>

              {/* Powered by Phala footer */}
              <div className="border-t border-border/50 px-5 py-3 bg-muted/20">
                <a
                  href="https://phala.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>Powered by</span>
                  <span className="font-semibold">Phala</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
