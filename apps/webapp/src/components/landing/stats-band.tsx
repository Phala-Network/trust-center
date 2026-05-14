import {getLandingStats} from '@/lib/db'

const COMPACT = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export async function StatsBand() {
  const stats = await getLandingStats()

  const cells = [
    {
      eyebrow: 'Apps verified',
      value: COMPACT.format(stats.verifiedApps),
      hint: 'Public dstack apps with at least one completed verification.',
    },
    {
      eyebrow: 'Tasks completed',
      value: COMPACT.format(stats.completedTasks),
      hint: 'Hardware + OS + source-code + zero-trust check runs.',
    },
    {
      eyebrow: 'dstack versions',
      value: stats.dstackVersions.toString(),
      hint: 'Distinct dstack OS releases observed across verified apps.',
    },
  ]

  return (
    <section className="border-border border-b bg-[var(--surface-marketing)] py-16 md:py-20 dark:bg-card">
      <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-12">
        <div className="mb-10 max-w-2xl">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[.14em] text-muted-foreground">
            Live counters
          </p>
          <h2 className="font-display text-[clamp(28px,2.4vw,40px)] leading-[1.08] text-foreground">
            Verifications, in numbers.
          </h2>
        </div>

        <div className="grid gap-px border border-border bg-border md:grid-cols-3">
          {cells.map((cell) => (
            <div key={cell.eyebrow} className="bg-card p-6 md:p-8">
              <p className="font-mono text-[11px] uppercase tracking-[.14em] text-muted-foreground">
                {cell.eyebrow}
              </p>
              <p className="mt-3 font-display text-[clamp(40px,5vw,68px)] leading-none text-foreground tabular-nums">
                {cell.value}
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {cell.hint}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
