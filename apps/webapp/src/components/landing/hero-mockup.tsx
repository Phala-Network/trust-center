/**
 * Static hero mockup — adapted from the "Open" tab of website-nextjs's
 * PlatformFeatureSwitch (src/app/(main)/art-direction-demo/demo-interactions.tsx).
 * Trust Center's own visual language: cream app panel + phala-blue verification
 * dimensions panel. Server-rendered, no client state.
 */

const DIMENSIONS: Array<readonly [string, number]> = [
  ['Hardware lock', 100],
  ['OS measurement', 100],
  ['Code proof', 100],
  ['Domain trust', 92],
  ['Registry match', 96],
]

const META: Array<readonly [string, string]> = [
  ['app id', '0x530f…7bd8'],
  ['gateway', 'gateway.phala.network'],
  ['report', 'attestation.json'],
]

const STAT_TILES: Array<readonly [string, string]> = [
  ['5/5', 'phases verified'],
  ['98', 'trust score'],
  ['1', 'pending CT log'],
]

const PIPS = [true, true, true, true, true] as const

export function HeroMockup() {
  return (
    <div className="h-[460px] w-full overflow-hidden border border-base-1000/15 bg-card shadow-none md:h-[480px]">
      <div className="grid h-full grid-cols-1 gap-px bg-border lg:grid-cols-[260px_1fr]">
        {/* Left — App panel (cream / primary tint) */}
        <div className="flex min-h-0 flex-col bg-[var(--cream)] p-5">
          <p className="font-mono text-[11px] uppercase tracking-[.14em] text-base-500">
            App
          </p>
          <p className="mt-2 font-display text-[22px] leading-tight text-base-1000">
            DeepSeek V3.1 · TEE Inference
          </p>

          <div className="mt-5 grid gap-2 border-base-1000/10 border-t pt-4">
            {META.map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-[72px_1fr] gap-3 text-[12px]"
              >
                <span className="font-mono uppercase tracking-wider text-base-500">
                  {label}
                </span>
                <span className="truncate font-mono text-base-1000">
                  {value}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-auto">
            <div className="mb-3 flex items-end justify-between gap-4">
              <span className="font-mono text-[11px] uppercase tracking-[.14em] text-base-500">
                Trust score
              </span>
              <span className="font-display text-[42px] leading-none text-base-1000 tabular-nums">
                98
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {PIPS.map((complete, index) => (
                <span
                  key={index}
                  className={
                    complete ? 'h-3 bg-primary' : 'h-3 bg-base-1000/12'
                  }
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right — Verification dimensions (phala-blue tint) */}
        <div className="relative flex min-h-0 flex-col overflow-hidden bg-phala-blue-50 p-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[13px] font-medium text-base-700">
              Verification dimensions
            </p>
            <p className="font-mono text-[11px] text-base-500">
              attestation.json
            </p>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[12px]">
            {STAT_TILES.map(([value, label]) => (
              <div
                key={label}
                className="flex h-[68px] flex-col items-center justify-center bg-white/80 px-3"
              >
                <p className="font-display text-[24px] leading-none text-base-1000 tabular-nums">
                  {value}
                </p>
                <p className="mt-1 font-mono uppercase tracking-wider text-base-500">
                  {label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid min-h-0 flex-1 content-start gap-2">
            {DIMENSIONS.map(([label, value]) => (
              <div
                key={label}
                className="grid h-[34px] grid-cols-[120px_1fr_36px] items-center gap-3 bg-white/75 px-3 text-[11px]"
              >
                <span className="leading-tight text-base-700">{label}</span>
                <span className="block h-2 overflow-hidden bg-base-1000/10">
                  <span
                    className="block h-full bg-primary"
                    style={{width: `${value}%`}}
                  />
                </span>
                <span
                  className={
                    value >= 95
                      ? 'text-right font-mono tabular-nums text-[#7aaa00]'
                      : 'text-right font-mono tabular-nums text-base-500'
                  }
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
