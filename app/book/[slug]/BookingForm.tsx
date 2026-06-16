'use client'

import { useMemo, useState } from 'react'
import { requestBookingSlotAction } from './actions'
import { computeAvailableDays } from '@/lib/bookings/slots'
import { formatPrice, formatDayLabel, formatTimeLabel, type BookingPageData } from '@/lib/bookings/types'

export default function BookingForm({
  slug,
  data,
  theme,
}: {
  slug: string
  data: BookingPageData
  theme: { bg: string; text: string; muted: string; accent: string }
}) {
  const services = data.services
  const [serviceId, setServiceId] = useState(services[0]?.serviceId ?? '')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  const service = services.find(s => s.serviceId === serviceId) ?? services[0]
  const days = useMemo(
    () => computeAvailableDays(data.availability, data.taken, data.settings, service?.durationMin ?? 0),
    [data, service?.durationMin],
  )
  const selectedDay = days.find(d => d.date === date)
  const validTime = selectedDay?.slots.includes(time) ? time : ''
  const canSubmit = Boolean(serviceId && date && validTime)

  const accent = theme.accent
  const fieldStyle = { background: 'rgba(255,255,255,0.7)', color: '#222', border: '1px solid rgba(0,0,0,0.12)' }

  function pickService(id: string) {
    setServiceId(id)
    setDate('')
    setTime('')
  }

  return (
    <form action={requestBookingSlotAction} className="space-y-8">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="slotDate" value={date} />
      <input type="hidden" name="slotTime" value={validTime} />

      {services.length > 1 && (
        <div className="space-y-2">
          {services.map(s => (
            <label
              key={s.serviceId}
              className="flex items-start gap-3 cursor-pointer rounded-sm p-4"
              style={{ border: `1px solid ${accent}${s.serviceId === serviceId ? 'aa' : '40'}` }}
            >
              <input
                type="radio"
                name="serviceChoice"
                checked={s.serviceId === serviceId}
                onChange={() => pickService(s.serviceId)}
                className="mt-1"
                style={{ accentColor: accent }}
              />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-body" style={{ color: theme.text }}>{s.name}</span>
                  <span className="font-body text-sm" style={{ color: accent }}>
                    {s.durationMin} min · {formatPrice(s.priceCents, s.currency)}
                  </span>
                </div>
                {s.description && <p className="font-body text-sm mt-1" style={{ color: theme.muted }}>{s.description}</p>}
              </div>
            </label>
          ))}
        </div>
      )}

      <div>
        <p className="font-label" style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: accent }}>
          Choose a day
        </p>
        {days.length === 0 ? (
          <p className="font-body mt-3" style={{ color: theme.muted }}>
            No open times right now — please check back soon.
          </p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2 mt-3">
            {days.map(d => {
              const on = d.date === date
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => {
                    setDate(d.date)
                    setTime('')
                  }}
                  className="font-body shrink-0 whitespace-nowrap"
                  style={{
                    padding: '8px 14px',
                    borderRadius: 3,
                    fontSize: 14,
                    background: on ? accent : 'transparent',
                    color: on ? theme.bg : theme.text,
                    border: `1px solid ${accent}${on ? '' : '55'}`,
                  }}
                >
                  {formatDayLabel(d.date)}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selectedDay && (
        <div>
          <p className="font-label" style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: accent }}>
            Choose a time
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
            {selectedDay.slots.map(t => {
              const on = t === time
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTime(t)}
                  className="font-body"
                  style={{
                    padding: '9px 0',
                    borderRadius: 3,
                    fontSize: 14,
                    background: on ? accent : 'transparent',
                    color: on ? theme.bg : theme.text,
                    border: `1px solid ${accent}${on ? '' : '55'}`,
                  }}
                >
                  {formatTimeLabel(t)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <input name="name" required placeholder="Your name" className="w-full px-4 py-3 rounded-sm font-body outline-none" style={fieldStyle} />
        <input name="email" type="email" required placeholder="Your email" className="w-full px-4 py-3 rounded-sm font-body outline-none" style={fieldStyle} />
        <textarea name="note" rows={3} placeholder="Anything you'd like to share (optional)" className="w-full px-4 py-3 rounded-sm font-body outline-none resize-none" style={fieldStyle} />
      </div>

      <button
        disabled={!canSubmit}
        className="w-full font-label"
        style={{
          background: accent,
          color: theme.bg,
          fontSize: 11,
          letterSpacing: 3,
          textTransform: 'uppercase',
          padding: 14,
          borderRadius: 3,
          opacity: canSubmit ? 1 : 0.5,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
        }}
      >
        {canSubmit ? `Book ${formatDayLabel(date)} at ${formatTimeLabel(validTime)}` : 'Pick a day & time'}
      </button>

      <p className="font-body text-center" style={{ fontSize: 12, color: theme.muted }}>
        Times shown in {data.settings.timezone.replace(/_/g, ' ')}.
      </p>
    </form>
  )
}
