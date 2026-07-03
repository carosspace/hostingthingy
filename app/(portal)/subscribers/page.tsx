import { listSubscribers, type Subscriber } from '@/lib/newsletter/repo'
import SubscribersExport from './SubscribersExport'

export const dynamic = 'force-dynamic'

function when(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function SubscribersPage() {
  let subs: Subscriber[] = []
  let dbError = false
  try {
    subs = await listSubscribers()
  } catch {
    dbError = true
  }

  if (dbError) {
    return (
      <div className="space-y-6 max-w-xl">
        <h1 className="font-display text-4xl italic text-parchment">Subscribers</h1>
        <div className="border border-gold/15 rounded-sm p-8 text-center">
          <p className="font-body text-parchment">Almost there — switch on your newsletter list.</p>
          <p className="font-body text-ash/60 text-sm mt-2">
            Run migration <code className="text-gold/70">024_newsletter.sql</code> in Supabase, then refresh.
          </p>
        </div>
      </div>
    )
  }

  const emails = subs.map(s => s.email)

  return (
    <div className="space-y-8 max-w-2xl">
      <section>
        <h1 className="font-display text-4xl italic text-parchment">Subscribers</h1>
        <p className="font-body text-ash mt-2 text-sm">
          People who joined your newsletter from the website popup. {subs.length} {subs.length === 1 ? 'person' : 'people'}.
        </p>
        <p className="font-body text-ash/60 text-xs mt-2">
          To send a newsletter, copy these into a tool like Mailchimp, MailerLite, Buttondown or Substack.
        </p>
      </section>

      {subs.length > 0 && <SubscribersExport emails={emails} />}

      <section className="space-y-2">
        {subs.length === 0 && (
          <p className="font-body text-ash/60 text-sm">No subscribers yet. The newsletter popup on your site adds them here.</p>
        )}
        {subs.map((s, i) => (
          <div key={s.email + i} className="flex items-center justify-between gap-4 border border-gold/10 rounded-sm px-4 py-2.5">
            <a href={`mailto:${encodeURIComponent(s.email)}`} className="font-body text-parchment text-sm hover:text-gold break-all">
              {s.email}
            </a>
            <span className="font-body text-ash/40 text-[11px] shrink-0">{when(s.createdAt)}</span>
          </div>
        ))}
      </section>
    </div>
  )
}
