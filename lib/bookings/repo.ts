import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Service, Appointment, PublicService } from './types'

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
    note: r.note ?? null,
    status: r.status,
    createdAt: r.created_at,
  }))
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
