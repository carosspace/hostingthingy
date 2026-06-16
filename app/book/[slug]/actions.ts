'use server'

import { redirect } from 'next/navigation'
import { requestBooking } from '@/lib/bookings/repo'

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
