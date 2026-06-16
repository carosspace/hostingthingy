import {
  hhmmToMin,
  minToHHMM,
  pad2,
  type AvailabilityWindow,
  type BookingSettings,
  type DaySlots,
  type TakenSlot,
} from './types'

// Current date + minutes-from-midnight in a given IANA timezone.
export function nowInTz(tz: string): { date: string; minutes: number } {
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
    for (const p of dtf.formatToParts(new Date())) parts[p.type] = p.value
    let hour = parseInt(parts.hour, 10) || 0
    if (hour === 24) hour = 0
    return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: hour * 60 + (parseInt(parts.minute, 10) || 0) }
  } catch {
    const d = new Date()
    return {
      date: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`,
      minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    }
  }
}

// Generate the list of bookable days (each with open start times) for a service,
// given the owner's weekly windows, already-taken slots and settings.
// All math is done in the owner's timezone wall-clock.
export function computeAvailableDays(
  availability: AvailabilityWindow[],
  taken: TakenSlot[],
  settings: BookingSettings,
  durationMin: number,
): DaySlots[] {
  if (!durationMin || durationMin <= 0 || !availability.length) return []

  const step = settings.slotStepMin && settings.slotStepMin > 0 ? settings.slotStepMin : durationMin
  const windowDays = Math.min(180, Math.max(1, settings.windowDays || 30))
  const now = nowInTz(settings.timezone || 'UTC')
  const earliest = now.minutes + Math.max(0, settings.minNoticeHours || 0) * 60 // minutes from today-midnight

  const [ty, tm, td] = now.date.split('-').map(Number)
  const base = Date.UTC(ty, tm - 1, td)
  const DAY = 86400000
  const out: DaySlots[] = []

  for (let k = 0; k < windowDays; k++) {
    const dt = new Date(base + k * DAY)
    const weekday = dt.getUTCDay()
    const date = `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
    const windows = availability.filter(w => w.weekday === weekday && w.endMin > w.startMin)
    if (!windows.length) continue

    const takenToday = taken.filter(t => t.date === date)
    const slots = new Set<number>()

    for (const w of windows) {
      for (let t = w.startMin; t + durationMin <= w.endMin; t += step) {
        if (k * 1440 + t < earliest) continue // respect minimum notice across days
        const clash = takenToday.some(tk => {
          const ts = hhmmToMin(tk.time)
          const tdur = tk.durationMin || durationMin
          return ts < t + durationMin && t < ts + tdur
        })
        if (clash) continue
        slots.add(t)
      }
    }

    if (slots.size) {
      out.push({ date, weekday, slots: Array.from(slots).sort((a, b) => a - b).map(minToHHMM) })
    }
  }

  return out
}
