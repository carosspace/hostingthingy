'use server'

import { redirect } from 'next/navigation'
import { requestBooking, requestBookingSlot } from '@/lib/bookings/repo'

export async function requestBookingAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '')
  if (!slug) return
  const serviceId = String(formData.get('serviceId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const when = String(formData.get('when') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim()

  if (!serviceId || !name || !email) {
    redirect(`/book/${slug}?error=1`)
  }

  await requestBooking({ slug, serviceId, name, email, when, note })
  redirect(`/book/${slug}?sent=1`)
}

export async function requestBookingSlotAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '')
  if (!slug) return
  const serviceId = String(formData.get('serviceId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const slotDate = String(formData.get('slotDate') ?? '').trim()
  const slotTime = String(formData.get('slotTime') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim()

  if (!serviceId || !name || !email || !slotDate || !slotTime) {
    redirect(`/book/${slug}?error=1`)
  }

  const result = await requestBookingSlot({ slug, serviceId, name, email, slotDate, slotTime, note })
  if (result === 'taken') redirect(`/book/${slug}?error=taken`)
  if (result === 'error') redirect(`/book/${slug}?error=1`)
  redirect(`/book/${slug}?sent=1`)
}
