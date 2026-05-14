'use client'

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  Bot,
  Boxes,
  Briefcase,
  Building2,
  Cloud,
  Code2,
  Compass,
  Cpu,
  Database,
  ExternalLink,
  FileCode2,
  GitCompare,
  Github,
  Gpu,
  Handshake,
  History,
  LayoutTemplate,
  Library,
  Menu,
  MessageSquareCode,
  Network,
  Newspaper,
  Rocket,
  Scale,
  SearchCheck,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wallet,
  X,
} from 'lucide-react'
import type {ComponentType} from 'react'
import {useState} from 'react'

import {Button} from '@/components/ui/button'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu'
import {cn} from '@/lib/utils'

type MenuIcon = ComponentType<{className?: string; strokeWidth?: number}>

type MenuLinkItem = {
  title: string
  href: string
  icon?: MenuIcon
  description?: string
  eyebrow?: string
  children?: Array<{title: string; href: string}>
}

type MenuGroup = {
  title: string
  items: MenuLinkItem[]
}

type FeaturedMenuItem = {
  eyebrow: string
  title: string
  copy: string
  href: string
  cta: string
  command?: string
  dark?: boolean
}

type MegaMenuConfig = {
  key: 'products' | 'solutions' | 'developers' | 'resources' | 'about'
  label: string
  featured: FeaturedMenuItem
  groups: MenuGroup[]
}

const isTrustCenterLink = (href: string) =>
  href.startsWith('https://trust.phala.com')
const toExternalHref = (href: string) => {
  if (href.startsWith('http')) return href
  if (href === '/') return 'https://phala.com/'
  return `https://phala.com${href}`
}
const shouldOpenExternally = (href: string) =>
  href.startsWith('http') && !isTrustCenterLink(href)

const productsMenu: MegaMenuConfig = {
  key: 'products',
  label: 'Products',
  featured: {
    eyebrow: 'Featured product',
    title: 'Phala Cloud',
    copy: 'Run agents, apps, and GPU jobs inside hardware-backed TEEs. Keep secrets private and prove what ran.',
    href: 'https://cloud.phala.com',
    cta: 'Start building',
    command: 'phala deploy',
    dark: true,
  },
  groups: [
    {
      title: 'Core Products',
      items: [
        {
          title: 'Confidential VM',
          description: 'Run Docker in a confidential VM.',
          href: '/confidential-vm',
          icon: Server,
        },
        {
          title: 'GPU TEE',
          description: 'Confidential GPU capacity with proof.',
          href: '/gpu-tee',
          icon: Gpu,
        },
        {
          title: 'Confidential AI Models',
          description: 'Private model calls with verifiable results.',
          href: '/confidential-ai-models',
          icon: Sparkles,
        },
        {
          title: 'dstack',
          description: 'Open-source TEE infrastructure.',
          href: '/dstack',
          icon: Boxes,
        },
      ],
    },
    {
      title: 'GPU TEE',
      items: [
        {
          title: 'GPU Marketplace',
          description: 'TEE-ready GPU capacity for AI builders.',
          href: '/gpu-tee',
          icon: Gpu,
        },
        {
          title: 'H100',
          description: 'Trial machines for private AI.',
          href: '/gpu-tee/h100',
          icon: Gpu,
        },
        {
          title: 'H200',
          description: 'High-memory slots for larger models.',
          href: '/gpu-tee/h200',
          icon: Cpu,
        },
        {
          title: 'B300',
          description: 'Blackwell Ultra for confidential AI.',
          href: '/gpu-tee/b300',
          icon: Gpu,
        },
      ],
    },
  ],
}

const solutionsMenu: MegaMenuConfig = {
  key: 'solutions',
  label: 'Solutions',
  featured: {
    eyebrow: 'Confidential AI Models',
    title: 'Private LLM inference, verifiable.',
    copy: 'OpenAI-compatible API into a fleet of attested model CVMs. Signed receipt per response, no logs by construction.',
    href: '/confidential-ai-models',
    cta: 'Explore confidential AI',
    command: 'curl api.redpill.ai',
    dark: true,
  },
  groups: [
    {
      title: 'By Workload',
      items: [
        {
          title: 'AI Agents',
          description: 'Agents with sealed keys and tools.',
          href: '/solutions/ai-agents',
          icon: Bot,
        },
        {
          title: 'Private AI Inference',
          description: 'Private prompts with verifiable output.',
          href: '/solutions/private-ai-inference',
          icon: MessageSquareCode,
        },
        {
          title: 'Private AI Training',
          description: 'Fine-tune without exposing data.',
          href: '/solutions/private-training',
          icon: Cpu,
        },
        {
          title: 'Private AI Data',
          description: 'Secure data access for AI workloads.',
          href: '/solutions/private-ai-data',
          icon: Database,
        },
      ],
    },
    {
      title: 'Compare Clouds',
      items: [
        {
          title: 'Phala vs AWS Nitro',
          description: 'Public proof beyond one AWS account.',
          href: '/compare/phala-vs-aws-nitro',
          icon: Server,
        },
        {
          title: 'Phala vs GCP Confidential VM',
          description: 'Portable proof outside the cloud account.',
          href: '/compare/phala-vs-gcp',
          icon: Cloud,
        },
        {
          title: 'Phala vs Tinfoil',
          description: 'Compare private AI trust boundaries.',
          href: '/compare/phala-vs-tinfoil',
          icon: GitCompare,
        },
      ],
    },
    {
      title: 'By use case',
      items: [
        {
          title: 'Financial Services',
          description: 'Risk-management AI inside compliance gates.',
          href: '/success-stories/financial-services',
          icon: Wallet,
        },
        {
          title: 'Healthcare Research',
          description: 'Multi-party trials without exposing patient data.',
          href: '/success-stories/healthcare-research',
          icon: Activity,
        },
        {
          title: 'AI SaaS Platform',
          description: 'Verifiable privacy for Fortune 500 AI buyers.',
          href: '/success-stories/ai-saas-platform',
          icon: Cloud,
        },
        {
          title: 'Decentralized AI',
          description: 'On-chain trading agents with verifiable execution.',
          href: '/success-stories/decentralized-ai',
          icon: Network,
        },
        {
          title: 'Legal AI',
          description: 'Safety-utility evaluation across 12 LLMs.',
          href: '/success-stories/legal',
          icon: Scale,
        },
        {
          title: 'All use cases',
          description: 'Browse the full industry library.',
          href: '/success-stories',
          icon: Award,
        },
      ],
    },
  ],
}

const developersMenu: MegaMenuConfig = {
  key: 'developers',
  label: 'Developers',
  featured: {
    eyebrow: 'Deploy path',
    title: '$ phala deploy',
    copy: 'Start with Docker Compose, seal secrets, deploy a CVM, and verify attestation from the command line.',
    href: 'https://docs.phala.com/',
    cta: 'Open docs',
    command: 'phala cvms attestation',
  },
  groups: [
    {
      title: 'Start',
      items: [
        {
          title: 'Docs',
          description: 'Guides and reference material.',
          href: 'https://docs.phala.com/',
          icon: BookOpen,
        },
        {
          title: 'Quickstart',
          description: 'Deploy from the Phala CLI.',
          href: 'https://docs.phala.com/phala-cloud/phala-cloud-cli/start-from-cloud-cli',
          icon: Terminal,
        },
        {
          title: 'CLI',
          description: 'Install and operate workloads.',
          href: 'https://docs.phala.com/phala-cloud/phala-cloud-cli/overview',
          icon: Code2,
        },
        {
          title: 'Templates',
          description: 'Start from working examples.',
          href: 'https://cloud.phala.com/templates',
          icon: LayoutTemplate,
        },
      ],
    },
    {
      title: 'Build',
      items: [
        {
          title: 'Deploy CVM',
          description: 'Run Docker inside a confidential VM.',
          href: '/confidential-vm',
          icon: Server,
        },
        {
          title: 'Deploy dstack',
          description: 'Use open-source TEE infrastructure.',
          href: '/dstack',
          icon: Boxes,
        },
        {
          title: 'Run GPU TEE',
          description: 'Reserve confidential GPU capacity.',
          href: '/gpu-tee',
          icon: Gpu,
        },
        {
          title: 'Verify Attestation',
          description: 'Check what ran before trusting it.',
          href: '/trust',
          icon: SearchCheck,
        },
      ],
    },
    {
      title: 'Reference',
      items: [
        {
          title: 'API Reference',
          description: 'Build against Phala interfaces.',
          href: 'https://docs.phala.com/',
          icon: FileCode2,
        },
        {
          title: 'GitHub',
          description: 'Explore source and examples.',
          href: 'https://github.com/Phala-Network',
          icon: Github,
        },
        {
          title: 'DeepWiki',
          description: 'Read generated repo documentation.',
          href: 'https://deepwiki.com/Phala-Network',
          icon: Library,
        },
        {
          title: 'Service Status',
          description: 'Check network and cloud health.',
          href: 'https://status.phala.network/',
          icon: Activity,
        },
      ],
    },
  ],
}

const resourcesMenu: MegaMenuConfig = {
  key: 'resources',
  label: 'Resources',
  featured: {
    eyebrow: 'Read',
    title: 'Learn private AI.',
    copy: 'Guides, technical explainers, customer stories, and trust material for teams evaluating confidential compute.',
    href: '/learn',
    cta: 'Open Learn',
  },
  groups: [
    {
      title: 'Learn',
      items: [
        {
          title: 'Blog',
          description: 'Product updates and engineering notes.',
          href: '/blog',
          icon: Newspaper,
        },
        {
          title: 'Learn',
          description: 'Guides for private AI builders.',
          href: '/learn',
          icon: Compass,
        },
        {
          title: 'Tags',
          description: 'Browse topics and categories.',
          href: '/tags/Intel%20TDX',
          icon: BookOpen,
        },
        {
          title: 'By use case',
          description: 'How teams use Phala in production.',
          href: '/success-stories',
          icon: Award,
        },
      ],
    },
    {
      title: 'Proof & Security',
      items: [
        {
          title: 'Trust Center',
          description: 'Controls, evidence, and compliance.',
          href: 'https://trust.phala.com',
          icon: ShieldCheck,
        },
        {
          title: 'Security',
          description: 'Security posture and review material.',
          href: '/trust#security',
          icon: BadgeCheck,
        },
        {
          title: 'Subprocessors',
          description: 'Vendors used to operate the service.',
          href: '/trust#subprocessors',
          icon: Network,
        },
      ],
    },
    {
      title: 'For Teams',
      items: [
        {
          title: 'Startups',
          description: 'Credits and engineering help.',
          href: '/startup-program',
          icon: Rocket,
        },
        {
          title: 'Enterprise AI',
          description: 'Security review and capacity planning.',
          href: '/contact',
          icon: Building2,
        },
        {
          title: 'GPU Providers',
          description: 'Bring secure GPU capacity online.',
          href: 'https://docs.phala.com/network/compute-providers/run-GPU-on-phala/gpu-deployment-guide',
          icon: Gpu,
        },
        {
          title: 'Partnerships',
          description: 'Explore the ecosystem network.',
          href: '/partnerships',
          icon: Handshake,
        },
      ],
    },
  ],
}

const aboutMenu: MegaMenuConfig = {
  key: 'about',
  label: 'About Us',
  featured: {
    eyebrow: 'Company',
    title: 'Built for public proof.',
    copy: 'Phala builds private compute infrastructure for AI systems that need evidence outside one cloud account.',
    href: '/about',
    cta: 'Read manifest',
  },
  groups: [
    {
      title: 'Company',
      items: [
        {
          title: 'About Phala',
          description: 'Mission, team, and company story.',
          href: '/about',
          icon: Building2,
        },
        {
          title: 'Build History',
          description: 'Milestones and open-source progress.',
          href: '/about#history',
          icon: History,
        },
        {
          title: 'Contact',
          description: 'Talk with the Phala team.',
          href: '/contact',
          icon: BookOpen,
        },
      ],
    },
    {
      title: 'Network',
      items: [
        {
          title: 'Wallet, Stake, Bridge',
          description: 'Manage PHA and network actions.',
          href: 'https://app.phala.network/',
          icon: Wallet,
        },
        {
          title: 'About Phala Network',
          description: 'Read the network documentation.',
          href: 'https://docs.phala.com/network',
          icon: Network,
        },
        {
          title: 'Careers',
          description: 'Open roles and company profile.',
          href: 'https://wellfound.com/company/phala-network',
          icon: Briefcase,
        },
      ],
    },
  ],
}

const navigationMenuItems = [
  productsMenu,
  solutionsMenu,
  developersMenu,
  resourcesMenu,
  aboutMenu,
] as const

const menuShellClass =
  'w-[min(960px,calc(100vw-40px))] border border-border bg-background p-0 shadow-none'
const groupTitleClass =
  'font-mono text-[11px] uppercase leading-none tracking-[0.14em] text-muted-foreground'
const linkCardClass =
  'group block min-h-[46px] border border-transparent px-0 py-1.5 text-left transition hover:border-transparent hover:bg-transparent'

function FeaturedCard({item}: {item: FeaturedMenuItem}) {
  const href = toExternalHref(item.href)
  return (
    <NavigationMenuLink
      href={href}
      target={shouldOpenExternally(href) ? '_blank' : undefined}
      rel={shouldOpenExternally(href) ? 'noopener noreferrer' : undefined}
      className={cn(
        'group flex h-full min-h-[220px] flex-col justify-between border border-phala-blue-300 bg-phala-blue-300/35 p-5 text-foreground transition hover:bg-phala-blue-300/55 lg:min-h-[240px]',
      )}
    >
      <div>
        <p className="font-mono text-[11px] uppercase leading-none tracking-[0.14em] text-phala-blue-500">
          {item.eyebrow}
        </p>
        <h3 className="mt-5 max-w-[250px] text-[24px] leading-[1.04] text-foreground">
          {item.title}
        </h3>
        <p className="mt-4 max-w-[260px] text-[13px] leading-5 text-[#5c6059]">
          {item.copy}
        </p>
      </div>
      <div className="mt-6">
        {item.command ? (
          <div className="mb-3 inline-flex border border-phala-blue-400/45 bg-white/45 px-3 py-2 font-mono text-[12px] text-phala-blue-900">
            {item.command}
          </div>
        ) : null}
        <div className="inline-flex h-9 items-center gap-2 border border-[#070908] bg-[#070908] px-3 text-[13px] text-white transition">
          {item.cta}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </NavigationMenuLink>
  )
}

function MenuLinkCard({item}: {item: MenuLinkItem}) {
  const href = toExternalHref(item.href)

  if (item.children) {
    return (
      <div className="group border border-transparent px-0 py-1.5 transition hover:border-transparent hover:bg-transparent">
        <NavigationMenuLink
          href={href}
          target={shouldOpenExternally(href) ? '_blank' : undefined}
          rel={shouldOpenExternally(href) ? 'noopener noreferrer' : undefined}
          className="block p-0 text-left hover:bg-transparent focus:bg-transparent"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[14px] leading-5 text-foreground">
              <span>{item.title}</span>
              {shouldOpenExternally(href) ? (
                <ExternalLink className="size-3 text-muted-foreground group-hover:text-[#070908]" />
              ) : null}
            </div>
            {item.description ? (
              <p className="mt-1 max-w-[220px] text-[12px] leading-4 text-muted-foreground group-hover:text-[#070908]/70">
                {item.description}
              </p>
            ) : null}
          </div>
        </NavigationMenuLink>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.children.map((child) => (
            <NavigationMenuLink
              key={child.href}
              href={toExternalHref(child.href)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-auto flex-row border border-border bg-background px-2 py-1 font-mono text-[11px] leading-none text-muted-foreground transition hover:border-[#070908] hover:bg-[#070908] hover:text-white"
            >
              {child.title}
            </NavigationMenuLink>
          ))}
        </div>
      </div>
    )
  }

  return (
    <NavigationMenuLink
      href={href}
      target={shouldOpenExternally(href) ? '_blank' : undefined}
      rel={shouldOpenExternally(href) ? 'noopener noreferrer' : undefined}
      className={linkCardClass}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[14px] leading-5 text-foreground">
          <span>{item.title}</span>
          {shouldOpenExternally(href) ? (
            <ExternalLink className="size-3 text-muted-foreground group-hover:text-[#070908]" />
          ) : null}
        </div>
        {item.description ? (
          <p className="mt-1 max-w-[220px] text-[12px] leading-4 text-muted-foreground group-hover:text-[#070908]/70">
            {item.description}
          </p>
        ) : null}
      </div>
    </NavigationMenuLink>
  )
}

function MenuGroupBlock({group}: {group: MenuGroup}) {
  return (
    <div className="grid content-start gap-2">
      <p className={groupTitleClass}>{group.title}</p>
      <div className="grid gap-1">
        {group.items.map((item) => (
          <MenuLinkCard key={`${group.title}-${item.title}`} item={item} />
        ))}
      </div>
    </div>
  )
}

function MegaMenuPanel({menu}: {menu: MegaMenuConfig}) {
  return (
    <div className="grid gap-px bg-border lg:grid-cols-[260px_1fr]">
      <FeaturedCard item={menu.featured} />
      <div
        className={cn(
          'grid items-start gap-4 bg-background p-5',
          menu.groups.length >= 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2',
        )}
      >
        {menu.groups.map((group) => (
          <MenuGroupBlock key={`${menu.key}-${group.title}`} group={group} />
        ))}
      </div>
    </div>
  )
}

function MobileMenuLink({
  item,
  onNavigate,
}: {
  item: MenuLinkItem
  onNavigate: () => void
}) {
  const href = toExternalHref(item.href)

  return (
    <a
      href={href}
      target={shouldOpenExternally(href) ? '_blank' : undefined}
      rel={shouldOpenExternally(href) ? 'noopener noreferrer' : undefined}
      onClick={onNavigate}
      className="group grid grid-cols-[1fr_auto] gap-3 border-border border-b px-4 py-3.5 transition last:border-b-0 active:bg-[#eef3ff]"
    >
      <div className="min-w-0">
        <p className="text-[16px] leading-5 text-foreground">{item.title}</p>
        {item.description ? (
          <p className="mt-1 line-clamp-2 text-[13px] leading-[1.45] text-muted-foreground">
            {item.description}
          </p>
        ) : null}
      </div>
      {shouldOpenExternally(href) ? (
        <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      ) : (
        <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition group-active:translate-x-0.5" />
      )}
    </a>
  )
}

function MobileRootMenu({
  onOpenSubmenu,
  onNavigate,
}: {
  onOpenSubmenu: (key: MegaMenuConfig['key']) => void
  onNavigate: () => void
}) {
  return (
    <div className="grid gap-4 pb-8">
      <div className="border border-border bg-[#f7f8f3] p-4">
        <p className="font-mono text-[11px] uppercase leading-none tracking-[0.14em] text-muted-foreground">
          Menu
        </p>
        <h2 className="mt-2 text-[30px] leading-none text-foreground">
          Explore Phala
        </h2>
      </div>

      <div className="overflow-hidden border border-border bg-background">
        {navigationMenuItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className="group grid w-full grid-cols-[1fr_auto] gap-3 border-border border-b px-4 py-4 text-left last:border-b-0 active:bg-[#eef3ff]"
            onClick={() => onOpenSubmenu(item.key)}
          >
            <span className="min-w-0">
              <span className="block text-[18px] leading-5 text-foreground">
                {item.label}
              </span>
              <span className="mt-1 line-clamp-1 block text-[13px] leading-5 text-muted-foreground">
                {item.featured.title}
              </span>
            </span>
            <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition group-active:translate-x-0.5" />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-px border border-border bg-border">
        {[
          {title: 'Pricing', href: '/pricing'},
          {title: 'Contact', href: '/contact'},
          {title: 'Sign in', href: 'https://cloud.phala.com/login'},
        ].map((item) => (
          <a
            key={item.title}
            href={toExternalHref(item.href)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onNavigate}
            className="flex min-h-12 items-center justify-center bg-background px-2 text-center text-[14px] leading-4 text-foreground active:bg-[#eef3ff]"
          >
            {item.title}
          </a>
        ))}
      </div>

      <Button className="h-12 w-full text-[16px]" asChild>
        <a
          href="https://cloud.phala.com/register"
          target="_blank"
          rel="noopener noreferrer"
          onClick={onNavigate}
        >
          Start building
        </a>
      </Button>
    </div>
  )
}

function MobileMenuGroup({
  group,
  onNavigate,
}: {
  group: MenuGroup
  onNavigate: () => void
}) {
  return (
    <section className="overflow-hidden border border-border bg-background">
      <div className="border-border border-b bg-[#f7f8f3] px-4 py-3">
        <p className="font-mono text-[11px] uppercase leading-none tracking-[0.14em] text-muted-foreground">
          {group.title}
        </p>
      </div>
      <div>
        {group.items.map((item, index) => (
          <MobileMenuLink
            key={`${group.title}-${item.title}-${index}`}
            item={item}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </section>
  )
}

function MobileMenuPanel({
  menu,
  onBack,
  onNavigate,
}: {
  menu: MegaMenuConfig
  onBack: () => void
  onNavigate: () => void
}) {
  const featuredHref = toExternalHref(menu.featured.href)

  return (
    <div className="grid w-full min-w-0 max-w-full gap-4 overflow-x-hidden pb-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-9 w-fit items-center gap-2 font-mono text-[12px] uppercase tracking-[.10em] text-muted-foreground"
      >
        <ArrowLeft className="size-4" />
        Menu
      </button>

      <div className="border border-border bg-[#f7f8f3] p-4">
        <p className="font-mono text-[11px] uppercase tracking-[.12em] text-muted-foreground">
          {menu.featured.title}
        </p>
        <h2 className="mt-2 text-[30px] leading-none text-foreground">
          {menu.label}
        </h2>
        <p className="mt-2 max-w-[34ch] text-[14px] leading-5 text-muted-foreground">
          {menu.featured.copy}
        </p>
        <a
          href={featuredHref}
          target={shouldOpenExternally(featuredHref) ? '_blank' : undefined}
          rel={
            shouldOpenExternally(featuredHref)
              ? 'noopener noreferrer'
              : undefined
          }
          onClick={onNavigate}
          className="mt-4 inline-flex h-10 items-center justify-center gap-2 border border-[#070908] bg-[#070908] px-4 text-[14px] text-white"
        >
          {menu.featured.cta}
          <ArrowRight className="size-4" />
        </a>
      </div>

      <div className="grid gap-3">
        {menu.groups.map((group) => (
          <MobileMenuGroup
            key={`${menu.key}-mobile-${group.title}`}
            group={group}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  )
}

function HiddenNavigation() {
  return (
    <nav className="sr-only" aria-label="Main navigation">
      <ul>
        {navigationMenuItems.map((menu) => (
          <li key={menu.key}>
            <a href={toExternalHref(menu.featured.href)}>{menu.label}</a>
            <ul>
              {menu.groups.flatMap((group, groupIndex) =>
                group.items.map((item, itemIndex) => (
                  <li
                    key={`${menu.key}-${group.title}-${groupIndex}-${item.title}-${itemIndex}`}
                  >
                    <a href={toExternalHref(item.href)}>{item.title}</a>
                    {item.children ? (
                      <ul>
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <a href={toExternalHref(child.href)}>
                              {child.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                )),
              )}
            </ul>
          </li>
        ))}
        <li>
          <a href={toExternalHref('/pricing')}>Pricing</a>
        </li>
        <li>
          <a href={toExternalHref('/contact')}>Contact</a>
        </li>
        <li>
          <a href="https://cloud.phala.com/login">Sign in</a>
        </li>
        <li>
          <a href="https://cloud.phala.com/register">Start building</a>
        </li>
      </ul>
    </nav>
  )
}

const PhalaNavbar = () => {
  const [open, setOpen] = useState(false)
  const [submenu, setSubmenu] = useState<MegaMenuConfig['key'] | null>(null)

  const activeMobileMenu = navigationMenuItems.find(
    (item) => item.key === submenu,
  )

  return (
    <section className="v3-chrome fixed inset-x-0 top-0 z-50 bg-background">
      <HiddenNavigation />

      <div className="mx-auto max-w-[1920px] px-5 sm:px-8">
        <NavigationMenu className="min-w-full [&>div:last-child]:left-auto">
          <div className="flex min-h-[72px] w-full items-center justify-between gap-3 py-2">
            <a href="/" className="flex items-center gap-3">
              <img src="/logo.svg" className="h-9 w-auto" alt="Phala Network" />
              <span className="hidden h-6 w-px bg-border sm:block" />
              <span className="hidden font-mono text-[11px] uppercase tracking-[.14em] text-foreground sm:inline">
                Trust Center
              </span>
            </a>

            <NavigationMenuList className="hidden gap-1 lg:flex">
              {navigationMenuItems.map((item) => (
                <NavigationMenuItem key={item.key}>
                  <NavigationMenuTrigger>{item.label}</NavigationMenuTrigger>
                  <NavigationMenuContent className={menuShellClass}>
                    <MegaMenuPanel menu={item} />
                  </NavigationMenuContent>
                </NavigationMenuItem>
              ))}
              <NavigationMenuItem>
                <NavigationMenuLink
                  href={toExternalHref('/pricing')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex h-9 w-max items-center justify-center rounded-[4px] bg-transparent px-3 py-2 text-[15px] font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-muted data-[state=open]:bg-muted"
                >
                  Pricing
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="hidden h-9 px-4 text-[15px] md:inline-flex"
                asChild
              >
                <a
                  href={toExternalHref('/contact')}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Contact
                </a>
              </Button>
              <Button
                variant="ghost"
                className="hidden h-9 bg-[#101310] px-4 text-[15px] text-white hover:bg-[#101310]/90 hover:text-white md:inline-flex"
                asChild
              >
                <a href="https://cloud.phala.com/login">Sign in</a>
              </Button>
              <Button
                className="hidden h-9 px-5 text-[15px] md:inline-flex"
                asChild
              >
                <a href="https://cloud.phala.com/register">Start building</a>
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Main Menu"
                className="lg:hidden"
                onClick={() => {
                  if (open) {
                    setOpen(false)
                    setSubmenu(null)
                  } else {
                    setOpen(true)
                  }
                }}
              >
                {!open && <Menu className="size-4" />}
                {open && <X className="size-4" />}
              </Button>
            </div>
          </div>

          {open && (
            <div className="fixed inset-x-0 top-[72px] z-40 flex h-[calc(100vh-72px)] max-w-[100vw] flex-col overflow-auto overflow-x-hidden border-border border-t bg-background px-5 py-4 lg:hidden">
              {submenu === null ? (
                <MobileRootMenu
                  onOpenSubmenu={setSubmenu}
                  onNavigate={() => {
                    setOpen(false)
                    setSubmenu(null)
                  }}
                />
              ) : null}

              {activeMobileMenu ? (
                <MobileMenuPanel
                  menu={activeMobileMenu}
                  onBack={() => setSubmenu(null)}
                  onNavigate={() => {
                    setOpen(false)
                    setSubmenu(null)
                  }}
                />
              ) : null}
            </div>
          )}
        </NavigationMenu>
      </div>
    </section>
  )
}

export {PhalaNavbar}
