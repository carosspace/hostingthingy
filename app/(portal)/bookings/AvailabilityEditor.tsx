'use client'

import { useState } from 'react'
import { saveScheduleAction } from './actions'
import {
  WEEKDAYS,
  WEEKDAY_ORDER,
  minToHHMM,
  hhmmToMin,
  type AvailabilityWindow,
  type BookingSettings,
} from '@/lib/bookings/types'

interface Range {
  start: string
  end: string
}

const TIMEZONES = [
  'UTC',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Athens',
  'Africa/Cairo',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
]

function detectedTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

const timeInput =
  'bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-2 py-1.5 rounded-sm outline-none'
const selectCls =
  'mt-1 w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-3 py-2 rounded-sm outline-none'
const fieldHint = 'font-body text-ash/40 text-xs mt-1 block'

function daysLabel(d: number): string {
  if (d === 1) return '1 day'
  if (d === 7) return '1 week'
  if (d === 14) return '2 weeks'
  if (d === 30) return '1 month'
  if (d === 60) return '2 months'
  if (d === 90) return '3 months'
  return `${d} days`
}
function noticeLabel(h: number): string {
  if (h === 0) return 'No notice needed'
  if (h === 24) return '1 day before'
  if (h === 48) return '2 days before'
  return `${h} hour${h === 1 ? '' : 's'} before`
}
function slotLabel(m: number): string {
  return m === 0 ? 'Match the service length' : `Every ${m} minutes`
}

export default function AvailabilityEditor({
  initialSettings,
  initialWindows,
}: {
  initialSettings: BookingSettings
  initialWindows: AvailabilityWindow[]
}) {
  const init: Record<number, Range[]> = {}
  for (const wd of WEEKDAY_ORDER) init[wd] = []
  for (const w of initialWindows) {
    if (!init[w.weekday]) init[w.weekday] = []
    init[w.weekday].push({ start: minToHHMM(w.startMin), end: minToHHMM(w.endMin) })
  }

  const [days, setDays] = useState<Record<number, Range[]>>(init)
  const [timezone, setTimezone] = useState(
    initialSettings.timezone && initialSettings.timezone !== 'UTC' ? initialSettings.timezone : detectedTz(),
  )
  const [windowDays, setWindowDays] = useState(initialSettings.windowDays || 30)
  const [minNoticeHours, setMinNoticeHours] = useState(initialSettings.minNoticeHours ?? 12)
  const [slotStepMin, setSlotStepMin] = useState(initialSettings.slotStepMin || 0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const tzOptions = TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES]
  const windowOpts = Array.from(new Set([windowDays, 7, 14, 30, 60, 90])).sort((a, b) => a - b)
  const noticeOpts = Array.from(new Set([minNoticeHours, 0, 2, 12, 24, 48])).sort((a, b) => a - b)
  const slotOpts = Array.from(new Set([slotStepMin, 0, 15, 30, 60])).sort((a, b) => a - b)

  function touched() {
    setSaved(false)
  }
  function closeDay(wd: number) {
    setDays(d => ({ ...d, [wd]: [] }))
    touched()
  }
  function addRange(wd: number) {
    setDays(d => ({ ...d, [wd]: [...(d[wd] ?? []), { start: '09:00', end: '17:00' }] }))
    touched()
  }
  function removeRange(wd: number, i: number) {
    setDays(d => ({ ...d, [wd]: (d[wd] ?? []).filter((_, j) => j !== i) }))
    touched()
  }
  function setRange(wd: number, i: number, key: keyof Range, val: string) {
    setDays(d => ({ ...d, [wd]: (d[wd] ?? []).map((r, j) => (j === i ? { ...r, [key]: val } : r)) }))
    touched()
  }
  function weekdayPreset() {
    setDays(d => {
      const next = { ...d }
      for (const wd of [1, 2, 3, 4, 5]) next[wd] = [{ start: '09:00', end: '17:00' }]
      for (const wd of [0, 6]) next[wd] = []
      return next
    })
    touched()
  }

  async function save() {
    setSaving(true)
    const windows: AvailabilityWindow[] = []
    for (const wd of WEEKDAY_ORDER) {
      for (const r of days[wd] ?? []) {
        const s = hhmmToMin(r.start)
        const e = hhmmToMin(r.end)
        if (e > s) windows.push({ weekday: wd, startMin: s, endMin: e })
      }
    }
    const fd = new FormData()
    fd.set('schedule', JSON.stringify({ settings: { timezone, windowDays, minNoticeHours, slotStepMin }, windows }))
    try {
      await saveScheduleAction(fd)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-gold/15 rounded-sm p-5 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-body text-parchment">When are you available?</p>
          <p className="font-body text-ash/60 text-sm mt-1">
            Set the hours you take bookings each week. Visitors only see open days &amp; times.
          </p>
        </div>
        <button
          type="button"
          onClick={weekdayPreset}
          className="shrink-0 font-label text-[9px] tracking-[2px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-3 py-1.5 rounded-sm"
        >
          Weekdays 9–5
        </button>
      </div>

      <div className="rounded-sm border border-gold/10 divide-y divide-gold/5">
        {WEEKDAY_ORDER.map(wd => {
          const ranges = days[wd] ?? []
          const open = ranges.length > 0
          return (
            <div key={wd} className="flex items-start gap-3 px-4 py-3">
              <span className={`font-body text-sm w-24 pt-1.5 shrink-0 ${open ? 'text-parchment' : 'text-ash/40'}`}>
                {WEEKDAYS[wd]}
              </span>
              <div className="flex-1 space-y-2">
                {!open && <span className="font-body text-ash/30 text-sm inline-block pt-1.5">Closed</span>}
                {ranges.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={r.start}
                      onChange={e => setRange(wd, i, 'start', e.target.value)}
                      className={timeInput}
                      style={{ colorScheme: 'dark' }}
                    />
                    <span className="text-ash/50 text-sm">to</span>
                    <input
                      type="time"
                      value={r.end}
                      onChange={e => setRange(wd, i, 'end', e.target.value)}
                      className={timeInput}
                      style={{ colorScheme: 'dark' }}
                    />
                    <button
                      type="button"
                      onClick={() => removeRange(wd, i)}
                      className="font-label text-[9px] tracking-[2px] uppercase text-red-400 hover:text-red-300 px-1"
                      aria-label="Remove time range"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {open && (
                  <button
                    type="button"
                    onClick={() => addRange(wd)}
                    className="font-label text-[9px] tracking-[2px] uppercase text-gold/70 hover:text-gold"
                  >
                    + add another
                  </button>
                )}
              </div>
              {open ? (
                <button
                  type="button"
                  onClick={() => closeDay(wd)}
                  className="shrink-0 font-label text-[9px] tracking-[2px] uppercase text-ash/60 hover:text-red-300 pt-1.5"
                >
                  Close
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => addRange(wd)}
                  className="shrink-0 font-label text-[9px] tracking-[2px] uppercase text-gold hover:text-goldLight pt-1.5"
                >
                  Open
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        <label className="block">
          <span className="font-label text-[9px] tracking-[2px] uppercase text-gold/60">Your timezone</span>
          <select
            value={timezone}
            onChange={e => { setTimezone(e.target.value); touched() }}
            className={selectCls}
            style={{ colorScheme: 'dark' }}
          >
            {tzOptions.map(tz => (
              <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <span className={fieldHint}>Slots are shown in this timezone.</span>
        </label>
        <label className="block">
          <span className="font-label text-[9px] tracking-[2px] uppercase text-gold/60">How far ahead can people book?</span>
          <select
            value={windowDays}
            onChange={e => { setWindowDays(parseInt(e.target.value, 10)); touched() }}
            className={selectCls}
            style={{ colorScheme: 'dark' }}
          >
            {windowOpts.map(d => (
              <option key={d} value={d}>{daysLabel(d)}</option>
            ))}
          </select>
          <span className={fieldHint}>The booking page shows openings this far out.</span>
        </label>
        <label className="block">
          <span className="font-label text-[9px] tracking-[2px] uppercase text-gold/60">Minimum notice</span>
          <select
            value={minNoticeHours}
            onChange={e => { setMinNoticeHours(parseInt(e.target.value, 10)); touched() }}
            className={selectCls}
            style={{ colorScheme: 'dark' }}
          >
            {noticeOpts.map(h => (
              <option key={h} value={h}>{noticeLabel(h)}</option>
            ))}
          </select>
          <span className={fieldHint}>Stops bookings that are too last-minute.</span>
        </label>
        <label className="block">
          <span className="font-label text-[9px] tracking-[2px] uppercase text-gold/60">Time between slots</span>
          <select
            value={slotStepMin}
            onChange={e => { setSlotStepMin(parseInt(e.target.value, 10)); touched() }}
            className={selectCls}
            style={{ colorScheme: 'dark' }}
          >
            {slotOpts.map(m => (
              <option key={m} value={m}>{slotLabel(m)}</option>
            ))}
          </select>
          <span className={fieldHint}>How far apart each start time is.</span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="font-label text-[11px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-6 py-2.5 rounded-sm transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save availability'}
        </button>
        <span className="font-body text-ash/50 text-xs">Times are in {timezone.replace(/_/g, ' ')}.</span>
      </div>
    </div>
  )
}
