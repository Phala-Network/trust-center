import {Package} from 'lucide-react'

import {cn} from '@/lib/utils'

interface AppLogoProps {
  /** App logo URL if available */
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
  logoUrl,
  appName = 'Application',
  size = 'md',
  className,
}: AppLogoProps) {
  return (
    <div
      className={cn(
        'bg-muted rounded-lg flex items-center justify-center flex-shrink-0',
        sizeClasses[size],
        className,
      )}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={`${appName} logo`}
          className="w-full h-full rounded-lg object-cover"
        />
      ) : (
        <Package
          className={cn('text-muted-foreground', iconSizeClasses[size])}
        />
      )}
    </div>
  )
}
