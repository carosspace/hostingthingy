'use server'

import { revalidatePath } from 'next/cache'
import { cancelMyAppointment } from '@/lib/portal/bookings'

// Cancel one of the signed-in client's own appointments, then refresh the list.
// Ownership is verified server-side by the cancel_my_appointment RPC (JWT email),
// so a stray/forged id cannot cancel someone else's session. Bound via a hidden
// field in the per-card cancel form on /me/bookings.
export async function cancelAppointment(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (id) {
    await cancelMyAppointment(id)
  }
  revalidatePath('/me/bookings')
}
