/**
 * Per-app avatar classification — ported from phala-cloud-monorepo's
 * `teehouse-ui/src/components/entity-avatar.tsx` (PR #1380), trimmed to the
 * pieces relevant to trust-center.
 *
 * Three steps:
 *   1. Classify the app name into a semantic category via regex patterns.
 *   2. Each category has a fixed lucide icon (BrainCircuit for ai, Cpu for
 *      gpu, ShieldCheck for tee, etc.).
 *   3. Each category has a fixed tone slot (color tint) from AVATAR_TONES.
 *
 * Brand-logo asset matching from the cloud version is omitted — the ~80
 * Slack / Notion / Cal.com / etc. logos are agent-app oriented and almost
 * never appear in dstack apps surfaced by trust-center.
 */

import {
  Bitcoin,
  Bot,
  Boxes,
  BrainCircuit,
  Code2,
  Cpu,
  Database,
  DollarSign,
  FlaskConical,
  Globe,
  type LucideIcon,
  Network,
  Server,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react'

export type AppAvatarCategory =
  | 'ai'
  | 'agent'
  | 'mcp'
  | 'api'
  | 'web'
  | 'data'
  | 'tee'
  | 'finance'
  | 'web3'
  | 'gpu'
  | 'test'
  | 'generated'
  | 'code'
  | 'product'

// Tone palette — one slot per category (some categories share a slot).
// Picked to render OK on both light and dark canvases.
export const AVATAR_TONES = [
  'border-emerald-200 bg-emerald-100 text-emerald-900', // 0
  'border-sky-200 bg-sky-100 text-sky-900', // 1
  'border-violet-200 bg-violet-100 text-violet-900', // 2
  'border-amber-200 bg-amber-100 text-amber-950', // 3
  'border-rose-200 bg-rose-100 text-rose-900', // 4
  'border-cyan-200 bg-cyan-100 text-cyan-900', // 5
  'border-lime-200 bg-lime-100 text-lime-950', // 6
  'border-indigo-200 bg-indigo-100 text-indigo-900', // 7
  'border-orange-200 bg-orange-100 text-orange-950', // 8
  'border-fuchsia-200 bg-fuchsia-100 text-fuchsia-900', // 9
  'border-teal-200 bg-teal-100 text-teal-900', // 10
  'border-slate-200 bg-slate-100 text-slate-900', // 11
] as const

const APP_CATEGORY_ICONS: Record<AppAvatarCategory, LucideIcon> = {
  ai: BrainCircuit,
  agent: Bot,
  mcp: Network,
  api: Server,
  web: Globe,
  data: Database,
  tee: ShieldCheck,
  finance: DollarSign,
  web3: Bitcoin, // blockchain / crypto / on-chain — Bitcoin glyph is the universally recognized "this is crypto" mark
  gpu: Cpu,
  test: FlaskConical,
  generated: Boxes,
  code: Code2,
  product: Sparkles,
}

const APP_CATEGORY_TONE_INDEX: Record<AppAvatarCategory, number> = {
  ai: 2,
  agent: 5,
  mcp: 9,
  api: 1,
  web: 6,
  data: 7,
  tee: 0,
  finance: 8,
  web3: 8,
  gpu: 10,
  test: 3,
  generated: 11,
  code: 4,
  product: 0,
}

// Order matters — first matching pattern wins. `generated` is checked first
// so that placeholder ids (dstack-app-*, UUID-named, etc.) get the neutral
// "generic box" treatment instead of getting accidentally classified by a
// later regex matching a substring of the random id.
const APP_CATEGORY_RULES: Array<{
  category: AppAvatarCategory
  pattern: RegExp
}> = [
  {
    category: 'generated',
    pattern:
      /^(dstack-app|app-|phala-app|tf-smoke|untitled|new-app)(?:\b|[-_])|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\b|[-_])/i,
  },
  {
    category: 'gpu',
    pattern:
      /\b(gpu|cuda|nvidia|h100|h200|h300|b200|b300|pytorch|jupyter|notebook|training|vllm-gpu)\b/i,
  },
  {
    category: 'ai',
    pattern:
      /\b(ai|llm|model|vllm|ollama|openai|gpt|claude|deepseek|qwen|llama|mistral|gemini|chat|inference|comfy|stable-diffusion|sdxl|rag)\b/i,
  },
  {
    category: 'agent',
    pattern:
      /\b(agent|bot|assistant|automation|worker|crawler|scraper|executor|keeper|eliza|n8n|openclaw|hermes)\b/i,
  },
  {
    category: 'mcp',
    pattern: /\b(mcp|context7|figma|browser|tool|server-list)\b/i,
  },
  {
    category: 'tee',
    pattern: /\b(tee|tdx|kms|attest|attestation|shield|phala|dstack|shade|signer)\b/i,
  },
  {
    // Blockchain / crypto comes BEFORE finance so coin/chain names get the
    // Bitcoin icon instead of the generic dollar.
    category: 'web3',
    pattern:
      /\b(bitcoin|btc|ethereum|eth|evm|solana|sol|polkadot|dot|cosmos|atom|avalanche|avax|polygon|matic|cardano|ada|doge|shib|ltc|xrp|usdc|usdt|dai|tron|trx|near|aptos|sui|chain|onchain|on-chain|oracle|zk|rollup|bridge|nft|dao|fhe|crypto|web3|blockchain)\b/i,
  },
  {
    category: 'finance',
    pattern:
      /\b(wallet|financial|finance|fintech|defi|payment|payments|pay|trading|trade|exchange|dex|yield|vault|treasury|asset|assets|token|tokens)\b/i,
  },
  {
    category: 'api',
    pattern: /\b(api|backend|server|service|gateway|proxy|endpoint|rpc|grpc|rest)\b/i,
  },
  {
    category: 'data',
    pattern:
      /\b(db|database|postgres|postgresql|redis|mongo|mongodb|indexer|etl|pipeline|data|analytics|warehouse)\b/i,
  },
  {
    category: 'web',
    pattern:
      /\b(web|site|frontend|front-end|next|nextjs|react|vite|dashboard|portal|landing|ui|webui)\b/i,
  },
  {
    category: 'test',
    pattern:
      /\b(test(?:ing|y)?|smoke|demo|example|trial|sandbox|temp|debug|qa|dev|staging|stage|preview)\b/i,
  },
  {
    category: 'code',
    pattern: /\b(code|repo|github|gitlab|ci|builder|compiler|runtime)\b/i,
  },
]

export function classifyAppAvatar(name: string): AppAvatarCategory {
  const normalized = name.trim()
  for (const rule of APP_CATEGORY_RULES) {
    if (rule.pattern.test(normalized)) return rule.category
  }
  return 'product'
}

export function getAppAvatarIcon(category: AppAvatarCategory): LucideIcon {
  return APP_CATEGORY_ICONS[category] ?? Wrench
}

export function getAppAvatarToneClass(name: string): string {
  const category = classifyAppAvatar(name)
  return AVATAR_TONES[APP_CATEGORY_TONE_INDEX[category] ?? 11]
}
