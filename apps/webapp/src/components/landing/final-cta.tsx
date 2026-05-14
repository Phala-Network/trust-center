import {ArrowRight, Copy, Terminal} from 'lucide-react'

const COMMAND_LINES = [
  'curl -X POST https://trust-center.phala.network/api/verify \\',
  '  -H "Content-Type: application/json" \\',
  "  -d '{\"appId\":\"<your-app-id>\"}'",
]

const RESULT_LINE =
  '✓ verified · hardware · os · source · zero-trust → receipt cached'

export function FinalCta() {
  return (
    <section className="bg-background py-16 md:py-24">
      <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-12">
        <div className="grid gap-px overflow-hidden border border-border bg-border lg:grid-cols-[0.9fr_1.1fr]">
          {/* Left: copy + CTAs */}
          <div className="flex flex-col justify-center bg-card p-8 md:p-10">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[.14em] text-muted-foreground">
              Verify your own app
            </p>
            <h2 className="font-display text-[clamp(28px,2.6vw,42px)] leading-[1.08] text-foreground">
              Receipts, on demand.
            </h2>
            <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
              Submit any dstack app ID and Trust Center returns a structured
              proof — replayable offline, embeddable as a widget, citable by
              hash.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#verified-apps"
                className="inline-flex h-11 items-center gap-2 rounded-[4px] bg-primary px-5 text-[15px] font-medium text-primary-foreground transition hover:opacity-90"
              >
                Browse verified apps
                <ArrowRight className="size-4" />
              </a>
              <a
                href="https://docs.phala.com/phala-cloud/attestation/trust-center-verification"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-[4px] border border-border bg-card px-5 text-[15px] font-medium text-foreground transition hover:bg-muted"
              >
                Read docs
              </a>
            </div>
          </div>

          {/* Right: dark trust-path command panel */}
          <div className="flex items-stretch bg-[var(--surface-trust-path)] text-white">
            <div className="flex w-full flex-col">
              <div className="flex items-center justify-between border-white/10 border-b px-5 py-3">
                <div className="flex items-center gap-2 font-mono text-[12px] text-white/60">
                  <Terminal className="size-4 text-primary" />
                  <span>verify</span>
                </div>
                <span className="inline-flex items-center gap-2 font-mono text-[12px] text-white/45">
                  copy
                  <Copy className="size-4" />
                </span>
              </div>
              <div className="flex-1 space-y-3 p-6 font-mono text-[13px] leading-6">
                {COMMAND_LINES.map((line, i) => (
                  <p key={line} className="break-words text-white/85">
                    {i === 0 && <span className="text-primary">$ </span>}
                    {i > 0 && <span className="text-white/30">  </span>}
                    {line.replace(/^/, '')}
                  </p>
                ))}
                <p className="pt-4 text-white/60">{RESULT_LINE}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
