import type { LeadSource, LeadStatus, UnitStatus } from '@/shared/api/types'

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})
export const formatCurrency = (value: string | number) => currency.format(Number(value))
export const formatPercent = (ratio: number) => `${Math.round(ratio * 100)}%`

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
export function formatRelative(iso: string, now = Date.now()): string {
  const minutes = Math.round((new Date(iso).getTime() - now) / 60000)
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour')
  return relative.format(Math.round(hours / 24), 'day')
}

const shortTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
export const formatTime = (iso: string) => shortTime.format(new Date(iso))

const dayHeading = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
/** "Today", "Yesterday" or "Monday, Nov 2" for a conversation day separator. */
export function formatDayHeading(iso: string, now = new Date()): string {
  const date = new Date(iso)
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === now.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return dayHeading.format(date)
}

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  tour_scheduled: 'Tour scheduled',
  applied: 'Applied',
  won: 'Won',
  lost: 'Lost',
}

export const UNIT_STATUS_LABEL: Record<UnitStatus, string> = {
  vacant: 'Vacant',
  notice: 'On notice',
  occupied: 'Occupied',
}

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  website: 'Website',
  zillow: 'Zillow',
  apartments_com: 'Apartments.com',
  referral: 'Referral',
  walk_in: 'Walk-in',
}
