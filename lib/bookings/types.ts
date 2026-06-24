export interface Service {
  id: string
  name: string
  description: string | null
  durationMin: number
  priceCents: number
  currency: string
  active: boolean
}

export interface Appointment {
  id: string
  serviceName: string | null
  clientName: string
  clientEmail: string
  requestedAt: string | null
  slotDate: string | null
  slotTime: string | null
  durationMin: number | null
  note: string | null
  status: 'requested' | 'confirmed' | 'cancelled' | 'pending_payment'
  paid: boolean
  createdAt: string
}

// A weekly recurring availability window. weekday: 0=Sun .. 6=Sat (JS getDay).
// Times are minutes from midnight in the owner's timezone.
export interface AvailabilityWindow {
  weekday: number
  startMin: number
  endMin: number
}

export interface BookingSettings {
  timezone: string
  windowDays: number
  minNoticeHours: number
  slotStepMin: number
}

export interface TakenSlot {
  date: string
  time: string
  durationMin: number | null
}

// Everything the public booking page needs (from the get_booking_page RPC).
export interface BookingPageData {
  services: PublicService[]
  settings: BookingSettings
  availability: AvailabilityWindow[]
  taken: TakenSlot[]
}

// A bookable day with its open start times (computed, owner timezone).
export interface DaySlots {
  date: string
  weekday: number
  slots: string[]
}

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  timezone: 'UTC',
  windowDays: 30,
  minNoticeHours: 12,
  slotStepMin: 0,
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
// Display order Monday-first (values are the 0=Sun..6=Sat weekday numbers).
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

export function minToHHMM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`
}

export function hhmmToMin(t: string): number {
  const [h, m] = t.split(':')
  return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0)
}

// "Mon 22 Jun" for a 'YYYY-MM-DD' date string (timezone-neutral).
export function formatDayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(dt)
}

// "2:00 PM" for an 'HH:MM' string.
export function formatTimeLabel(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const dt = new Date(Date.UTC(2000, 0, 1, h, m))
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(dt)
}

export interface PublicService {
  serviceId: string
  name: string
  description: string | null
  durationMin: number
  priceCents: number
  currency: string
}

export function formatPrice(cents: number, currency: string): string {
  if (!cents) return 'Free'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(0)} ${currency.toUpperCase()}`
  }
}
