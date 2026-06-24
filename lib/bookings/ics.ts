import { pad2 } from './types'

// Build a valid iCalendar (RFC 5545) VEVENT for an appointment, plus a DST-aware helper
// to turn an owner-local wall-clock slot into the UTC instants the VEVENT needs.
//
// SERVER-SAFE + pure: no I/O, no secrets. Used by lib/bookings/notify.ts.

// ---- timezone: owner-local wall clock -> UTC instant (DST-aware) ----

// The UTC offset (in minutes, east-of-UTC positive) that timezone `tz` is at the instant
// `utcDate`. Same Intl primitive as slots.ts#nowInTz: format the instant AS the target zone,
// read back the wall-clock fields, and diff them against the same instant read as UTC. The
// difference IS the offset in effect at that instant — so it is correct across DST.
function tzOffsetMinutes(utcDate: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts: Record<string, string> = {}
  for (const p of dtf.formatToParts(utcDate)) parts[p.type] = p.value
  let hour = parseInt(parts.hour, 10) || 0
  if (hour === 24) hour = 0
  // Reconstruct the wall-clock the zone shows for this instant, as if it were UTC.
  const asUtc = Date.UTC(
    parseInt(parts.year, 10),
    (parseInt(parts.month, 10) || 1) - 1,
    parseInt(parts.day, 10) || 1,
    hour,
    parseInt(parts.minute, 10) || 0,
    parseInt(parts.second, 10) || 0,
  )
  // (zone wall clock) - (true UTC) = the zone's offset at this instant.
  return Math.round((asUtc - utcDate.getTime()) / 60000)
}

// Convert an owner-local wall-clock time (slot_date 'YYYY-MM-DD' + slot_time 'HH:MM',
// interpreted in IANA timezone `tz`) to the matching UTC Date. DST-aware: we first guess
// the instant by treating the wall clock AS UTC, read the zone's offset THERE, subtract it,
// then re-read the offset at the corrected instant and adjust once more. The second pass
// settles DST boundary cases (where the offset just before/after the wall time differs).
export function ownerLocalToUtc(date: string, time: string, tz: string): Date {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  // The wall-clock fields treated as if they were already UTC — our starting guess.
  const wallAsUtcMs = Date.UTC(y, (mo || 1) - 1, d || 1, h || 0, mi || 0, 0)

  // First pass: offset at the guessed instant. UTC = wall - offset.
  const off1 = tzOffsetMinutes(new Date(wallAsUtcMs), tz)
  let utcMs = wallAsUtcMs - off1 * 60000
  // Second pass: re-measure the offset at the corrected instant and re-correct. Handles the
  // rare case where the naive guess fell on the wrong side of a DST transition.
  const off2 = tzOffsetMinutes(new Date(utcMs), tz)
  if (off2 !== off1) utcMs = wallAsUtcMs - off2 * 60000
  return new Date(utcMs)
}

// Compute the UTC start + end instants for an appointment slot in the owner's timezone.
export function appointmentUtcRange(
  slotDate: string,
  slotTime: string,
  durationMin: number,
  tz: string,
): { startUtc: Date; endUtc: Date } {
  const startUtc = ownerLocalToUtc(slotDate, slotTime, tz)
  const dur = durationMin && durationMin > 0 ? durationMin : 60
  const endUtc = new Date(startUtc.getTime() + dur * 60000)
  return { startUtc, endUtc }
}

// ---- iCalendar serialization ----

// Format a Date as an iCalendar UTC timestamp: YYYYMMDDTHHMMSSZ.
function toIcsUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  )
}

// Escape a text value per RFC 5545 §3.3.11: backslash, semicolon, comma, and newlines.
function escapeText(s: string): string {
  return (s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

// Fold a content line to <=75 OCTETS per RFC 5545 §3.1 (continuation lines start with a single
// space, itself 1 octet). Measured in UTF-8 bytes — so multi-byte characters (accented names,
// em-dashes, emoji) never push a line over the limit — and we break only on code-point
// boundaries, never mid-character. (for…of iterates by code point, so surrogate pairs stay whole.)
function foldLine(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const out: string[] = []
  let seg = ''
  let segBytes = 0
  let first = true
  for (const ch of line) {
    const chBytes = enc.encode(ch).length
    const budget = first ? 75 : 74 // continuations spend 1 octet on the leading space
    if (segBytes + chBytes > budget) {
      out.push(first ? seg : ' ' + seg)
      first = false
      seg = ch
      segBytes = chBytes
    } else {
      seg += ch
      segBytes += chBytes
    }
  }
  if (seg.length) out.push(first ? seg : ' ' + seg)
  return out.join('\r\n')
}

export interface BuildIcsInput {
  uid: string
  title: string
  description: string
  startUtc: Date
  endUtc: Date
  organizerEmail: string
  organizerName?: string
  attendeeEmail: string
  attendeeName?: string
  location?: string
}

// Build a complete VCALENDAR with a single confirmed VEVENT. Lines are CRLF-terminated and
// folded per spec. Text fields are RFC-5545 escaped.
export function buildAppointmentIcs(input: BuildIcsInput): string {
  const dtstamp = toIcsUtc(new Date())
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Anima Temple//Bookings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeText(input.uid)}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${toIcsUtc(input.startUtc)}`,
    `DTEND:${toIcsUtc(input.endUtc)}`,
    `SUMMARY:${escapeText(input.title)}`,
    `DESCRIPTION:${escapeText(input.description)}`,
  ]
  if (input.location) lines.push(`LOCATION:${escapeText(input.location)}`)
  lines.push(
    input.organizerName
      ? `ORGANIZER;CN=${escapeText(input.organizerName)}:mailto:${input.organizerEmail}`
      : `ORGANIZER:mailto:${input.organizerEmail}`,
  )
  lines.push(
    input.attendeeName
      ? `ATTENDEE;CN=${escapeText(input.attendeeName)};RSVP=TRUE:mailto:${input.attendeeEmail}`
      : `ATTENDEE;RSVP=TRUE:mailto:${input.attendeeEmail}`,
  )
  lines.push('STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR')

  return lines.map(foldLine).join('\r\n') + '\r\n'
}
