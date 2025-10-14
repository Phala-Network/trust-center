/**
 * User logo mapping - maps user/owner to logo filename
 * Logos should be placed in public/logos/
 */

export const USER_LOGO_MAP: Record<string, string> = {
  Crossmint: 'crossmint.png',
  Vana: 'vana.jpg',
  'Rena Labs': 'rena-labs.jpg',
  blormy: 'blormmy.jpg',
  NEAR: 'near.jpg',
  Sahara: 'sahara.png',
  'Magic Link': 'magic-link.jpg',
  OODA: 'ooda.jpg',
  Lit: 'lit.jpg',
  Proximity: 'proximity.jpg',
  Vijil: 'vijil.jpeg',
  Rift: 'rift.jpg',
  'Blue Nexus': 'blue-nexus.png',
  Succinct: 'succinct.jpg',
  Rabbi: 'rabbi.jpg',
  PropellerHeads: 'propeller-heads.jpg',
}

/**
 * Get logo URL for a given user
 * @param user - The user/owner to look up
 * @returns Logo URL or undefined if not found
 */
export function getUserLogoUrl(user: string): string | undefined {
  const filename = USER_LOGO_MAP[user]
  return filename ? `/logos/${filename}` : undefined
}
