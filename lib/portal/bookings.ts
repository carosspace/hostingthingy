import { createSupabaseServerClient } from '@/lib/supabase/server'

// A single appointment as the signed-in client sees it (from get_my_appointments).
export interface MyAppointment {
  id: string
  serviceName: string | null
  slotDate: string | null
  slotTime: string | null
  durationMin: number | null
  status: 'requested' | 'confirmed' | 'cancelled'
  note: string | null
  createdAt: string
}

// The signed-in client's own appointments for the portal's site (newest first).
// Scoping to THIS client is enforced server-side by the get_my_appointments RPC,
// which matches on the verified auth email from the JWT — we never pass an email.
// GRACEFUL DEGRADE: if the RPC errors (e.g. migration 012 not applied), return []
// and log, so the portal page renders an empty list instead of crashing.
export async function getMyAppointments(slug: string): Promise<MyAppointment[]> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.rpc('get_my_appointments', { p_site_slug: slug })
    if (error) {
      console.error('[client-portal] get_my_appointments failed (migration 012 applied?):', error.message)
      return []
    }
    return (data ?? []).map(
      (r: {
        id: string
        service_name: string | null
        slot_date: string | null
        slot_time: string | null
        duration_min: number | null
        status: string
        note: string | null
        created_at: string
      }) => ({
        id: r.id,
        serviceName: r.service_name ?? null,
        slotDate: r.slot_date ?? null,
        slotTime: r.slot_time ?? null,
        durationMin: r.duration_min ?? null,
        status: (r.status as MyAppointment['status']) ?? 'requested',
        note: r.note ?? null,
        createdAt: r.created_at,
      }),
    )
  } catch (e) {
    console.error('[client-portal] get_my_appointments threw:', e)
    return []
  }
}

// Cancel one of the signed-in client's OWN requested/confirmed appointments.
// The RPC verifies ownership by the JWT email; returns 'ok' | 'notfound' | 'error'.
export async function cancelMyAppointment(id: string): Promise<'ok' | 'notfound' | 'error'> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.rpc('cancel_my_appointment', { p_appointment_id: id })
    if (error) {
      console.error('[client-portal] cancel_my_appointment failed:', error.message)
      return 'error'
    }
    return data === 'ok' ? 'ok' : data === 'notfound' ? 'notfound' : 'error'
  } catch (e) {
    console.error('[client-portal] cancel_my_appointment threw:', e)
    return 'error'
  }
}
