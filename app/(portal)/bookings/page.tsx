import Link from 'next/link'
import { listServices, listAppointments, getAvailability, getSettings } from '@/lib/bookings/repo'
import {
  formatPrice,
  formatDayLabel,
  formatTimeLabel,
  DEFAULT_BOOKING_SETTINGS,
  type Service,
  type Appointment,
  type AvailabilityWindow,
  type BookingSettings,
} from '@/lib/bookings/types'
import { listSites } from '@/lib/sites/store'
import {
  createServiceAction,
  deleteServiceAction,
  confirmAppointmentAction,
  cancelAppointmentAction,
} from './actions'
import AvailabilityEditor from './AvailabilityEditor'

export const dynamic = 'force-dynamic'

function appointmentWhen(a: Appointment): string {
  if (a.slotDate && a.slotTime) return `${formatDayLabel(a.slotDate)} · ${formatTimeLabel(a.slotTime)}`
  if (a.requestedAt) return `prefers ${a.requestedAt}`
  return ''
}

const input =
  'w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-2.5 rounded-sm outline-none placeholder:text-ash/40'

export default async function BookingsPage() {
  let services: Service[] = []
  let appointments: Appointment[] = []
  let dbError = false
  try {
    services = await listServices()
    appointments = await listAppointments()
  } catch {
    dbError = true
  }

  let availability: AvailabilityWindow[] = []
  let settings: BookingSettings = { ...DEFAULT_BOOKING_SETTINGS }
  try {
    availability = await getAvailability()
    settings = await getSettings()
  } catch {
    // booking_availability / booking_settings tables not migrated yet (006)
  }

  let bookingSlug = ''
  try {
    const sites = await listSites()
    bookingSlug = sites[0]?.slug ?? ''
  } catch {
    /* ignore */
  }

  if (dbError) {
    return (
      <div className="space-y-6 max-w-xl">
        <h1 className="font-display text-4xl italic text-parchment">Bookings</h1>
        <div className="border border-gold/15 rounded-sm p-8 text-center">
          <p className="font-body text-parchment">Almost there — switch on bookings.</p>
          <p className="font-body text-ash/60 text-sm mt-2">
            Run migration <code className="text-gold/70">005_bookings.sql</code> in Supabase, then refresh.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-12 max-w-2xl">
      <section>
        <h1 className="font-display text-4xl italic text-parchment">Bookings</h1>
        <p className="font-body text-ash mt-2 text-sm">Offer sessions, share your booking page, and manage requests.</p>
        {bookingSlug ? (
          <p className="font-body text-ash/70 text-sm mt-3">
            Your booking page:{' '}
            <Link href={`/book/${bookingSlug}`} target="_blank" className="text-gold hover:text-goldLight">
              app.animatemple.com/book/{bookingSlug} ↗
            </Link>
          </p>
        ) : (
          <p className="font-body text-ash/50 text-sm mt-3">Create a website first to get a public booking link.</p>
        )}
      </section>

      <section>
        <h2 className="font-label text-[11px] tracking-[4px] uppercase text-gold mb-4">Your services</h2>
        <form action={createServiceAction} className="border border-gold/15 rounded-sm p-5 space-y-3 mb-5">
          <input name="name" required placeholder="Service name (e.g. Reiki session)" className={input} />
          <textarea name="description" rows={2} placeholder="Short description (optional)" className={`${input} resize-none`} />
          <div className="grid grid-cols-3 gap-3">
            <input name="duration" type="number" min={5} defaultValue={60} placeholder="Minutes" className={input} />
            <input name="price" type="number" min={0} step="0.01" defaultValue={0} placeholder="Price" className={input} />
            <input name="currency" defaultValue="eur" placeholder="eur" className={input} />
          </div>
          <button className="font-label text-[11px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-6 py-2.5 rounded-sm transition-colors">
            Add service
          </button>
        </form>

        <div className="space-y-2">
          {services.length === 0 && <p className="font-body text-ash/60 text-sm">No services yet — add one above.</p>}
          {services.map(s => (
            <div key={s.id} className="border border-gold/10 rounded-sm p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-body text-parchment">{s.name}</p>
                <p className="font-body text-ash/60 text-sm mt-0.5">
                  {s.durationMin} min · {formatPrice(s.priceCents, s.currency)}
                  {s.description ? ` · ${s.description}` : ''}
                </p>
              </div>
              <form action={deleteServiceAction}>
                <input type="hidden" name="id" value={s.id} />
                <button className="font-label text-[9px] tracking-[2px] uppercase text-red-400 hover:text-red-300">Delete</button>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-label text-[11px] tracking-[4px] uppercase text-gold mb-4">Availability</h2>
        <AvailabilityEditor initialSettings={settings} initialWindows={availability} />
      </section>

      <section>
        <h2 className="font-label text-[11px] tracking-[4px] uppercase text-gold mb-4">Requests</h2>
        <div className="space-y-2">
          {appointments.length === 0 && <p className="font-body text-ash/60 text-sm">No requests yet.</p>}
          {appointments.map(a => (
            <div key={a.id} className="border border-gold/10 rounded-sm p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-body text-parchment">
                    {a.clientName} <span className="text-ash/50 text-sm">· {a.serviceName ?? 'session'}</span>
                  </p>
                  <p className="font-body text-ash/60 text-sm mt-0.5">
                    {a.clientEmail}
                    {appointmentWhen(a) ? ` · ${appointmentWhen(a)}` : ''}
                  </p>
                  {a.note && <p className="font-body text-ash/50 text-sm mt-1 italic">“{a.note}”</p>}
                </div>
                <span
                  className={`font-label text-[9px] tracking-[2px] uppercase shrink-0 ${
                    a.status === 'confirmed' ? 'text-green-400' : a.status === 'cancelled' ? 'text-red-400' : 'text-gold'
                  }`}
                >
                  {a.status}
                </span>
              </div>
              {a.status === 'requested' && (
                <div className="flex items-center gap-2 mt-3">
                  <form action={confirmAppointmentAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="font-label text-[9px] tracking-[2px] uppercase bg-gold text-background hover:bg-goldLight px-3 py-1.5 rounded-sm">Confirm</button>
                  </form>
                  <form action={cancelAppointmentAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="font-label text-[9px] tracking-[2px] uppercase border border-red-500/30 text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-sm">Decline</button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
