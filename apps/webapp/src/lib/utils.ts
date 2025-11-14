import {type ClassValue, clsx} from 'clsx'
import {twMerge} from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Check if a report is stale (>48 hours old)
export function isReportStale(createdAt: string): boolean {
  const reportDate = new Date(createdAt)
  const now = new Date()
  const hoursDiff = (now.getTime() - reportDate.getTime()) / (1000 * 60 * 60)
  return hoursDiff > 48
}
