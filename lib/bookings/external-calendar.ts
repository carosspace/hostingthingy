import dns from 'node:dns/promises'
import net from 'node:net'
// TYPE-ONLY: node-ical is loaded LAZILY at parse time (see getOwnerBusyRanges). This module is
// imported by the public /book page AND the portal /bookings actions, so a top-level runtime
// require would 500 BOTH routes if the package isn't present at runtime (it's kept external from
// the bundle and isn't traced into the standalone server). `import type` is erased at runtime.
import type ical from 'node-ical'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { ownerLocalToUtc } from './ics'
import { pad2, type TakenSlot } from './types'

// SERVER-ONLY. "Block busy times" — read the OWNER's own external calendar (their secret iCal
// URL) and turn its busy events into concrete UTC time-ranges, so the public booking page can
// stop offering slots that overlap them.
//
// The owner's iCal URL is SEMI-PRIVATE: it is read ONLY here, via the service-role admin client,
// and is NEVER returned to any client. Only the derived busy ranges leave this module.
//
// DORMANT-SAFE: if no URL is configured (or anything at all goes wrong — bad URL, blocked IP,
// timeout, oversized body, parse error) this returns [] and NEVER throws. With no busy ranges the
// booking page behaves exactly as before.
//
// SECURITY: this fetches a USER-SUPPLIED URL, so it is an SSRF surface. See assertPublicUrl below.

export interface BusyRange {
  startUtc: Date
  endUtc: Date
}

const FETCH_TIMEOUT_MS = 6000
const MAX_BYTES = 3 * 1024 * 1024 // 3 MB cap on the iCal body
const MAX_REDIRECTS = 3
const CACHE_TTL_MS = 600_000 // 10 min — don't refetch on every booking-page load
const USER_AGENT = 'AnimaTemple-Bookings/1.0 (+https://animatemple.com)'

// ---- SSRF hardening -------------------------------------------------------

// Is this resolved IP address one we must never connect to (loopback / private / link-local /
// reserved / unique-local)? Covers IPv4 and IPv6 (incl. IPv4-mapped IPv6 in EITHER notation:
// ::ffff:127.0.0.1 dotted OR ::ffff:7f00:1 hex — the URL parser normalizes to the latter).
function isBlockedIp(ip: string): boolean {
  const type = net.isIP(ip)
  if (type === 4) return isBlockedIpv4(ip)
  if (type === 6) {
    const groups = expandIpv6(ip)
    if (!groups) return true // unparseable -> reject
    // IPv4-mapped ::ffff:a.b.c.d — groups[0..4]=0, group[5]=0xffff. Check the embedded v4.
    if (groups.slice(0, 5).every(g => g === 0) && groups[5] === 0xffff) {
      const a = groups[6] >> 8, b = groups[6] & 0xff, c = groups[7] >> 8, d = groups[7] & 0xff
      return isBlockedIpv4(`${a}.${b}.${c}.${d}`)
    }
    if (groups.every(g => g === 0)) return true // :: unspecified
    if (groups.slice(0, 7).every(g => g === 0) && groups[7] === 1) return true // ::1 loopback
    if ((groups[0] & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
    if ((groups[0] & 0xfe00) === 0xfc00) return true // fc00::/7 unique-local (ULA)
    return false
  }
  return true // not a parseable IP literal -> reject
}

// Expand any valid IPv6 string into its 8 16-bit groups, or null if malformed. Handles '::'
// compression and a trailing IPv4 dotted-quad. Input is assumed net.isIP()===6 (already valid).
function expandIpv6(ip: string): number[] | null {
  let s = ip.toLowerCase()
  // Convert a trailing IPv4 dotted-quad (e.g. ::ffff:1.2.3.4) into two hex groups.
  const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/)
  if (v4) {
    const p = v4[1].split('.').map(n => parseInt(n, 10))
    if (p.length !== 4 || p.some(n => Number.isNaN(n) || n < 0 || n > 255)) return null
    s = s.slice(0, v4.index) + ((p[0] << 8) | p[1]).toString(16) + ':' + ((p[2] << 8) | p[3]).toString(16)
  }
  const halves = s.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : []
  const fill = 8 - head.length - tail.length
  if (halves.length === 1) {
    if (head.length !== 8) return null
    return head.map(h => parseInt(h || '0', 16))
  }
  if (fill < 0) return null
  const groups = [...head, ...Array(fill).fill('0'), ...tail].map(h => parseInt(h || '0', 16))
  return groups.length === 8 ? groups : null
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map(n => parseInt(n, 10))
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return true
  const [a, b] = parts
  if (a === 0) return true // 0.0.0.0/8 "this network"
  if (a === 127) return true // 127.0.0.0/8 loopback
  if (a === 10) return true // 10.0.0.0/8 private
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true // 192.168.0.0/16 private
  if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local (incl. 169.254.169.254 metadata)
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 CGNAT
  if (a >= 224) return true // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved + 255.255.255.255
  return false
}

// Validate a URL string for SSRF before we ever fetch it: must be http(s), must parse, and EVERY
// IP its hostname resolves to must be public. Throws on any failure (callers treat that as "off").
//
// NOTE (residual risk, accepted for v1): this resolves-then-fetch, so a DNS-rebinding attacker could
// in theory return a public IP here and a private one to the actual fetch (a TOCTOU window). We accept
// it because owners are semi-trusted (it is THEIR own calendar URL) and nothing fetched is ever
// reflected back to a client — only derived busy time-blocks leave this module. A literal-IP host is
// re-checked directly; a hostname is checked against all resolved addresses.
async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('invalid url')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('bad protocol')

  const host = url.hostname.replace(/^\[|\]$/g, '') // strip IPv6 brackets

  // If the host is already an IP literal, check it directly (no DNS needed). The ::ffff: test also
  // covers the IPv4-mapped dotted-quad form that net.isIP doesn't classify as an IP.
  if (net.isIP(host) !== 0 || /^::ffff:\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (isBlockedIp(host)) throw new Error('blocked ip')
    return url
  }

  // Otherwise resolve ALL addresses and reject if ANY is non-public.
  const results = await dns.lookup(host, { all: true })
  if (!results.length) throw new Error('no dns')
  for (const r of results) {
    if (isBlockedIp(r.address)) throw new Error('blocked ip')
  }
  return url
}

// Lightweight SAVE-TIME validation: returns the normalized URL string if it is a syntactically
// valid http(s) URL that isn't an obviously-internal host, else null. This is a fast guard for the
// owner's settings form — the REAL SSRF defense (DNS resolution + per-redirect re-check) happens in
// safeFetchIcs at fetch time. Synchronous (no DNS) so it's cheap on save.
export function validateExternalIcalUrl(raw: string): string | null {
  const trimmed = (raw || '').trim()
  if (!trimmed) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!host) return null
  // Reject obvious local/internal names + any literal IP in a blocked range.
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return null
  }
  // Check literal IPs. net.isIP catches plain v4/v6; the explicit ::ffff: test also catches the
  // IPv4-mapped dotted-quad form (e.g. ::ffff:127.0.0.1) that net.isIP doesn't classify as an IP.
  const isIpLiteral = net.isIP(host) !== 0 || /^::ffff:\d+\.\d+\.\d+\.\d+$/.test(host)
  if (isIpLiteral && isBlockedIp(host)) return null
  return url.toString()
}

// SSRF-safe fetch of an iCal body. Manually follows redirects (capped), re-validating each hop's
// host through the same IP check so a redirect can't bounce us to an internal target. Enforces a
// timeout and a body-size cap. Returns the text, or null on any failure. Never throws.
async function safeFetchIcs(rawUrl: string): Promise<string | null> {
  let current = rawUrl
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const url = await assertPublicUrl(current)

      const controller = new AbortController()
      // ONE deadline for the WHOLE hop — connect + headers + BODY — cleared only when the hop fully
      // finishes (success, redirect, or early return). fetch() resolves at headers, so if the timer
      // were cleared then, a slow-drip body (slowloris) would hang the public booking page forever.
      // Keeping it armed means abort() fires mid-read, reader.read() rejects, and we return null.
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      try {
        const res = await fetch(url.toString(), {
          method: 'GET',
          redirect: 'manual', // we follow by hand so we can re-validate each Location host
          signal: controller.signal,
          headers: { 'User-Agent': USER_AGENT, Accept: 'text/calendar, text/plain, */*' },
        })

        // Manual redirect handling: re-validate the next host before following.
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get('location')
          if (!loc) return null
          current = new URL(loc, url.toString()).toString() // resolve relative redirects
          continue
        }

        if (!res.ok || !res.body) return null

        // Stream with a hard byte cap so a huge/hostile body can't exhaust memory.
        const reader = res.body.getReader()
        const chunks: Uint8Array[] = []
        let total = 0
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) {
            total += value.length
            if (total > MAX_BYTES) {
              await reader.cancel().catch(() => {})
              return null
            }
            chunks.push(value)
          }
        }
        const buf = new Uint8Array(total)
        let offset = 0
        for (const c of chunks) {
          buf.set(c, offset)
          offset += c.length
        }
        return new TextDecoder('utf-8').decode(buf)
      } finally {
        clearTimeout(timer)
      }
    }
    return null // too many redirects
  } catch {
    return null // bad URL, blocked IP, timeout, network error — all no-op
  }
}

// ---- iCal -> busy ranges ---------------------------------------------------

// Read the YYYY-MM-DD calendar date of an all-day event from a node-ical Date. node-ical builds
// date-only values at LOCAL midnight of the calendar day, so the LOCAL Y/M/D fields are the intended
// date on any server timezone (using getUTC* would shift the day on non-UTC hosts).
function allDayDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// Add `days` whole days to a 'YYYY-MM-DD' string (calendar arithmetic, tz-neutral).
function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`
}

// Turn one VEVENT into zero or more UTC busy ranges within [windowStart, windowEnd].
// - All-day (single or multi-day): each covered day becomes that day's 00:00–24:00 in the OWNER tz.
// - Recurring (RRULE): expand occurrences in-window; each gets the event's duration.
// - Plain timed: the single [start, end] instant range (node-ical already gives correct UTC).
function eventToRanges(
  ev: ical.VEvent,
  tz: string,
  windowStart: Date,
  windowEnd: Date,
): BusyRange[] {
  const out: BusyRange[] = []
  if (!ev.start) return out

  const isAllDay = ev.datetype === 'date'

  if (isAllDay) {
    // How many whole days the all-day event spans (DTEND is exclusive for date-only events;
    // default to 1 day if missing). Used for both the one-off and recurring cases.
    const startDate0 = allDayDate(ev.start)
    const endDate0 = ev.end ? allDayDate(ev.end) : addDays(startDate0, 1)
    let spanDays = 0
    for (let d = startDate0; d < endDate0; d = addDays(d, 1)) spanDays++
    if (spanDays < 1) spanDays = 1

    // Block `spanDays` whole owner-local days from `firstDate` (each as 00:00–24:00 in the owner tz).
    const blockSpan = (firstDate: string) => {
      for (let i = 0; i < spanDays; i++) {
        const day = addDays(firstDate, i)
        const dayStart = ownerLocalToUtc(day, '00:00', tz)
        const dayEnd = ownerLocalToUtc(addDays(day, 1), '00:00', tz) // next-day midnight = 24:00 today
        if (dayEnd > windowStart && dayStart < windowEnd) out.push({ startUtc: dayStart, endUtc: dayEnd })
        if (out.length > 1000) return
      }
    }

    if (ev.rrule) {
      // node-ical attaches an RRULE to date-only events too, so a RECURRING all-day block (a weekly
      // "away", a standing retreat) must expand every in-window occurrence — otherwise only the FIRST
      // date would block and later weeks would stay bookable (double-booking risk).
      let occurrences: Date[] = []
      try {
        occurrences = ev.rrule.between(windowStart, windowEnd, true)
      } catch {
        occurrences = []
      }
      const exdate = ev.exdate || {}
      const excluded = new Set(Object.values(exdate).map(d => d.getTime()))
      for (const occ of occurrences.slice(0, 1000)) {
        if (excluded.has(occ.getTime())) continue
        blockSpan(allDayDate(occ)) // date-only occurrences arrive at host-local midnight -> local Y/M/D
        if (out.length > 1000) break
      }
      return out
    }

    blockSpan(startDate0)
    return out
  }

  const durMs =
    ev.end && ev.start ? Math.max(0, ev.end.getTime() - ev.start.getTime()) : 60 * 60000 // default 1h

  if (ev.rrule) {
    // Expand only the occurrences that fall in-window (inclusive of the bounds).
    let occurrences: Date[] = []
    try {
      occurrences = ev.rrule.between(windowStart, windowEnd, true)
    } catch {
      occurrences = []
    }
    // EXDATE: node-ical exposes excluded instances on ev.exdate keyed by date.
    const exdate = ev.exdate || {}
    const excluded = new Set(Object.values(exdate).map(d => d.getTime()))
    for (const occ of occurrences.slice(0, 1000)) {
      if (excluded.has(occ.getTime())) continue
      const endUtc = new Date(occ.getTime() + durMs)
      if (endUtc > windowStart && occ < windowEnd) out.push({ startUtc: occ, endUtc })
    }
    return out
  }

  // Plain one-off timed event. node-ical already resolved TZID -> correct UTC instants.
  const startUtc = ev.start
  const endUtc = ev.end && ev.end > ev.start ? ev.end : new Date(startUtc.getTime() + durMs)
  if (endUtc > windowStart && startUtc < windowEnd) out.push({ startUtc, endUtc })
  return out
}

// ---- public entry point ----------------------------------------------------

// Tiny in-memory TTL cache keyed by URL, so concurrent / repeated booking-page loads don't refetch
// the same calendar. Per-process (resets on redeploy) — fine for this best-effort feature.
const cache = new Map<string, { at: number; ranges: BusyRange[] }>()

// Resolve the site owner's external iCal URL (server-side, service-role), fetch + parse it SSRF-safely,
// and return the busy UTC ranges within [now, now+windowDays]. Returns [] if no URL is set or on ANY
// error. The URL itself NEVER leaves this function — only the derived ranges.
export async function getOwnerBusyRanges(slug: string, windowDays: number): Promise<BusyRange[]> {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) return []

    // slug -> owner_id (service-role; get_booking_page deliberately never exposes the owner id/url).
    const { data: site, error: siteErr } = await admin
      .from('sites')
      .select('owner_id')
      .eq('slug', slug)
      .limit(1)
      .maybeSingle()
    if (siteErr || !site?.owner_id) return []

    const { data: settings, error: setErr } = await admin
      .from('booking_settings')
      .select('timezone, external_ical_url')
      .eq('owner_id', site.owner_id)
      .maybeSingle()
    if (setErr || !settings) return []

    const url = (settings.external_ical_url || '').trim()
    if (!url) return [] // dormant: no calendar configured -> no extra busy ranges
    const tz = settings.timezone || 'UTC'

    // Window: [now, now + windowDays].
    const days = Math.min(180, Math.max(1, windowDays || 30))
    const windowStart = new Date()
    const windowEnd = new Date(windowStart.getTime() + days * 86400000)

    // Cache hit?
    const hit = cache.get(url)
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      // Re-clip the cached ranges to the (possibly different) window before returning.
      return hit.ranges.filter(r => r.endUtc > windowStart && r.startUtc < windowEnd)
    }

    const body = await safeFetchIcs(url)
    if (!body) return []

    let parsed: ical.CalendarResponse
    try {
      // Lazily load node-ical only when we actually have a calendar to parse. If it can't be loaded
      // at runtime (e.g. not traced into the standalone server), this throws here and we degrade to
      // no busy-blocking — the booking page still renders — rather than crashing the module on import.
      const mod: { default?: typeof ical } & Record<string, unknown> = await import('node-ical')
      const nodeIcal = (mod.default ?? mod) as typeof ical
      parsed = nodeIcal.sync.parseICS(body)
    } catch {
      return []
    }

    const ranges: BusyRange[] = []
    for (const key of Object.keys(parsed)) {
      const comp = parsed[key]
      if (!comp || comp.type !== 'VEVENT') continue
      const ev = comp as ical.VEvent
      // Skip cancelled/transparent (free) events — they don't block time.
      if (ev.status === 'CANCELLED') continue
      if (ev.transparency === 'TRANSPARENT') continue
      try {
        ranges.push(...eventToRanges(ev, tz, windowStart, windowEnd))
      } catch {
        // one malformed event must not break the rest
      }
      if (ranges.length > 5000) break // overall safety cap
    }

    cache.set(url, { at: Date.now(), ranges })
    return ranges
  } catch {
    return [] // never throw — busy-blocking simply no-ops
  }
}

// ---- busy ranges -> `taken` slots (owner-local) ----------------------------

// A UTC instant expressed as owner-local wall clock: the calendar date 'YYYY-MM-DD' and the minutes
// from that day's midnight, both in IANA zone `tz`. Same Intl primitive as slots.ts#nowInTz.
function utcToOwnerLocal(utc: Date, tz: string): { date: string; minutes: number } {
  try {
    const dtf = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    const parts: Record<string, string> = {}
    for (const p of dtf.formatToParts(utc)) parts[p.type] = p.value
    let hour = parseInt(parts.hour, 10) || 0
    if (hour === 24) hour = 0
    return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: hour * 60 + (parseInt(parts.minute, 10) || 0) }
  } catch {
    return {
      date: `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`,
      minutes: utc.getUTCHours() * 60 + utc.getUTCMinutes(),
    }
  }
}

// Convert UTC busy ranges into the SAME `taken` shape computeAvailableDays consumes —
// { date:'YYYY-MM-DD', time:'HH:MM', durationMin } in the OWNER timezone. A range that spans
// midnight (or several days) is split into one entry per owner-local day it covers, each clipped
// to that day's [start, 24:00). Slot generation only checks interval overlap, so this excludes any
// bookable slot that touches an external busy event.
export function busyRangesToTaken(ranges: BusyRange[], tz: string): TakenSlot[] {
  const out: TakenSlot[] = []
  for (const r of ranges) {
    if (!(r.endUtc > r.startUtc)) continue
    const start = utcToOwnerLocal(r.startUtc, tz)
    const end = utcToOwnerLocal(r.endUtc, tz)

    if (start.date === end.date) {
      const dur = Math.max(1, end.minutes - start.minutes)
      out.push({ date: start.date, time: minutesToHHMM(start.minutes), durationMin: dur })
      continue
    }

    // Spans >=1 midnight: first day from start -> 24:00.
    out.push({ date: start.date, time: minutesToHHMM(start.minutes), durationMin: Math.max(1, 1440 - start.minutes) })
    // Whole days strictly between -> full 00:00–24:00.
    let day = nextDay(start.date)
    let guard = 0
    while (day < end.date && guard++ < 400) {
      out.push({ date: day, time: '00:00', durationMin: 1440 })
      day = nextDay(day)
    }
    // Last day from 00:00 -> end (only if the range actually reaches into it).
    if (end.minutes > 0) {
      out.push({ date: end.date, time: '00:00', durationMin: end.minutes })
    }
  }
  return out
}

function minutesToHHMM(min: number): string {
  const m = Math.max(0, Math.min(1439, min))
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`
}

function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + 1))
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`
}
