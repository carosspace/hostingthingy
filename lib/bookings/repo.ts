import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  DEFAULT_BOOKING_SETTINGS,
  type Service,
  type Appointment,
  type PublicService,
  type AvailabilityWindow,
  type BookingSettings,
  type BookingPageData,
} from './types'

// ---- Owner side (RLS: owner_id = auth.uid()) ----

export async function listServices(): Promise<Service[]> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.from('services').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(r => ({
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    durationMin: r.duration_min,
    priceCents: r.price_cents,
    currency: r.currency,
    active: r.active,
  }))
}

export async function createService(
  ownerId: string,
  input: { name: string; description: string; durationMin: number; priceCents: number; currency: string },
): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('services').insert({
    owner_id: ownerId,
    name: input.name,
    description: input.description || null,
    duration_min: input.durationMin,
    price_cents: input.priceCents,
    currency: input.currency,
  })
  if (error) throw error
}

export async function deleteService(id: string): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('services').delete().eq('id', id)
  if (error) throw error
}

export async function listAppointments(): Promise<Appointment[]> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.from('appointments').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(r => ({
    id: r.id,
    serviceName: r.service_name ?? null,
    clientName: r.client_name,
    clientEmail: r.client_email,
    requestedAt: r.requested_at ?? null,
    slotDate: r.slot_date ?? null,
    slotTime: r.slot_time ?? null,
    durationMin: r.duration_min ?? null,
    note: r.note ?? null,
    status: r.status,
    paid: !!r.paid,
    createdAt: r.created_at,
  }))
}

// ---- Availability & settings (owner) ----

export async function getAvailability(): Promise<AvailabilityWindow[]> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('booking_availability')
    .select('weekday, start_min, end_min')
    .order('weekday', { ascending: true })
    .order('start_min', { ascending: true })
  if (error) throw error
  return (data ?? []).map(r => ({ weekday: r.weekday, startMin: r.start_min, endMin: r.end_min }))
}

export async function getSettings(): Promise<BookingSettings> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('booking_settings')
    .select('timezone, window_days, min_notice_hours, slot_step_min')
    .maybeSingle()
  if (error) throw error
  if (!data) return { ...DEFAULT_BOOKING_SETTINGS }
  return {
    timezone: data.timezone ?? 'UTC',
    windowDays: data.window_days ?? 30,
    minNoticeHours: data.min_notice_hours ?? 12,
    slotStepMin: data.slot_step_min ?? 0,
  }
}

// Replace the whole weekly schedule + settings in one shot.
export async function saveSchedule(
  ownerId: string,
  settings: BookingSettings,
  windows: AvailabilityWindow[],
): Promise<void> {
  const supabase = createSupabaseServerClient()

  const { error: upErr } = await supabase.from('booking_settings').upsert({
    owner_id: ownerId,
    timezone: settings.timezone,
    window_days: settings.windowDays,
    min_notice_hours: settings.minNoticeHours,
    slot_step_min: settings.slotStepMin,
    updated_at: new Date().toISOString(),
  })
  if (upErr) throw upErr

  const { error: delErr } = await supabase.from('booking_availability').delete().eq('owner_id', ownerId)
  if (delErr) throw delErr

  if (windows.length) {
    const rows = windows.map(w => ({ owner_id: ownerId, weekday: w.weekday, start_min: w.startMin, end_min: w.endMin }))
    const { error: insErr } = await supabase.from('booking_availability').insert(rows)
    if (insErr) throw insErr
  }
}

export async function setAppointmentStatus(id: string, status: 'confirmed' | 'cancelled'): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('appointments').update({ status }).eq('id', id)
  if (error) throw error
}

// ---- Public side (via SECURITY DEFINER RPCs) ----

export async function getBookingServices(slug: string): Promise<PublicService[]> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_booking_info', { p_slug: slug })
  if (error) return []
  return (data ?? []).map((r: { service_id: string; name: string; description: string | null; duration_min: number; price_cents: number; currency: string }) => ({
    serviceId: r.service_id,
    name: r.name,
    description: r.description ?? null,
    durationMin: r.duration_min,
    priceCents: r.price_cents,
    currency: r.currency,
  }))
}

export async function requestBooking(input: {
  slug: string
  serviceId: string
  name: string
  email: string
  when: string
  note: string
}): Promise<boolean> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.rpc('request_booking', {
    p_slug: input.slug,
    p_service_id: input.serviceId,
    p_name: input.name,
    p_email: input.email,
    p_when: input.when,
    p_note: input.note,
  })
  return !error
}

// Everything the public booking page needs (services + availability + taken slots).
export async function getBookingPage(slug: string): Promise<BookingPageData | null> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_booking_page', { p_slug: slug })
  if (error || !data) return null
  const d = data as Partial<BookingPageData>
  return {
    services: d.services ?? [],
    settings: d.settings ?? { ...DEFAULT_BOOKING_SETTINGS },
    availability: d.availability ?? [],
    taken: d.taken ?? [],
  }
}

export async function requestBookingSlot(input: {
  slug: string
  serviceId: string
  name: string
  email: string
  slotDate: string
  slotTime: string
  note: string
}): Promise<'ok' | 'taken' | 'error'> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.rpc('request_booking_slot', {
    p_slug: input.slug,
    p_service_id: input.serviceId,
    p_name: input.name,
    p_email: input.email,
    p_slot_date: input.slotDate,
    p_slot_time: input.slotTime,
    p_note: input.note,
  })
  if (error) return 'error'
  return data === 'taken' ? 'taken' : data === 'ok' ? 'ok' : 'error'
}

// PAID flow: hold the slot as 'pending_payment' via the SAME double-booking guard and get
// back the new appointment id (so the server can start a Stripe Checkout for it). Returns the
// uuid on success, or 'taken'/'error'. The price is read SERVER-SIDE from the service row by
// the caller — this only creates the hold.
export async function requestBookingSlotPending(input: {
  slug: string
  serviceId: string
  name: string
  email: string
  slotDate: string
  slotTime: string
  note: string
}): Promise<{ status: 'ok'; appointmentId: string } | { status: 'taken' | 'error' }> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.rpc('request_booking_slot_pending', {
    p_slug: input.slug,
    p_service_id: input.serviceId,
    p_name: input.name,
    p_email: input.email,
    p_slot_date: input.slotDate,
    p_slot_time: input.slotTime,
    p_note: input.note,
  })
  if (error) return { status: 'error' }
  if (data === 'taken') return { status: 'taken' }
  if (data === 'error' || !data) return { status: 'error' }
  return { status: 'ok', appointmentId: String(data) }
}

// Attach the Stripe session id to a pending appointment (scoped server-side to a still-pending,
// not-yet-attached row owned by the site). Best-effort: a false result is non-fatal — the webhook
// can still match by metadata.appointmentId. Never throws.
export async function attachBookingSession(slug: string, appointmentId: string, sessionId: string): Promise<boolean> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.rpc('attach_booking_session', {
    p_slug: slug,
    p_appointment_id: appointmentId,
    p_session_id: sessionId,
  })
  if (error) return false
  return data === true
}
