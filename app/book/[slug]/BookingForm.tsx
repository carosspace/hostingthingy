'use client'

import { useMemo, useState } from 'react'
import { requestBookingSlotAction } from './actions'
import { computeAvailableDays } from '@/lib/bookings/slots'
import { formatPrice, formatDayLabel, formatTimeLabel, type BookingPageData } from '@/lib/bookings/types'
import { DEFAULT_BOOKING_LAYOUT, type BookingLayout } from '@/lib/sites/types'

type Theme = { bg: string; text: string; muted: string; accent: string }

// Split a 'YYYY-MM-DD' date into the three parts shown on a day card (weekday abbrev,
// day number, month abbrev) — timezone-neutral, locale-aware, no fragile string parsing.
function dayCardParts(date: string): { weekday: string; day: string; month: string } {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const fmt = (opt: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, { ...opt, timeZone: 'UTC' }).format(dt)
  return { weekday: fmt({ weekday: 'short' }), day: fmt({ day: 'numeric' }), month: fmt({ month: 'short' }) }
}

// pad a number to a 2-digit string (local, to avoid importing the bookings helper into the client bundle).
const pad2 = (n: number) => (n < 10 ? '0' + n : String(n))

// The shared logic + handlers every layout uses. Computed ONCE here, then handed to a
// presentational layout — so the submit/payment/redirect behaviour can never drift.
function useBookingCore(slug: string, data: BookingPageData, paymentsLive: boolean) {
  const services = data.services
  const [serviceId, setServiceId] = useState(services[0]?.serviceId ?? '')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const service = services.find(s => s.serviceId === serviceId) ?? services[0]
  const isPaid = (service?.priceCents ?? 0) > 0 && paymentsLive
  const days = useMemo(
    () => computeAvailableDays(data.availability, data.taken, data.settings, service?.durationMin ?? 0),
    [data, service?.durationMin],
  )
  const selectedDay = days.find(d => d.date === date)
  const validTime = selectedDay?.slots.includes(time) ? time : ''
  const canSubmit = Boolean(serviceId && date && validTime) && !submitting

  function pickService(id: string) {
    setServiceId(id)
    setDate('')
    setTime('')
  }
  function pickDate(d: string) {
    setDate(d)
    setTime('')
  }

  // Submit through the server action, then act on what it returns: a Stripe Checkout URL (paid
  // services) -> redirect to pay; { ok } (free services) -> the thank-you page; { error } -> the
  // matching error on the booking page. Mirrors the old redirect behaviour for the free path.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const fd = new FormData(e.currentTarget)
      const res = await requestBookingSlotAction(fd)
      if ('checkoutUrl' in res) {
        window.location.assign(res.checkoutUrl)
        return // keep the spinner while the browser navigates to Stripe
      }
      if ('ok' in res) {
        window.location.assign(`/book/${slug}?sent=1`)
        return
      }
      const code = res.error === 'taken' ? 'taken' : res.error === 'payments_off' ? 'payments_off' : '1'
      window.location.assign(`/book/${slug}?error=${code}`)
    } catch {
      window.location.assign(`/book/${slug}?error=1`)
    } finally {
      setSubmitting(false)
    }
  }

  return {
    services, service, serviceId, date, time, validTime, submitting,
    isPaid, days, selectedDay, canSubmit,
    pickService, pickDate, setTime, handleSubmit,
  }
}

type Core = ReturnType<typeof useBookingCore>

// ---- Shared presentational pieces (theme tokens identical across every layout) ----------

function sectionLabel(accent: string) {
  return { fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' as const, color: accent }
}
function fieldStyle(theme: Theme) {
  return { background: `${theme.accent}0d`, color: theme.text, border: `1px solid ${theme.accent}33` }
}

// The service radio list (the original 'minimal' presentation: a stacked list of labels).
function ServiceRadioList({ core, theme }: { core: Core; theme: Theme }) {
  const { services, serviceId, pickService } = core
  const accent = theme.accent
  if (services.length <= 1) return null
  return (
    <div className="space-y-3">
      {services.map(s => {
        const on = s.serviceId === serviceId
        return (
          <label
            key={s.serviceId}
            className="flex items-start gap-3 cursor-pointer p-5 transition-colors"
            style={{
              borderRadius: 12,
              background: on ? `${accent}10` : 'transparent',
              border: `${on ? 1.5 : 1}px solid ${accent}${on ? '' : '2e'}`,
            }}
          >
            <input
              type="radio"
              name="serviceChoice"
              checked={on}
              onChange={() => pickService(s.serviceId)}
              className="mt-1"
              style={{ accentColor: accent }}
            />
            <div className="flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-body" style={{ color: theme.text, fontSize: 15 }}>{s.name}</span>
                <span className="font-body whitespace-nowrap" style={{ color: accent, fontSize: 13 }}>
                  {s.durationMin} min · {formatPrice(s.priceCents, s.currency)}
                </span>
              </div>
              {s.description && <p className="font-body mt-1.5" style={{ color: theme.muted, fontSize: 13, lineHeight: 1.5 }}>{s.description}</p>}
            </div>
          </label>
        )
      })}
    </div>
  )
}

// Rich, tappable service cards (the 'cards' layout). Same selection model as the radio list.
function ServiceCards({ core, theme }: { core: Core; theme: Theme }) {
  const { services, serviceId, pickService } = core
  const accent = theme.accent
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {services.map(s => {
        const on = s.serviceId === serviceId
        return (
          <button
            key={s.serviceId}
            type="button"
            onClick={() => pickService(s.serviceId)}
            aria-pressed={on}
            className="text-left transition-colors h-full flex flex-col"
            style={{
              padding: 20,
              borderRadius: 14,
              background: on ? `${accent}12` : 'transparent',
              border: `${on ? 1.5 : 1}px solid ${accent}${on ? '' : '2e'}`,
            }}
          >
            <span className="font-display italic" style={{ color: theme.text, fontSize: 20, lineHeight: 1.15 }}>{s.name}</span>
            <span className="font-label mt-2" style={{ ...sectionLabel(accent), fontSize: 10 }}>
              {s.durationMin} min · {formatPrice(s.priceCents, s.currency)}
            </span>
            {s.description && <p className="font-body mt-3" style={{ color: theme.muted, fontSize: 13, lineHeight: 1.5 }}>{s.description}</p>}
          </button>
        )
      })}
    </div>
  )
}

// A compact summary of the selected service (used in the 'split' layout's left column).
function ServiceSummary({ core, theme }: { core: Core; theme: Theme }) {
  const { service } = core
  const accent = theme.accent
  if (!service) return null
  return (
    <div>
      <p className="font-label" style={sectionLabel(accent)}>Your session</p>
      <h2 className="font-display italic mt-3" style={{ color: theme.text, fontSize: 28, lineHeight: 1.15 }}>{service.name}</h2>
      <p className="font-label mt-3" style={{ ...sectionLabel(accent), fontSize: 10 }}>
        {service.durationMin} min · {formatPrice(service.priceCents, service.currency)}
      </p>
      {service.description && (
        <p className="font-body mt-4" style={{ color: theme.muted, fontSize: 14, lineHeight: 1.6 }}>{service.description}</p>
      )}
    </div>
  )
}

// The horizontal day-pill strip (the 'minimal'/'cards'/'split' day picker).
function DayPills({ core, theme }: { core: Core; theme: Theme }) {
  const { days, date, pickDate } = core
  const accent = theme.accent
  return (
    <div>
      <p className="font-label" style={sectionLabel(accent)}>Choose a day</p>
      {days.length === 0 ? (
        <p className="font-body mt-4" style={{ color: theme.muted, fontSize: 14 }}>
          No open times right now — please check back soon.
        </p>
      ) : (
        <div className="flex gap-2.5 overflow-x-auto pb-2 mt-4">
          {days.map(d => {
            const on = d.date === date
            const { weekday: wd, day: dayNum, month: mo } = dayCardParts(d.date)
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => pickDate(d.date)}
                aria-pressed={on}
                className="shrink-0 flex flex-col items-center justify-center transition-colors"
                style={{
                  minWidth: 60,
                  padding: '12px 12px',
                  borderRadius: 12,
                  background: on ? accent : 'transparent',
                  border: `1px solid ${accent}${on ? '' : '2e'}`,
                }}
              >
                <span className="font-label" style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: on ? theme.bg : theme.muted }}>
                  {wd}
                </span>
                <span className="font-body" style={{ fontSize: 18, marginTop: 2, color: on ? theme.bg : theme.text }}>
                  {dayNum}
                </span>
                <span className="font-label" style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: on ? theme.bg : theme.muted, opacity: 0.8 }}>
                  {mo}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// A real month grid built from the SAME computeAvailableDays output (the 'calendar' layout).
// Only days present in `days` (i.e. with at least one open slot) are clickable; every other
// cell — empty leading/trailing blanks, days with no open slots, past/out-of-window days — is
// rendered disabled/dimmed. The prev/next control is bounded to the first/last available month,
// so the visitor can never wander outside the actual booking window.
function MonthCalendar({ core, theme }: { core: Core; theme: Theme }) {
  const { days, date, pickDate } = core
  const accent = theme.accent

  // The set of bookable dates + the month bounds, both derived from `days`.
  const { available, firstMonth, lastMonth } = useMemo(() => {
    const set = new Set(days.map(d => d.date))
    const toMonth = (s: string) => { const [y, m] = s.split('-').map(Number); return y * 12 + (m - 1) }
    if (!days.length) {
      // No open days: fall back to the current month so the grid still renders sensibly.
      const now = new Date()
      const cur = now.getFullYear() * 12 + now.getMonth()
      return { available: set, firstMonth: cur, lastMonth: cur }
    }
    const months = days.map(d => toMonth(d.date))
    return { available: set, firstMonth: Math.min(...months), lastMonth: Math.max(...months) }
  }, [days])

  // The first available day's month is where we open the calendar.
  const initialMonth = useMemo(() => (days[0] ? (() => { const [y, m] = days[0].date.split('-').map(Number); return y * 12 + (m - 1) })() : firstMonth), [days, firstMonth])
  const [viewMonth, setViewMonth] = useState(initialMonth)
  const month = Math.min(lastMonth, Math.max(firstMonth, viewMonth))
  const year = Math.floor(month / 12)
  const monthIndex = month % 12

  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, monthIndex, 1)))

  // Build the 6x7 cell grid for this month: leading blanks for the weekday offset, then each day.
  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() // 0=Sun
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${year}-${pad2(monthIndex + 1)}-${pad2(d)}`)

  const weekdayHeads = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const canPrev = month > firstMonth
  const canNext = month < lastMonth

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="font-label" style={sectionLabel(accent)}>Choose a day</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMonth(month - 1)}
            disabled={!canPrev}
            aria-label="Previous month"
            className="transition-opacity"
            style={{
              width: 32, height: 32, borderRadius: 8, lineHeight: '30px', textAlign: 'center',
              color: theme.text, border: `1px solid ${accent}2e`,
              opacity: canPrev ? 1 : 0.3, cursor: canPrev ? 'pointer' : 'not-allowed',
            }}
          >
            ‹
          </button>
          <span className="font-body" style={{ color: theme.text, fontSize: 14, minWidth: 130, textAlign: 'center' }}>{monthLabel}</span>
          <button
            type="button"
            onClick={() => setViewMonth(month + 1)}
            disabled={!canNext}
            aria-label="Next month"
            className="transition-opacity"
            style={{
              width: 32, height: 32, borderRadius: 8, lineHeight: '30px', textAlign: 'center',
              color: theme.text, border: `1px solid ${accent}2e`,
              opacity: canNext ? 1 : 0.3, cursor: canNext ? 'pointer' : 'not-allowed',
            }}
          >
            ›
          </button>
        </div>
      </div>

      {days.length === 0 ? (
        <p className="font-body" style={{ color: theme.muted, fontSize: 14 }}>
          No open times right now — please check back soon.
        </p>
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {weekdayHeads.map(w => (
            <div key={w} className="font-label text-center" style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, paddingBottom: 4 }}>
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`b${i}`} aria-hidden="true" />
            const open = available.has(d)
            const on = d === date
            const dayNum = Number(d.split('-')[2])
            return (
              <button
                key={d}
                type="button"
                disabled={!open}
                onClick={() => open && pickDate(d)}
                aria-pressed={on}
                aria-disabled={!open}
                className="font-body transition-colors"
                style={{
                  aspectRatio: '1 / 1',
                  borderRadius: 9,
                  fontSize: 14,
                  background: on ? accent : open ? `${accent}0d` : 'transparent',
                  color: on ? theme.bg : open ? theme.text : theme.muted,
                  border: `1px solid ${accent}${on ? '' : open ? '2e' : '14'}`,
                  opacity: open ? 1 : 0.4,
                  cursor: open ? 'pointer' : 'not-allowed',
                }}
              >
                {dayNum}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// The time grid (shown once a day is selected). Identical across every layout.
function TimeGrid({ core, theme }: { core: Core; theme: Theme }) {
  const { selectedDay, time, setTime } = core
  const accent = theme.accent
  if (!selectedDay) return null
  return (
    <div>
      <p className="font-label" style={sectionLabel(accent)}>Choose a time</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mt-4">
        {selectedDay.slots.map(t => {
          const on = t === time
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTime(t)}
              aria-pressed={on}
              className="font-body transition-colors"
              style={{
                padding: '11px 0',
                borderRadius: 10,
                fontSize: 14,
                background: on ? accent : 'transparent',
                color: on ? theme.bg : theme.text,
                border: `1px solid ${accent}${on ? '' : '2e'}`,
              }}
            >
              {formatTimeLabel(t)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// The name/email/note fields. Identical across every layout.
function DetailsFields({ theme }: { theme: Theme }) {
  const accent = theme.accent
  const fs = fieldStyle(theme)
  return (
    <div>
      <p className="font-label" style={sectionLabel(accent)}>Your details</p>
      <div className="space-y-3 mt-4">
        <input
          name="name"
          required
          placeholder="Your name"
          aria-label="Your name"
          className="w-full font-body outline-none"
          style={{ ...fs, padding: '12px 16px', borderRadius: 9 }}
        />
        <input
          name="email"
          type="email"
          required
          placeholder="Your email"
          aria-label="Your email"
          className="w-full font-body outline-none"
          style={{ ...fs, padding: '12px 16px', borderRadius: 9 }}
        />
        <textarea
          name="note"
          rows={3}
          placeholder="Anything you'd like to share (optional)"
          aria-label="Anything you'd like to share (optional)"
          className="w-full font-body outline-none resize-none"
          style={{ ...fs, padding: '12px 16px', borderRadius: 9 }}
        />
      </div>
    </div>
  )
}

// The submit button + the timezone/payment note. Identical copy rules across every layout.
function SubmitButton({ core, theme, data }: { core: Core; theme: Theme; data: BookingPageData }) {
  const { canSubmit, submitting, isPaid, date, validTime, service } = core
  const accent = theme.accent
  return (
    <div>
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full font-label transition-opacity"
        style={{
          background: accent,
          color: theme.bg,
          fontSize: 11,
          letterSpacing: 3,
          textTransform: 'uppercase',
          padding: 16,
          borderRadius: 11,
          opacity: canSubmit ? 1 : 0.45,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
        }}
      >
        {submitting
          ? isPaid
            ? 'Taking you to payment…'
            : 'Booking…'
          : date && validTime
            ? isPaid
              ? `Pay & book ${formatDayLabel(date)} at ${formatTimeLabel(validTime)}`
              : `Book ${formatDayLabel(date)} at ${formatTimeLabel(validTime)}`
            : 'Pick a day & time'}
      </button>

      <p className="font-body text-center mt-4" style={{ fontSize: 12, color: theme.muted }}>
        Times shown in {data.settings.timezone.replace(/_/g, ' ')}.
        {isPaid && service ? ` Payment of ${formatPrice(service.priceCents, service.currency)} is taken to confirm.` : ''}
      </p>
    </div>
  )
}

// The hidden inputs the server action reads. Bound to core state so every layout submits
// the exact same payload regardless of how the controls are arranged.
function HiddenFields({ core, slug }: { core: Core; slug: string }) {
  return (
    <>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="serviceId" value={core.serviceId} />
      <input type="hidden" name="slotDate" value={core.date} />
      <input type="hidden" name="slotTime" value={core.validTime} />
    </>
  )
}

// ---- The four layouts (structure only; identical behaviour + tokens) --------------------

function MinimalLayout({ core, theme, slug, data }: { core: Core; theme: Theme; slug: string; data: BookingPageData }) {
  return (
    <form onSubmit={core.handleSubmit} className="space-y-10">
      <HiddenFields core={core} slug={slug} />
      <ServiceRadioList core={core} theme={theme} />
      <DayPills core={core} theme={theme} />
      <TimeGrid core={core} theme={theme} />
      <DetailsFields theme={theme} />
      <SubmitButton core={core} theme={theme} data={data} />
    </form>
  )
}

function CalendarLayout({ core, theme, slug, data }: { core: Core; theme: Theme; slug: string; data: BookingPageData }) {
  return (
    <form onSubmit={core.handleSubmit} className="space-y-10">
      <HiddenFields core={core} slug={slug} />
      <ServiceRadioList core={core} theme={theme} />
      {/* key on serviceId so switching service reopens the calendar at that service's first open month */}
      <MonthCalendar key={core.serviceId} core={core} theme={theme} />
      <TimeGrid core={core} theme={theme} />
      <DetailsFields theme={theme} />
      <SubmitButton core={core} theme={theme} data={data} />
    </form>
  )
}

function CardsLayout({ core, theme, slug, data }: { core: Core; theme: Theme; slug: string; data: BookingPageData }) {
  return (
    <form onSubmit={core.handleSubmit} className="space-y-10">
      <HiddenFields core={core} slug={slug} />
      {core.services.length > 1 && (
        <div>
          <p className="font-label mb-4" style={sectionLabel(theme.accent)}>Choose a service</p>
          <ServiceCards core={core} theme={theme} />
        </div>
      )}
      <DayPills core={core} theme={theme} />
      <TimeGrid core={core} theme={theme} />
      <DetailsFields theme={theme} />
      <SubmitButton core={core} theme={theme} data={data} />
    </form>
  )
}

function SplitLayout({ core, theme, slug, data }: { core: Core; theme: Theme; slug: string; data: BookingPageData }) {
  return (
    <form onSubmit={core.handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12">
      <HiddenFields core={core} slug={slug} />
      {/* Left: an elegant summary + the service chooser (when there's more than one). */}
      <div className="space-y-8">
        <ServiceSummary core={core} theme={theme} />
        <ServiceRadioList core={core} theme={theme} />
      </div>
      {/* Right: the day + time picker, details and submit. */}
      <div className="space-y-10">
        <DayPills core={core} theme={theme} />
        <TimeGrid core={core} theme={theme} />
        <DetailsFields theme={theme} />
        <SubmitButton core={core} theme={theme} data={data} />
      </div>
    </form>
  )
}

export default function BookingForm({
  slug,
  data,
  theme,
  paymentsLive,
  layout = DEFAULT_BOOKING_LAYOUT,
}: {
  slug: string
  data: BookingPageData
  theme: Theme
  // True only when the server can actually charge (Stripe configured). Gates the "pay to confirm"
  // copy so a priced service never PROMISES payment the server won't take (it would be blocked).
  paymentsLive: boolean
  // The page LOOK — only the structure changes; behaviour/theme are identical across all four.
  layout?: BookingLayout
}) {
  const core = useBookingCore(slug, data, paymentsLive)
  const props = { core, theme, slug, data }
  switch (layout) {
    case 'calendar': return <CalendarLayout {...props} />
    case 'cards': return <CardsLayout {...props} />
    case 'split': return <SplitLayout {...props} />
    case 'minimal':
    default: return <MinimalLayout {...props} />
  }
}
