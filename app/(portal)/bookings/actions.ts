'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { createService, deleteService, setAppointmentStatus } from '@/lib/bookings/repo'

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
