import {Package} from 'lucide-react'

import {cn} from '@/lib/utils'

interface AppLogoProps {
  /** User/owner name (not used anymore, kept for compatibility) */
  user?: string
  /** App logo URL if available */
  logoUrl?: string
  /** App name for alt text */
  appName?: string
  /** Size variant (string or number for compatibility) */
  size?: 'xs' | 'sm' | 'md' | 'lg' | number
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
  logoUrl,
  appName = 'Application',
  size = 'md',
  className,
}: AppLogoProps) {
  // Normalize size to string if it's a number
  const normalizedSize = typeof size === 'number' ? 'md' : size
  const finalLogoUrl = logoUrl

  return (
    <div
      className={cn(
        'bg-muted rounded-lg flex items-center justify-center flex-shrink-0',
        sizeClasses[normalizedSize],
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
          className={cn('text-muted-foreground', iconSizeClasses[normalizedSize])}
        />
      )}
    </div>
  )
}
