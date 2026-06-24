'use client'

import { useMemo, useState } from 'react'
import { requestBookingSlotAction } from './actions'
import { computeAvailableDays } from '@/lib/bookings/slots'
import { formatPrice, formatDayLabel, formatTimeLabel, type BookingPageData } from '@/lib/bookings/types'

// Split a 'YYYY-MM-DD' date into the three parts shown on a day card (weekday abbrev,
// day number, month abbrev) — timezone-neutral, locale-aware, no fragile string parsing.
function dayCardParts(date: string): { weekday: string; day: string; month: string } {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const fmt = (opt: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, { ...opt, timeZone: 'UTC' }).format(dt)
  return { weekday: fmt({ weekday: 'short' }), day: fmt({ day: 'numeric' }), month: fmt({ month: 'short' }) }
}

export default function BookingForm({
  slug,
  data,
  theme,
  paymentsLive,
}: {
  slug: string
  data: BookingPageData
  theme: { bg: string; text: string; muted: string; accent: string }
  // True only when the server can actually charge (Stripe configured). Gates the "pay to confirm"
  // copy so a priced service never PROMISES payment the server won't take (it would be blocked).
  paymentsLive: boolean
}) {
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

  const accent = theme.accent
  // A small label shared by every section ("CHOOSE A DAY", etc.).
  const labelStyle = { fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' as const, color: accent }
  // A subtle field treatment that works on any theme: a faint accent-tinted fill,
  // a low-alpha accent border, and the theme's own text colour (never a hardcoded grey).
  const fieldStyle = {
    background: `${accent}0d`,
    color: theme.text,
    border: `1px solid ${accent}33`,
  }

  function pickService(id: string) {
    setServiceId(id)
    setDate('')
    setTime('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="slotDate" value={date} />
      <input type="hidden" name="slotTime" value={validTime} />

      {services.length > 1 && (
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
      )}

      <div>
        <p className="font-label" style={labelStyle}>Choose a day</p>
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
                  onClick={() => {
                    setDate(d.date)
                    setTime('')
                  }}
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

      {selectedDay && (
        <div>
          <p className="font-label" style={labelStyle}>Choose a time</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mt-4">
            {selectedDay.slots.map(t => {
              const on = t === time
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTime(t)}
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
      )}

      <div>
        <p className="font-label" style={labelStyle}>Your details</p>
        <div className="space-y-3 mt-4">
          <input
            name="name"
            required
            placeholder="Your name"
            aria-label="Your name"
            className="w-full font-body outline-none"
            style={{ ...fieldStyle, padding: '12px 16px', borderRadius: 9 }}
          />
          <input
            name="email"
            type="email"
            required
            placeholder="Your email"
            aria-label="Your email"
            className="w-full font-body outline-none"
            style={{ ...fieldStyle, padding: '12px 16px', borderRadius: 9 }}
          />
          <textarea
            name="note"
            rows={3}
            placeholder="Anything you'd like to share (optional)"
            aria-label="Anything you'd like to share (optional)"
            className="w-full font-body outline-none resize-none"
            style={{ ...fieldStyle, padding: '12px 16px', borderRadius: 9 }}
          />
        </div>
      </div>

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
    </form>
  )
}
