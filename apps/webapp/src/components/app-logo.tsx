import {Package} from 'lucide-react'

import {
  classifyAppAvatar,
  getAppAvatarIcon,
  getAppAvatarToneClass,
} from '@/lib/app-avatar'
import {cn} from '@/lib/utils'

interface AppLogoProps {
  /** Per-app id — kept for API compat (used as alt-text fallback). */
  appId?: string
  /** App display name — drives category classification + tone selection. */
  appName?: string
  /** Optional uploaded logo URL — when present, takes precedence over the
   *  generated category-icon avatar. */
  logoUrl?: string
  /** Owner / workspace name — kept for API compat; not used in rendering. */
  user?: string
  /** Size variant. */
  size?: 'xs' | 'sm' | 'md' | 'lg' | number
  /** Additional CSS classes. */
  className?: string
}

const sizeClasses = {
  xs: 'w-5 h-5',
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
}

const iconSize = {
  xs: 'size-3',
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-7',
}

export function AppLogo({
  appName,
  logoUrl,
  size = 'md',
  className,
}: AppLogoProps) {
  const normalizedSize = typeof size === 'number' ? 'md' : size

  // Uploaded logo wins
  if (logoUrl) {
    return (
      <div
        className={cn(
          'flex flex-shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-muted',
          sizeClasses[normalizedSize],
          className,
        )}
      >
        <img
          src={logoUrl}
          alt={`${appName ?? 'app'} logo`}
          className="h-full w-full rounded-[4px] object-contain"
        />
      </div>
    )
  }

  // Category-icon avatar from app name
  if (appName) {
    const category = classifyAppAvatar(appName)
    const Icon = getAppAvatarIcon(category)
    const tone = getAppAvatarToneClass(appName)

    return (
      <div
        className={cn(
          'flex flex-shrink-0 items-center justify-center rounded-[4px] border',
          tone,
          sizeClasses[normalizedSize],
          className,
        )}
        aria-label={`${appName} (${category})`}
        title={category}
      >
        <Icon className={cn(iconSize[normalizedSize], 'stroke-[1.5]')} />
      </div>
    )
  }

  // Last-resort generic icon (no name available)
  return (
    <div
      className={cn(
        'flex flex-shrink-0 items-center justify-center rounded-[4px] bg-muted',
        sizeClasses[normalizedSize],
        className,
      )}
    >
      <Package
        className={cn('text-muted-foreground', iconSize[normalizedSize])}
      />
    </div>
  )
}
