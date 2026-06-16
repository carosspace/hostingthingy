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
const numInput =
  'w-20 bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-3 py-2 rounded-sm outline-none'

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

  function touched() {
    setSaved(false)
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

      <div className="space-y-2">
        {WEEKDAY_ORDER.map(wd => {
          const ranges = days[wd] ?? []
          return (
            <div key={wd} className="flex items-start gap-3 py-1.5 border-b border-gold/5 last:border-0">
              <span className="font-body text-parchment text-sm w-24 pt-2 shrink-0">{WEEKDAYS[wd]}</span>
              <div className="flex-1 space-y-2">
                {ranges.length === 0 && <span className="font-body text-ash/40 text-sm inline-block pt-2">Closed</span>}
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
              </div>
              <button
                type="button"
                onClick={() => addRange(wd)}
                className="shrink-0 font-label text-[9px] tracking-[2px] uppercase text-gold hover:text-goldLight pt-2"
              >
                + Add hours
              </button>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <label className="block">
          <span className="font-label text-[9px] tracking-[2px] uppercase text-gold/60">Your timezone</span>
          <select
            value={timezone}
            onChange={e => {
              setTimezone(e.target.value)
              touched()
            }}
            className="mt-1 w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-3 py-2 rounded-sm outline-none"
            style={{ colorScheme: 'dark' }}
          >
            {tzOptions.map(tz => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-label text-[9px] tracking-[2px] uppercase text-gold/60">Book up to (days ahead)</span>
          <input
            type="number"
            min={1}
            max={180}
            value={windowDays}
            onChange={e => {
              setWindowDays(parseInt(e.target.value, 10) || 30)
              touched()
            }}
            className={`mt-1 ${numInput}`}
          />
        </label>
        <label className="block">
          <span className="font-label text-[9px] tracking-[2px] uppercase text-gold/60">Minimum notice (hours)</span>
          <input
            type="number"
            min={0}
            max={720}
            value={minNoticeHours}
            onChange={e => {
              setMinNoticeHours(parseInt(e.target.value, 10) || 0)
              touched()
            }}
            className={`mt-1 ${numInput}`}
          />
        </label>
        <label className="block">
          <span className="font-label text-[9px] tracking-[2px] uppercase text-gold/60">Slot interval (min, 0 = service length)</span>
          <input
            type="number"
            min={0}
            max={480}
            step={5}
            value={slotStepMin}
            onChange={e => {
              setSlotStepMin(parseInt(e.target.value, 10) || 0)
              touched()
            }}
            className={`mt-1 ${numInput}`}
          />
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
