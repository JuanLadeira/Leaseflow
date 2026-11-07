/** Calendar helpers in the browser's local time. Dates travel as ISO strings with an offset. */

export const SLOT_MINUTES = 30
export const DAY_START_HOUR = 9
export const DAY_END_HOUR = 18 // last visit must end by 18:00
export const DURATIONS = [30, 45, 60] as const
export type Duration = (typeof DURATIONS)[number]

const pad = (n: number) => String(n).padStart(2, '0')

/** `YYYY-MM-DD` for a local date (not UTC, unlike toISOString). */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isDateKey(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(fromDateKey(value).getTime())
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60000)

/** Monday of the week that contains `date`. */
export function startOfWeek(date: Date): Date {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return addDays(day, -((day.getDay() + 6) % 7))
}

/** `HH:MM` on a given day → Date. */
export function atTime(dateKey: string, time: string): Date {
  const [h, m] = time.split(':').map(Number)
  const date = fromDateKey(dateKey)
  date.setHours(h, m, 0, 0)
  return date
}

/** Every slot start (`HH:MM`) where a visit of `duration` fits inside business hours. */
export function slotTimes(duration: Duration): string[] {
  const times: string[] = []
  for (let minutes = DAY_START_HOUR * 60; minutes + duration <= DAY_END_HOUR * 60; minutes += SLOT_MINUTES) {
    times.push(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`)
  }
  return times
}

export const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart < bEnd && bStart < aEnd

// Locale-aware formatters live in shared/lib/format; re-exported for existing imports.
export { formatDay, formatTime, formatTimeRange } from '@/shared/lib/format'
