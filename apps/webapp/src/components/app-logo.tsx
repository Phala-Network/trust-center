import {Package} from 'lucide-react'

import {getUserLogoUrl} from '@/lib/app-logos'
import {cn} from '@/lib/utils'

interface AppLogoProps {
  /** User/owner name to lookup logo */
  user?: string
  /** App logo URL if available (overrides user lookup) */
  logoUrl?: string
  /** App name for alt text */
  appName?: string
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Additional CSS classes */
  className?: string
}

const sizeClasses = {
  xs: 'w-5 h-5',
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
}

const iconSizeClasses = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
}

export function AppLogo({
  user,
  logoUrl,
  appName = 'Application',
  size = 'md',
  className,
}: AppLogoProps) {
  // Use provided logoUrl, or lookup from user, or fallback to icon
  const finalLogoUrl = logoUrl || (user ? getUserLogoUrl(user) : undefined)

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
