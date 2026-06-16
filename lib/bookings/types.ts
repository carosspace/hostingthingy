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
  note: string | null
  status: 'requested' | 'confirmed' | 'cancelled'
  createdAt: string
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
