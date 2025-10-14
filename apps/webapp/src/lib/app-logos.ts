/**
 * App logo mapping - maps appId to logo filename
 * Logos should be placed in public/logos/
 */

export const APP_LOGO_MAP: Record<string, string> = {
  // Blormmy
  f5e10d9cb7a7175d11e392eeb53b31f47500805f: 'blormmy.jpg',

  // NEAR Protocol
  dac0f0e6db700d7c6596cbb4a4824eb4549f4d13: 'near.svg',
  b79cad575dbe59d64516adf092740c32ebd01fca: 'near.svg',
  d010735b3b16e17fdfa4edb9a8d5b5cf9d39f72e: 'near.svg',
  ef7528d8170e073fcab30444702dbd2b5707a20d: 'near.svg',
  '0054dc56352b84b876036418b48fe36f1bf928f1': 'near.svg',
}

/**
 * Get logo URL for a given appId
 * @param appId - The app ID to look up
 * @returns Logo URL or undefined if not found
 */
export function getAppLogoUrl(appId: string): string | undefined {
  const filename = APP_LOGO_MAP[appId]
  return filename ? `/logos/${filename}` : undefined
}
