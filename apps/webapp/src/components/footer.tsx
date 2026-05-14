import {BookOpen, Github, Twitter} from 'lucide-react'
import Link from 'next/link'

const COLUMNS: Array<{
  title: string
  links: Array<{label: string; href: string; external?: boolean}>
}> = [
  {
    title: 'Verify',
    links: [
      {label: 'Browse apps', href: '/#verified-apps'},
      {
        label: 'Trust Center docs',
        href: 'https://docs.phala.com/phala-cloud/attestation/trust-center-verification',
        external: true,
      },
    ],
  },
  {
    title: 'Build',
    links: [
      {label: 'Phala Cloud', href: 'https://cloud.phala.com', external: true},
      {label: 'dstack', href: 'https://github.com/Dstack-TEE/dstack', external: true},
      {
        label: 'CLI',
        href: 'https://docs.phala.com/phala-cloud/phala-cloud-cli/overview',
        external: true,
      },
    ],
  },
  {
    title: 'Proof',
    links: [
      {label: 'How it works', href: '/#how-it-works'},
      {
        label: 'Open source repo',
        href: 'https://github.com/Phala-Network/trust-center',
        external: true,
      },
      {
        label: 'Sample report',
        href: '/#verified-apps',
      },
    ],
  },
  {
    title: 'Company',
    links: [
      {label: 'Phala.network', href: 'https://phala.network', external: true},
      {label: 'Contact', href: 'https://phala.network/contact', external: true},
      {
        label: 'GitHub',
        href: 'https://github.com/Phala-Network',
        external: true,
      },
    ],
  },
]

const SOCIAL: Array<{label: string; href: string; Icon: typeof Github}> = [
  {label: 'GitHub', href: 'https://github.com/Phala-Network/trust-center', Icon: Github},
  {label: 'Twitter', href: 'https://x.com/PhalaNetwork', Icon: Twitter},
  {label: 'Docs', href: 'https://docs.phala.com', Icon: BookOpen},
]

export default function Footer() {
  return (
    <footer className="bg-phala-blue-100 dark:bg-phala-blue-900">
      <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="grid gap-px border-x border-phala-blue-300 bg-phala-blue-300 sm:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.title} className="bg-phala-blue-50 p-6 md:p-8 dark:bg-phala-blue-900">
              <p className="mb-4 font-mono text-[11px] uppercase tracking-[.14em] text-foreground/70">
                {col.title}
              </p>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                      className="text-[14px] text-foreground transition-colors hover:text-primary-700 dark:hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 border-x border-b border-phala-blue-300 bg-phala-blue-50 px-6 py-5 md:flex-row md:items-center md:justify-between md:px-8 dark:bg-phala-blue-900">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 border border-phala-blue-300 bg-card px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              All systems operational
            </span>
            <p className="font-mono text-[11px] uppercase tracking-[.14em] text-foreground/70">
              © {new Date().getFullYear()} Phala Network · Trust Center
            </p>
          </div>
          <div className="flex items-center gap-4">
            {SOCIAL.map(({label, href, Icon}) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="text-foreground/70 transition-colors hover:text-foreground"
              >
                <Icon className="size-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
