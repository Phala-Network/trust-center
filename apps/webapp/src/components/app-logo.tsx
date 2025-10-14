import {Package} from 'lucide-react'

import {getAppLogoUrl} from '@/lib/app-logos'
import {cn} from '@/lib/utils'

interface AppLogoProps {
  /** App ID to lookup logo */
  appId?: string
  /** App logo URL if available (overrides appId lookup) */
  logoUrl?: string
  /** App name for alt text */
  appName?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Additional CSS classes */
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
}

const iconSizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
}

export function AppLogo({
  appId,
  logoUrl,
  appName = 'Application',
  size = 'md',
  className,
}: AppLogoProps) {
  // Use provided logoUrl, or lookup from appId, or fallback to icon
  const finalLogoUrl = logoUrl || (appId ? getAppLogoUrl(appId) : undefined)

  return (
    <div
      className={cn(
        'bg-muted rounded-lg flex items-center justify-center flex-shrink-0',
        sizeClasses[size],
        className,
      )}
    >
      {finalLogoUrl ? (
        <img
          src={finalLogoUrl}
          alt={`${appName} logo`}
          className="w-full h-full rounded-lg object-contain"
        />
      ) : (
        <Package
          className={cn('text-muted-foreground', iconSizeClasses[size])}
        />
      )}
    </div>
  )
}
