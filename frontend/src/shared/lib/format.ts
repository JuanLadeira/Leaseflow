import type { LeadSource, LeadStatus, UnitStatus } from '@/shared/api/types'
import { i18n } from '@/shared/i18n'
import { currentLocale } from '@/shared/i18n/locale'

/**
 * Intl formatters follow the active UI language. Building one is not free,
 * so each is cached per locale + options.
 */
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>()
function cached<T extends Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>(
  key: string,
  build: (locale: string) => T,
): T {
  const locale = currentLocale()
  const id = `${key}|${locale}`
  let formatter = cache.get(id) as T | undefined
  if (!formatter) {
    formatter = build(locale)
    cache.set(id, formatter)
  }
  return formatter
}

/** Rent is a property fact: always USD. Only the way it's written follows the locale. */
export const formatCurrency = (value: string | number) =>
  cached('currency', (l) => new Intl.NumberFormat(l, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })).format(
    Number(value),
  )

export const formatPercent = (ratio: number) =>
  cached('percent', (l) => new Intl.NumberFormat(l, { style: 'percent', maximumFractionDigits: 0 })).format(ratio)

export const formatNumber = (value: number) => cached('number', (l) => new Intl.NumberFormat(l)).format(value)

export const formatDateTime = (iso: string | Date) =>
  cached('datetime', (l) => new Intl.DateTimeFormat(l, { dateStyle: 'medium', timeStyle: 'short' })).format(new Date(iso))

export const formatTime = (iso: string | Date) =>
  cached('time', (l) => new Intl.DateTimeFormat(l, { hour: 'numeric', minute: '2-digit' })).format(new Date(iso))

export const formatDay = (date: Date) =>
  cached('day', (l) => new Intl.DateTimeFormat(l, { weekday: 'short', month: 'short', day: 'numeric' })).format(date)

export function formatRelative(iso: string, now = Date.now()): string {
  const relative = cached('relative', (l) => new Intl.RelativeTimeFormat(l, { numeric: 'auto' }))
  const minutes = Math.round((new Date(iso).getTime() - now) / 60000)
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour')
  return relative.format(Math.round(hours / 24), 'day')
}

/** "9:00 – 9:30 AM" / "09:00 – 09:30": Intl collapses the shared parts per locale. */
export const formatTimeRange = (start: string | Date, end: string | Date) =>
  cached('time', (l) => new Intl.DateTimeFormat(l, { hour: 'numeric', minute: '2-digit' })).formatRange(
    new Date(start),
    new Date(end),
  )

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase(currentLocale()) + text.slice(1)

/** "Today", "Yesterday" or "Monday, Nov 2" for a conversation day separator (words come from Intl). */
export function formatDayHeading(iso: string, now = new Date()): string {
  const date = new Date(iso)
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const relative = cached('relative', (l) => new Intl.RelativeTimeFormat(l, { numeric: 'auto' }))
  if (date.toDateString() === now.toDateString()) return capitalize(relative.format(0, 'day'))
  if (date.toDateString() === yesterday.toDateString()) return capitalize(relative.format(-1, 'day'))
  return capitalize(
    cached('dayHeading', (l) => new Intl.DateTimeFormat(l, { weekday: 'long', month: 'short', day: 'numeric' })).format(date),
  )
}

// Status codes come from the API; their labels live in the `common` namespace.
export const leadStatusLabel = (status: LeadStatus) => i18n.t(`leadStatus.${status}`)
export const unitStatusLabel = (status: UnitStatus) => i18n.t(`unitStatus.${status}`)
export const leadSourceLabel = (source: LeadSource) => i18n.t(`leadSource.${source}`)

/** @deprecated Pre-i18n maps, kept until each feature moves to `t()`. Removed in the extraction commits. */
const legacy = <K extends string>(label: (key: K) => string) =>
  new Proxy({} as Record<K, string>, { get: (_, key) => label(key as K) })
export const LEAD_STATUS_LABEL = legacy(leadStatusLabel)
export const UNIT_STATUS_LABEL = legacy(unitStatusLabel)
export const LEAD_SOURCE_LABEL = legacy(leadSourceLabel)
