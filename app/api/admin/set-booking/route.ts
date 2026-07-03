export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// TEMP (active build): create bookable services + set weekly availability for the
// animatemple-com owner, so Carolina doesn't have to touch the Bookings UI. Token-gated,
// service-role. REMOVE when booking is finalised.
//
// GET  -> current owner_id + services + availability + settings (inspection).
// POST { services?: [{name,durationMin,priceCents,currency?,description?}],
//        timezone?, windowDays?, minNoticeHours?,
//        availability?: [{weekday,startMin,endMin}] }   // weekday 0=Sun..6=Sat, minutes from midnight
//   - services: created only if a service of that name doesn't already exist (idempotent).
//   - availability: REPLACES the whole weekly schedule when provided.
const TOKEN = 'diag-7h3k9x2p'
const SLUG = 'animatemple-com'

function authed(req: NextRequest) {
  return req.headers.get('Authorization') === `Bearer ${TOKEN}`
}

async function ownerId(admin: ReturnType<typeof getSupabaseAdmin>) {
  const { data, error } = await admin!.from('sites').select('owner_id').eq('slug', SLUG).single()
  if (error || !data) return null
  return (data as { owner_id: string }).owner_id
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  const owner = await ownerId(admin)
  if (!owner) return NextResponse.json({ error: 'site not found' }, { status: 404 })
  const { data: services } = await admin.from('services').select('id,name,duration_min,price_cents,currency,active').eq('owner_id', owner)
  const { data: availability } = await admin.from('booking_availability').select('weekday,start_min,end_min').eq('owner_id', owner)
  const { data: settings } = await admin.from('booking_settings').select('timezone,window_days,min_notice_hours,slot_step_min').eq('owner_id', owner).maybeSingle()
  return NextResponse.json({ owner_id: owner, services: services ?? [], availability: availability ?? [], settings: settings ?? null })
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ error: 'service role not configured' }, { status: 500 })

  let body: {
    services?: { name: string; durationMin?: number; priceCents?: number; currency?: string; description?: string }[]
    timezone?: string
    windowDays?: number
    minNoticeHours?: number
    availability?: { weekday: number; startMin: number; endMin: number }[]
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  const owner = await ownerId(admin)
  if (!owner) return NextResponse.json({ error: 'site not found' }, { status: 404 })
  const results: string[] = []

  // --- services (idempotent by name) ---
  if (Array.isArray(body.services) && body.services.length) {
    const { data: existing } = await admin.from('services').select('name').eq('owner_id', owner)
    const have = new Set((existing ?? []).map((r: { name: string }) => String(r.name).trim().toLowerCase()))
    const rows = body.services
      .filter(s => s && s.name && !have.has(String(s.name).trim().toLowerCase()))
      .map(s => ({
        owner_id: owner,
        name: String(s.name).slice(0, 120),
        description: s.description ? String(s.description).slice(0, 500) : null,
        duration_min: Math.max(5, Math.min(600, Math.round(s.durationMin ?? 60))),
        price_cents: Math.max(0, Math.round(s.priceCents ?? 0)),
        currency: String(s.currency ?? 'eur').toLowerCase().slice(0, 3),
      }))
    if (rows.length) {
      const { error } = await admin.from('services').insert(rows)
      if (error) return NextResponse.json({ error: 'services: ' + error.message }, { status: 500 })
    }
    results.push(`services created:${rows.length} (skipped existing:${body.services.length - rows.length})`)
  }

  // --- settings + weekly availability ---
  if (body.timezone || body.windowDays != null || body.minNoticeHours != null || Array.isArray(body.availability)) {
    const settingsRow: Record<string, unknown> = { owner_id: owner, updated_at: new Date().toISOString() }
    if (body.timezone) settingsRow.timezone = String(body.timezone).slice(0, 64)
    if (body.windowDays != null) settingsRow.window_days = Math.max(1, Math.min(120, Math.round(body.windowDays)))
    if (body.minNoticeHours != null) settingsRow.min_notice_hours = Math.max(0, Math.min(168, Math.round(body.minNoticeHours)))
    const { error: se } = await admin.from('booking_settings').upsert(settingsRow)
    if (se) return NextResponse.json({ error: 'settings: ' + se.message }, { status: 500 })
    results.push(`settings updated${body.timezone ? ' (tz=' + body.timezone + ')' : ''}`)

    if (Array.isArray(body.availability)) {
      await admin.from('booking_availability').delete().eq('owner_id', owner)
      const rows = body.availability
        .filter(w => w && Number.isFinite(w.weekday))
        .map(w => ({
          owner_id: owner,
          weekday: ((Math.round(w.weekday) % 7) + 7) % 7,
          start_min: Math.max(0, Math.min(1440, Math.round(w.startMin))),
          end_min: Math.max(0, Math.min(1440, Math.round(w.endMin))),
        }))
        .filter(w => w.end_min > w.start_min)
      if (rows.length) {
        const { error: ae } = await admin.from('booking_availability').insert(rows)
        if (ae) return NextResponse.json({ error: 'availability: ' + ae.message }, { status: 500 })
      }
      results.push(`availability windows:${rows.length}`)
    }
  }

  return NextResponse.json({ ok: true, results })
}
