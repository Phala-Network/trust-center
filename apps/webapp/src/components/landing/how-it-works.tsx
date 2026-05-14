import {Cpu, FileCheck, ShieldCheck} from 'lucide-react'

const STEPS = [
  {
    eyebrow: '01 · Hardware',
    title: 'Quote, validated.',
    body: 'Intel TDX/SGX quotes plus NVIDIA GPU CC attestation, verified against the manufacturer root CAs with DCAP-QVL.',
    icon: Cpu,
  },
  {
    eyebrow: '02 · OS + Source',
    title: 'Measurements match.',
    body: 'MRTD and RTMR0–2 reproduced from the released dstack image. RTMR3 yields the compose-hash, checked against the on-chain registry.',
    icon: ShieldCheck,
  },
  {
    eyebrow: '03 · Receipt',
    title: 'Verifiable proof.',
    body: 'Every check lands as a signed data object — replayable offline, embeddable as a widget, citable by hash.',
    icon: FileCheck,
  },
]

export function HowItWorks() {
  return (
    <section className="border-border border-y bg-background py-16 md:py-24">
      <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-12">
        <div className="mb-10 max-w-2xl md:mb-14">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[.14em] text-muted-foreground">
            How verification works
          </p>
          <h2 className="font-display text-[clamp(30px,2.8vw,46px)] leading-[1.08] text-foreground">
            Four phases, three entities, one receipt.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground md:text-lg">
            Trust Center walks every Phala Cloud app through the same chain —
            App, KMS, and Gateway — and emits a structured proof of what was
            checked.
          </p>
        </div>

        <div className="grid gap-px border border-border bg-border md:grid-cols-3">
          {STEPS.map((step) => {
            const Icon = step.icon
            return (
              <div
                key={step.eyebrow}
                className="group flex flex-col gap-4 bg-card p-6 transition-colors hover:bg-muted/40"
              >
                <Icon className="size-6 text-muted-foreground transition-colors group-hover:text-primary-700 dark:group-hover:text-primary" />
                <p className="font-mono text-[11px] uppercase tracking-[.14em] text-muted-foreground">
                  {step.eyebrow}
                </p>
                <h3 className="font-display text-[24px] leading-[1.1] text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm leading-6 text-muted-foreground">
                  {step.body}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
