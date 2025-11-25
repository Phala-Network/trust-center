// Featured Builders - curated list of trusted builders
// Two types:
// 1. Static builders: Have displayName and logoUrl defined here (matched by customUser in database)
// 2. Workspace builders: Have workspaceId, fetch profile from database (matched by workspaceId in database)

export type StaticBuilder = {
  type: 'static'
  slug: string
  displayName: string
  logoUrl: string
}

export type WorkspaceBuilder = {
  type: 'workspace'
  slug: string
  workspaceId: number
}

export type FeaturedBuilder = StaticBuilder | WorkspaceBuilder

// Type guards for Featured Builders
export function isStaticBuilder(
  builder: FeaturedBuilder,
): builder is StaticBuilder {
  return builder.type === 'static'
}

export function isWorkspaceBuilder(
  builder: FeaturedBuilder,
): builder is WorkspaceBuilder {
  return builder.type === 'workspace'
}

export const FEATURED_BUILDERS: FeaturedBuilder[] = [
  {
    type: 'static',
    slug: 'near',
    displayName: 'NEAR',
    logoUrl: '/logos/near.jpg',
  },
  {
    type: 'static',
    slug: 'crossmint',
    displayName: 'Crossmint',
    logoUrl: '/logos/crossmint.png',
  },
  {
    type: 'static',
    slug: 'vana',
    displayName: 'Vana',
    logoUrl: '/logos/vana.jpg',
  },
  {
    type: 'static',
    slug: 'rena-labs',
    displayName: 'Rena Labs',
    logoUrl: '/logos/rena-labs.jpg',
  },
  {
    type: 'static',
    slug: 'blormy',
    displayName: 'blormy',
    logoUrl: '/logos/blormmy.jpg',
  },
  {
    type: 'static',
    slug: 'sahara',
    displayName: 'Sahara',
    logoUrl: '/logos/sahara.png',
  },
  {
    type: 'static',
    slug: 'magic-link',
    displayName: 'Magic Link',
    logoUrl: '/logos/magic-link.jpg',
  },
  {
    type: 'static',
    slug: 'ooda',
    displayName: 'OODA',
    logoUrl: '/logos/ooda.jpg',
  },
  {
    type: 'static',
    slug: 'lit',
    displayName: 'Lit',
    logoUrl: '/logos/lit.jpg',
  },
  {
    type: 'static',
    slug: 'proximity',
    displayName: 'Proximity',
    logoUrl: '/logos/proximity.jpg',
  },
  {
    type: 'static',
    slug: 'vijil',
    displayName: 'Vijil',
    logoUrl: '/logos/vijil.jpeg',
  },
  {
    type: 'static',
    slug: 'rift',
    displayName: 'Rift',
    logoUrl: '/logos/rift.jpg',
  },
  {
    type: 'static',
    slug: 'blue-nexus',
    displayName: 'Blue Nexus',
    logoUrl: '/logos/blue-nexus.png',
  },
  {
    type: 'static',
    slug: 'succinct',
    displayName: 'Succinct',
    logoUrl: '/logos/succinct.jpg',
  },
  {
    type: 'static',
    slug: 'rabbi',
    displayName: 'Rabbi',
    logoUrl: '/logos/rabbi.jpg',
  },
  {
    type: 'static',
    slug: 'propellerheads',
    displayName: 'PropellerHeads',
    logoUrl: '/logos/propeller-heads.jpg',
  },
  {
    type: 'static',
    slug: 'primus',
    displayName: 'Primus',
    logoUrl: '/logos/primus.svg',
  },
  {
    type: 'workspace',
    slug: 'phala',
    workspaceId: 9523,
  },
]

/**
 * Map for O(1) lookups of featured builders by slug
 */
export const FEATURED_BUILDERS_MAP = new Map(
  FEATURED_BUILDERS.map((builder) => [builder.slug, builder]),
)

/**
 * Get featured builder logo URL (only for static builders)
 * @param slug - Slugified username
 * @returns Logo URL or undefined if not found or is workspace builder
 */
export function getFeaturedBuilderLogo(slug: string): string | undefined {
  const builder = FEATURED_BUILDERS_MAP.get(slug)
  return builder?.type === 'static' ? builder.logoUrl : undefined
}
