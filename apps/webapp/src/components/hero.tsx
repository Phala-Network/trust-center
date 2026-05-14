import {ArrowRight, ShieldCheck} from 'lucide-react'

import {HeroMockup} from '@/components/landing/hero-mockup'
import {Button} from '@/components/ui/button'

export function Hero() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-12">
      <div className="grid items-center gap-10 py-14 md:py-20 lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,1fr)] lg:gap-12">
        {/* Left: eyebrow + display heading + body + CTAs */}
        <div className="flex flex-col items-start">
          <p className="mb-5 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.14em] text-muted-foreground">
            <span className="inline-flex size-1.5 rounded-full bg-primary" />
            Trust Center · Live
          </p>

          <h1 className="font-display text-[44px] leading-[0.98] text-foreground text-balance sm:text-[64px] lg:text-[76px]">
            Verify any TEE app, instantly.
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            Hardware attestation, OS measurement, source-code hash, and
            zero-trust domain checks — surfaced as a verifiable receipt for
            every app running on dstack.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-11 rounded-[4px] px-5">
              <a href="#verified-apps">
                <ShieldCheck className="mr-2 size-4" />
                Browse verified apps
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-11 rounded-[4px] px-5"
            >
              <a
                href="https://docs.phala.com/phala-cloud/attestation/trust-center-verification"
                target="_blank"
                rel="noopener noreferrer"
              >
                Read docs
                <ArrowRight className="ml-2 size-4" />
              </a>
            </Button>
          </div>
        </div>

        {/* Right: static trust-center mockup (cream app panel + phala-blue dimensions) */}
        <div className="flex min-w-0 items-center justify-center">
          <HeroMockup />
        </div>
      </div>
    </div>
  )
}
