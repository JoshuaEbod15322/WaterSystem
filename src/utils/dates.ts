import {
  addDays,
  format,
  isAfter,
  isBefore,
  parse,
  startOfDay,
} from 'date-fns'
import { WEEKDAY_NAMES } from './constants'

export function formatDeliveryDate(value: string | Date): string {
  const date = typeof value === 'string' ? parseISO(value) : value
  return format(date, 'EEE, MMM d, yyyy')
}

export function formatShortDate(value: string | Date): string {
  const date = typeof value === 'string' ? parseISO(value) : value
  return format(date, 'MMM d, yyyy')
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? parseISO(value) : value
  return format(date, 'MMM d, yyyy • h:mm a')
}

export function formatTime(value: string): string {
  try {
    return format(parse(value, 'HH:mm:ss', new Date()), 'h:mm a')
  } catch {
    return value
  }
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`
}

export function parseISO(value: string): Date {
  // Supabase returns YYYY-MM-DD dates; interpret them as local dates.
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function toDateInputValue(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function weekdayName(dayOfWeek: number): string {
  return WEEKDAY_NAMES[dayOfWeek] ?? ''
}

export interface DeliveryDateOption {
  value: string
  label: string
  dayOfWeek: number
  date: Date
}

/**
 * Builds the list of selectable delivery dates from today through the
 * configured number of days ahead.
 */
export function buildDeliveryDates(daysAhead = 14): DeliveryDateOption[] {
  const today = startOfDay(new Date())
  return Array.from({ length: daysAhead }, (_, index) => {
    const date = addDays(today, index)
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: format(date, 'EEE, MMM d'),
      dayOfWeek: date.getDay(),
      date,
    }
  })
}

/** True when the selected date's delivery window has already ended. */
export function isWindowInThePast(
  deliveryDate: string,
  endTime: string,
): boolean {
  const date = parseISO(deliveryDate)
  const [hours, minutes] = endTime.split(':').map(Number)
  const endsAt = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes ?? 0,
    0,
    0,
  )
  return isBefore(endsAt, new Date())
}

export function isPastDate(value: string): boolean {
  return isBefore(parseISO(value), startOfDay(new Date()))
}

export function isFutureOrToday(value: string): boolean {
  return !isPastDate(value) || isAfter(parseISO(value), new Date())
}

export function dayKey(scheduleId: number, date: string): string {
  return `${scheduleId}|${date}`
}
