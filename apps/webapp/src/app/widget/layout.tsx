import type {ReactNode} from 'react'

interface WidgetLayoutProps {
  children: ReactNode
}

export default function WidgetLayout({children}: WidgetLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}
