'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { createService, deleteService, setAppointmentStatus, saveSchedule } from '@/lib/bookings/repo'
import { notifyBookingConfirmed } from '@/lib/bookings/notify'
import { validateExternalIcalUrl } from '@/lib/bookings/external-calendar'
import type { AvailabilityWindow } from '@/lib/bookings/types'
import { getSite, saveSiteContent } from '@/lib/sites/store'
import type { SiteContent } from '@/lib/sites/types'

export async function createServiceAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const description = String(formData.get('description') ?? '').trim()
  const durationMin = Math.max(5, parseInt(String(formData.get('duration') ?? '60'), 10) || 60)
  const priceCents = Math.round((parseFloat(String(formData.get('price') ?? '0')) || 0) * 100)
  const currency = (String(formData.get('currency') ?? 'eur').trim() || 'eur').toLowerCase()
  await createService(user.id, { name, description, durationMin, priceCents, currency })
  revalidatePath('/bookings')
}

export async function deleteServiceAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await deleteService(id)
  revalidatePath('/bookings')
}

export async function confirmAppointmentAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await setAppointmentStatus(id, 'confirmed')
  // Send the confirmation (client) + notification (owner) emails. Dormant-safe (no-op
  // without RESEND_API_KEY) and swallows all errors internally, so this can never break
  // the confirm action; the extra .catch() guards against an unexpected rejection.
  await notifyBookingConfirmed(id).catch(() => {})
  revalidatePath('/bookings')
}

export async function cancelAppointmentAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await setAppointmentStatus(id, 'cancelled')
  revalidatePath('/bookings')
}

// Save the name clients see on booking confirmations (stored in the site content).
export async function setBookingHostAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const siteId = String(formData.get('siteId') ?? '')
  if (!siteId) return
  const hostName = String(formData.get('hostName') ?? '').trim()
  const site = await getSite(siteId)
  if (!site) return
  const base: SiteContent = site.content ?? { theme: 'sand', headline: '', subheadline: '', sections: [], contactEmail: '' }
  await saveSiteContent(siteId, { ...base, bookingHost: hostName || undefined })
  revalidatePath('/bookings')
}

export async function saveScheduleAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  let parsed: { settings?: Record<string, unknown>; windows?: Record<string, unknown>[]; externalIcalUrl?: unknown }
  try {
    parsed = JSON.parse(String(formData.get('schedule') ?? '{}'))
  } catch {
    return
  }

  const s = parsed.settings ?? {}
  const settings = {
    timezone: String(s.timezone ?? 'UTC') || 'UTC',
    windowDays: Math.min(180, Math.max(1, parseInt(String(s.windowDays ?? 30), 10) || 30)),
    minNoticeHours: Math.min(720, Math.max(0, parseInt(String(s.minNoticeHours ?? 12), 10) || 0)),
    slotStepMin: Math.min(480, Math.max(0, parseInt(String(s.slotStepMin ?? 0), 10) || 0)),
  }

  const windows: AvailabilityWindow[] = (Array.isArray(parsed.windows) ? parsed.windows : [])
    .map(w => ({
      weekday: parseInt(String(w.weekday), 10),
      startMin: parseInt(String(w.startMin), 10),
      endMin: parseInt(String(w.endMin), 10),
    }))
    .filter(
      w =>
        Number.isInteger(w.weekday) &&
        w.weekday >= 0 &&
        w.weekday <= 6 &&
        Number.isFinite(w.startMin) &&
        Number.isFinite(w.endMin) &&
        w.endMin > w.startMin,
    )
    .slice(0, 50)

  // External calendar ("block busy times"): the owner's secret iCal URL. The key 'externalIcalUrl'
  // is only present when the field was touched, so we can distinguish "leave as-is" (undefined) from
  // "clear it" (''). Empty string => feature off. A non-empty value MUST validate or the whole save
  // is rejected, so a bad/unsafe URL can never be stored.
  let externalIcalUrl: string | undefined
  if (typeof parsed.externalIcalUrl === 'string') {
    const rawUrl = parsed.externalIcalUrl.trim().slice(0, 2048)
    if (rawUrl === '') {
      externalIcalUrl = '' // explicit clear
    } else {
      const valid = validateExternalIcalUrl(rawUrl)
      if (!valid) return // reject the save: invalid / obviously-internal URL
      externalIcalUrl = valid
    }
  }

  await saveSchedule(user.id, settings, windows, externalIcalUrl)
  revalidatePath('/bookings')
}
