'use client'

/**
 * Hero mockup with two switchable views:
 *
 *   1. "Certificate" — cream App panel + phala-blue Verification dimensions
 *      panel (adapted from website-nextjs's PlatformFeatureSwitch "Open" tab,
 *      src/app/(main)/art-direction-demo/demo-interactions.tsx).
 *
 *   2. "Proof graph" — Trust Center proof-graph mockup (adapted from
 *      website-nextjs's dstack page TrustCenterVisual,
 *      src/app/(main)/dstack/sections/feature-section.tsx ~L310).
 *
 * Switch lives in a small toggle at the bottom-right corner of the mockup
 * shell so the visual stays the focus.
 */

import {useState} from 'react'

import {cn} from '@/lib/utils'

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
  ['5/5', 'phases'],
  ['98', 'score'],
  ['1', 'pending'],
]

const PIPS = [true, true, true, true, true] as const

const PROOF_NODES: Array<readonly [string, string, string]> = [
  ['Gateway', 'tls_endpoint', 'left-[7%] top-[42%] border-phala-blue-300'],
  ['Code', 'compose_hash', 'left-[22%] top-[14%] border-phala-blue-300'],
  ['OS Image', 'rtmr0..3', 'left-[40%] top-[56%] border-phala-blue-300'],
  ['KMS', 'app_key', 'left-[60%] top-[20%] border-primary'],
  ['Logs', 'event_log', 'left-[72%] top-[52%] border-primary'],
]

type View = 'certificate' | 'graph'

export function HeroMockup() {
  const [view, setView] = useState<View>('certificate')

  return (
    <div className="relative h-[460px] w-full overflow-hidden border border-base-1000/15 bg-card md:h-[480px]">
      {view === 'certificate' ? <CertificateView /> : <GraphView />}

      {/* View toggle — bottom-right pill */}
      <div className="pointer-events-auto absolute right-3 bottom-3 inline-flex items-center gap-px rounded-[4px] border border-base-1000/15 bg-card/95 p-0.5 backdrop-blur">
        <button
          type="button"
          onClick={() => setView('certificate')}
          className={cn(
            'rounded-[2px] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[.14em] transition-colors',
            view === 'certificate'
              ? 'bg-base-1000 text-base-50'
              : 'text-base-700 hover:text-base-1000',
          )}
        >
          Certificate
        </button>
        <button
          type="button"
          onClick={() => setView('graph')}
          className={cn(
            'rounded-[2px] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[.14em] transition-colors',
            view === 'graph'
              ? 'bg-base-1000 text-base-50'
              : 'text-base-700 hover:text-base-1000',
          )}
        >
          Proof graph
        </button>
      </div>
    </div>
  )
}

function CertificateView() {
  return (
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
              <span className="truncate font-mono text-base-1000">{value}</span>
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
                className={complete ? 'h-3 bg-primary' : 'h-3 bg-base-1000/12'}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right — Verification dimensions (phala-blue tint, refined) */}
      <div className="relative flex min-h-0 flex-col overflow-hidden bg-phala-blue-50 p-5">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-[11px] uppercase tracking-[.14em] text-base-700">
            Verification dimensions
          </p>
          <p className="font-mono text-[10px] text-base-500">
            attestation.json
          </p>
        </div>

        {/* Stat tiles — bigger numbers, mono labels, hairline border */}
        <div className="mt-3 grid grid-cols-3 gap-px border border-base-1000/10 bg-base-1000/10">
          {STAT_TILES.map(([value, label]) => (
            <div
              key={label}
              className="flex h-[72px] flex-col items-center justify-center gap-1 bg-white px-3"
            >
              <p className="font-display text-[28px] leading-none text-base-1000 tabular-nums">
                {value}
              </p>
              <p className="font-mono text-[9px] uppercase tracking-[.14em] text-base-500">
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Dimension bars — 4-col grid: label · bar · pct · status pip */}
        <div className="mt-4 grid min-h-0 flex-1 content-start gap-1.5">
          {DIMENSIONS.map(([label, value]) => {
            const isFull = value >= 100
            return (
              <div
                key={label}
                className="grid h-[28px] grid-cols-[110px_1fr_28px_8px] items-center gap-3 bg-white px-3"
              >
                <span className="font-mono text-[10px] uppercase tracking-wider text-base-700">
                  {label}
                </span>
                <span className="block h-1.5 overflow-hidden bg-base-1000/10">
                  <span
                    className={cn(
                      'block h-full',
                      isFull ? 'bg-primary' : 'bg-phala-blue-400',
                    )}
                    style={{width: `${value}%`}}
                  />
                </span>
                <span
                  className={cn(
                    'text-right font-mono text-[10px] tabular-nums',
                    isFull ? 'text-[#5e8a00]' : 'text-base-700',
                  )}
                >
                  {value}
                </span>
                <span
                  className={cn(
                    'size-2 rounded-full',
                    isFull ? 'bg-primary' : 'bg-phala-blue-400',
                  )}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function GraphView() {
  return (
    <div className="grid h-full grid-cols-1 gap-px bg-border lg:grid-cols-[0.42fr_0.58fr]">
      {/* Left — proof description */}
      <div className="flex min-h-0 flex-col bg-card p-5">
        <p className="font-mono text-[11px] uppercase tracking-[.14em] text-muted-foreground">
          Trust Center
        </p>
        <h3 className="mt-3 font-display text-[26px] leading-[1.04] text-foreground">
          Inspectable proof graph.
        </h3>
        <p className="mt-3 text-[13px] leading-6 text-muted-foreground">
          Evidence objects connect the workload, source, image, event logs,
          hardware quote, KMS path, and gateway endpoint.
        </p>

        <div className="mt-auto border border-border bg-[var(--surface-marketing)] p-4 font-mono text-[11px]">
          <p className="uppercase tracking-wider text-muted-foreground">
            Selected proof
          </p>
          <p className="mt-2 font-display text-[18px] leading-tight text-foreground">
            Gateway attestation
          </p>
          <div className="mt-3 grid gap-1 text-muted-foreground">
            <p>
              <span className="text-foreground/40">status</span> verified
            </p>
            <p>
              <span className="text-foreground/40">report</span> intel_quote
            </p>
            <p>
              <span className="text-foreground/40">receipt</span>{' '}
              gateway_app_id
            </p>
          </div>
        </div>
      </div>

      {/* Right — graph canvas */}
      <div className="relative min-h-[300px] overflow-hidden bg-[var(--surface-marketing-light)] md:min-h-full">
        {/* dotted bg */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(17,20,18,.18)_1px,transparent_1px)] bg-[size:18px_18px]" />

        {/* connector paths */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 560 420"
          aria-hidden="true"
        >
          <path
            d="M95 210 C180 120 265 122 340 205 S440 260 492 185"
            fill="none"
            stroke="rgba(17,20,18,.3)"
            strokeWidth="2"
            strokeDasharray="6 8"
          />
          <path
            d="M148 84 C200 158 200 260 274 300 S412 290 450 110"
            fill="none"
            stroke="rgba(17,20,18,.22)"
            strokeWidth="2"
            strokeDasharray="6 8"
          />
          <path
            d="M286 202 C340 190 402 208 456 256"
            fill="none"
            stroke="oklch(0.8962 0.1971 123.29)"
            strokeWidth="4"
          />
        </svg>

        {/* floating evidence cards */}
        {PROOF_NODES.map(([title, detail, position]) => (
          <div
            key={title}
            className={cn(
              'absolute w-32 border-2 bg-card p-3 shadow-sm',
              position,
            )}
          >
            <p className="text-[14px] leading-none text-foreground">{title}</p>
            <p className="mt-2.5 font-mono text-[10px] text-muted-foreground">
              {detail}
            </p>
            <p className="mt-2.5 border-border border-t pt-2 font-mono text-[10px] text-emerald-700">
              linked
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
