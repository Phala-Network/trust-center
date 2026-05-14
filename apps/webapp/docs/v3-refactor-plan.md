# Trust Center — v3 Design Refactor Plan

> Adopt Phala v3 design system (from `website-nextjs`) into the trust-center webapp.
> Source of truth: `/Users/marvin/website-nextjs/docs/design-system/` and `/Users/marvin/website-nextjs/src/app/theme/`.

## Survey

### Trust-center webapp today
Next.js 16 + Tailwind v4 + shadcn/ui + `@xyflow/react`. Three surface tiers:

| Surface | Files | Notes |
|---|---|---|
| Landing | `src/app/page.tsx` (77 LOC), `src/components/hero.tsx` (157 LOC), `user-gallery.tsx`, `src/app/_components/home-client.tsx` | `<PhalaNavbar/>` (906 LOC, already lifted from website) + Hero (split: text/CTA left, `CompactReportWidget` preview right with fade gradient) + featured builders 6-col avatar grid + verified-apps list with filters |
| App detail | `src/app/app/[app-id]/...`, `/widget/...`, `/embed/...`; `<AppLayout/>` orchestrates `<Header/>` + `<Panels/>` (resizable `report-view` / `values-view` / `nodes-view`) | The `CompactReportWidget` is the central artifact — **do not redesign** in this pass; let v3 tokens flow through |
| Footer | `src/components/footer.tsx` (7 LOC: "Developed by the Phala team") | Needs full v3 rebuild |

### Tokens present today (`src/app/theme/colors.css`)
- `--base-50` through `--base-1000` (OKLCH greige) ✓ matches v3
- `--primary-50` through `--primary-1000` (OKLCH lime) ✓ matches v3
- Semantic vars (`--background`, `--foreground`, `--card`, `--muted-foreground`, etc.) ✓
- Sidebar vars ✓

### Tokens missing for v3
- **`--phala-blue-*`** scale (periwinkle, secondary accent / footer wash)
- **Surface tokens**: `--surface-marketing` (`#f7f8f3`), `--surface-marketing-light` (`#fbfcf8`), `--surface-trust-path` (`#070908`), `--surface-trust-card` (`#101310`)
- `--radius` is `0.75rem` — v3 wants **`4px`** (sharp, schematic)

### Typography missing for v3
- `typography.css` is a stub — no `@font-face` for Arizona Flare or Diatype, no font cascade vars, no `font-mono` tnum/ss01 utility
- No `.lucide` global restyle (square caps, miter joins, 1.25 stroke)
- No `@tailwindcss/typography` plugin
- Per-locale Noto Serif CJK cascade — **out of scope** (trust-center is en-only)

### Website-nextjs source paths (verified)
- Theme: `src/app/theme/colors.css`, `theme/typography.css`, `app/globals.css`
- Fonts: `public/fonts/exa/{ABCArizonaFlare,ABCDiatype}-Regular.woff2`
- Landing sections: `src/app/(main)/(home)/sections/{hero,feature-showcases,logo-band,product,platform,scale,success,compliance,faq,final-cta}-section.tsx`
- Reusable building blocks: `src/components/product/marketing.tsx` (`InlineCommandButton`, `CommandPanel`, `CTAGroup`)

## Plan

### Phase 1 — Tokens & theme (foundation; all phases depend on it)

| # | Action | File |
|---|---|---|
| 1 | Replace v3 token set: keep `base-*` + `primary-*` (already correct), **add** `--phala-blue-50…900`, **add** four `--surface-*` tokens, change `--radius: 0.75rem` → `4px`. Preserve `@theme inline` block so Tailwind picks up `bg-phala-blue-100`, `bg-surface-trust-path`, etc. | `src/app/theme/colors.css` |
| 2 | Copy two woff2 fonts | `cp /Users/marvin/website-nextjs/public/fonts/exa/{ABCArizonaFlare,ABCDiatype}-Regular.woff2` → `apps/webapp/public/fonts/exa/` |
| 3 | Add `@font-face` blocks for Arizona Flare + Diatype | `src/app/globals.css` |
| 4 | Rewrite typography: declare `--v3-heading` (Arizona Flare), `--v3-body` / `--v3-ui` / `--v3-mono` (Diatype). Add `.font-display`, `.font-text`, `.font-mono` utilities. Mono utility gets `font-feature-settings: "tnum" 1, "ss01" 1` + `letter-spacing: 0.01em` | `src/app/theme/typography.css` |
| 5 | Global `.lucide` restyle (square caps, miter joins, 1.25 stroke) | `src/app/globals.css` |
| 6 | Add `@plugin "@tailwindcss/typography"`; install package if missing | `src/app/globals.css` + `apps/webapp/package.json` |

### Phase 2 — Landing page rebuild

Adopt-and-adapt these website-nextjs sections, in order:

| # | Section | Source | Adaptation |
|---|---|---|---|
| 1 | **Hero** | `src/app/(main)/(home)/sections/hero-section.tsx` | Keep our differentiator: right-side `WidgetPreview` with `CompactReportWidget`. Restyle left column: eyebrow (`font-mono uppercase tracking-[.08em]` "TRUST CENTER · LIVE"), Arizona Flare h1 at `clamp(38, 5vw, 68px)` weight 400 (e.g. *"Verify any TEE app, instantly."*), subtitle, CTA pair (primary lime "Start verifying" + outline "Read docs"). Sharp corners on widget container — drop `rounded-xl`/`rounded-md` |
| 2 | **How verification works** | `feature-showcases.tsx` | New `src/components/landing/how-it-works.tsx`. 3 hairline-grid tiles: Hardware attestation (Intel TDX/SGX + GPU CC) → OS + source (RTMR0-3 + compose-hash) → Receipt (verifiable proof). Eyebrow + Arizona Flare title + Diatype body + lucide icon per tile |
| 3 | **Verified apps gallery** | (in-house) | Restyle existing `<UserGallery/>` and verified-apps list as v3 hairline grid (`gap-px bg-border` + `bg-card` cells, no shadows, sharp corners). Drop `hover:shadow-lg` → `hover:border-primary-700` |
| 4 | **Stats band** | `scale-section.tsx` | New `src/components/landing/stats-band.tsx`. 3 metrics in hairline grid: total apps verified, total tasks completed, supported dstack versions. Tabular numerals via `font-mono`. Skip animated counter for v1 — static numbers |
| 5 | **Final CTA** | `final-cta-section.tsx` + `CommandPanel` from `marketing.tsx` | New `src/components/landing/final-cta.tsx`. Dark trust-path band (`bg-[#070908]`), left = "Verify your own app." + `CTAGroup`, right = `CommandPanel`-style mockup with a verification CLI / curl example |

Files to add: `src/components/landing/{hero-v3, how-it-works, stats-band, final-cta}.tsx`. Update `src/app/page.tsx` to orchestrate. Replace `src/components/hero.tsx` (or wire new `hero-v3.tsx`).

### Phase 3 — Footer rebuild

Replace `src/components/footer.tsx` (7 LOC → v3 footer): phala-blue tinted (`bg-phala-blue-100` outer wash, `bg-phala-blue-50` cells, `border-phala-blue-300` gutters). Trust-center-specific columns:

- **Verify** — Browse apps · Submit verification · Docs
- **Build** — Phala Cloud · dstack
- **Proof** — How it works · Open-source repo
- **Company** — Phala.network · Contact

Bottom row: copyright, `live` status pill, social icons. Don't lift website's full footer wholesale — too many marketing links irrelevant to trust-center.

### Phase 4 — Existing component restyle (no rebuilds)

| File | Change |
|---|---|
| `src/components/header.tsx` | Buttons → `rounded-[4px]`. Mode-switch chips → `font-mono uppercase tracking-wider` |
| `src/components/app-logo.tsx` | `rounded-lg` → `rounded-[4px]` (or `rounded-none` for in-widget use to match website) |
| `src/components/user-gallery.tsx` | Drop `hover:shadow-lg`, use `hover:border-primary-700` color shift |
| `src/components/app-filters.tsx` | Buttons + checkbox container → `rounded-[4px]` |
| `src/components/visualization/compact-report-widget.tsx` + `report-components.tsx` | Minimal pass — let v3 tokens flow through, do not redesign internal widget layout |
| `src/components/footer.tsx` | (Phase 3) |
| `src/components/navbar.tsx` | No edits — already lifted from website, will pick up new tokens automatically |

### Phase 5 — Verify

1. `bun run typecheck` (root + webapp)
2. `bun run dev` in `apps/webapp`, open `http://trust-center.localhost:3000`
3. Walk: landing → app detail → widget → embed; confirm no regressions
4. Optional `/design-review` pass

### Phase 6 — App-detail workspace pass (post-survey cleanup)

Survey on the `/app/[app-id]` surface found ~10 raw palette violations, gradient elevation, and card/canvas color collision. Workspace surface gets a "trust-path" voice (dark canvas) which differentiates it from the marketing landing and matches v3's `--surface-trust-path` reservation for proof / Sign-RPC sections.

| # | Surface | Change |
|---|---|---|
| 1 | `app-layout.tsx`, `embed-layout.tsx` | Wrap root in `dark` scope on `bg-[var(--surface-trust-path)]` so the workspace renders in dark voice; landing stays light. `widget/...` embed page already supports `darkMode` config override, leave it. |
| 2 | `compact-report-widget.tsx`, `report-components.tsx` | Outer card swaps `bg-card` → `bg-[var(--surface-trust-card)]` so cards sit on (slightly darker) `trust-path` canvas with intentional contrast. Drop `TopBranding` gradient (`bg-gradient-to-br from-muted/40 to-muted/20`) → flat `bg-card` + hairline border. |
| 3 | `report-components.tsx`, `collapsible-report-item-card.tsx` | Verified-state recolor: `text-emerald-{600,400,300,700}` / `bg-emerald-{50,100,950,900}` / `border-emerald-{300,800}` → `text-primary-700 dark:text-primary` / `bg-primary/10` / `border-primary/30`. Lime IS the v3 verified state. |
| 4 | `values-view.tsx` | Link colors: `text-blue-600` / `hover:text-blue-800` → `text-phala-blue-500 dark:text-phala-blue-300` / `hover:text-foreground`. `bg-gray-50` → `bg-muted/50`. |
| 5 | `nodes/object-node.tsx` | Categorical palette: gateway `border-blue-300` → `border-phala-blue-300`; kms `border-green-300` → `border-base-400`; app `border-purple-300` → `border-base-800` (kills the dead `phala-purple` color); highlighted `border-yellow-300 ring-yellow-300 shadow-lg` → `border-primary ring-2 ring-primary/30` (no shadow); default `border-gray-200` → `border-border`. |
| 6 | Across visualization | Sharp-corner pass: `rounded-lg` (avatars, top-branding fallback) → `rounded-[4px]`; `rounded-md` (object-node body, header dropdown) → `0`; `rounded-full` on status pill → `rounded-[4px]` v3 pattern with `font-mono uppercase tracking-wider`; bare `rounded` on JSON / cURL pre blocks → `rounded-[4px]`. |
| 7 | `report-components.tsx` ReportHeader | `<h1 className="text-lg font-semibold tracking-tight">` → `font-display` weight 400 at appropriate size (v3 contrast = scale, not heaviness). |
| 8 | `nodes/layout-flow.tsx` | ReactFlow `<Controls/>` + `<Background/>` reskin: dotted background in `--border` color; Controls hairlined to match v3, font-mono labels. |
| 9 | Verify | Re-walk app detail + widget + embed pages, confirm dark canvas + card separation reads, contrast checks pass on verified state. |



- ASCII anime scenes (`CvmCubeAnime`, `RaTlsPulseAnime`, etc.) — overkill for trust-center landing v1; revisit later
- Noto Serif CJK locale cascade — trust-center is en-only currently
- `CompactReportWidget` interior redesign — central UI artifact, leave structural; just inherit v3 tokens
- Navbar restyle — already lifted, picks up new tokens via CSS vars
- Custom domain icons (`CvmIcon`, `KmsIcon`, etc.) from website — only adopt if a landing tile needs one

## Risks & decisions

- **Radius change** (`0.75rem` → `4px`): every shadcn primitive (Dialog, Select, Popover, Card) gets sharper corners automatically. This is intentional — it's the v3 "schematic" voice. If any specific surface looks broken, override locally with `rounded-[8px]` rather than reverting the global.
- **Hero copy** "Verify any TEE app, instantly." is a placeholder — verify with marketing voice before merging.
- **Stats band** needs DB query — extend `src/lib/db.ts` with `getLandingStats()` returning `{ totalApps, totalCompletedTasks, dstackVersionCount }`. Cache aggressively (30s).
- **Phala-blue footer** is a 2026 v3 pattern; if `--phala-blue-*` tokens land but footer ships later, footer.tsx temporarily stays minimal — that's fine.

## Execution

Tasks are tracked in the harness task list (`TaskList`). Execute in phase order: 1 → 2 → 3 → 4 → 5. Mark each task `in_progress` before starting, `completed` only when verified working.
