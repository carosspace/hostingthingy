import { listMessages, type SiteMessage } from '@/lib/sites/messages'
import { setMessageReadAction, deleteMessageAction } from '../sites/actions'

export const dynamic = 'force-dynamic'

// Friendly absolute date — the time the visitor sent the message.
function when(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default async function MessagesPage() {
  let messages: SiteMessage[] = []
  let dbError = false
  try {
    messages = await listMessages()
  } catch {
    dbError = true
  }

  if (dbError) {
    return (
      <div className="space-y-6 max-w-xl">
        <h1 className="font-display text-4xl italic text-parchment">Messages</h1>
        <div className="border border-gold/15 rounded-sm p-8 text-center">
          <p className="font-body text-parchment">Almost there — switch on the contact form.</p>
          <p className="font-body text-ash/60 text-sm mt-2">
            Run migration <code className="text-gold/70">007_messages.sql</code> in Supabase, then refresh.
          </p>
        </div>
      </div>
    )
  }

  const unread = messages.filter(m => !m.read).length

  return (
    <div className="space-y-8 max-w-2xl">
      <section>
        <h1 className="font-display text-4xl italic text-parchment">Messages</h1>
        <p className="font-body text-ash mt-2 text-sm">
          Everything people send through a contact form on your sites lands here.
          {unread > 0 ? ` ${unread} unread.` : ''}
        </p>
      </section>

      <section className="space-y-2">
        {messages.length === 0 && (
          <p className="font-body text-ash/60 text-sm">
            No messages yet. Add a <b className="text-ash">Contact form</b> to a page (Add → Media &amp; buttons → Contact form) and replies will appear here.
          </p>
        )}
        {messages.map(m => (
          <div
            key={m.id}
            className={`border rounded-sm p-4 ${m.read ? 'border-gold/10' : 'border-gold/35 bg-gold/[0.03]'}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-body text-parchment">
                  {!m.read && <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold mr-2 align-middle" />}
                  {m.name || 'Someone'}
                  {m.email && (
                    <a href={`mailto:${encodeURIComponent(m.email)}`} className="text-ash/50 text-sm ml-2 hover:text-gold">
                      {m.email}
                    </a>
                  )}
                </p>
                <p className="font-body text-ash/45 text-[11px] mt-0.5">
                  {when(m.createdAt)}
                  {m.siteSlug ? ` · ${m.siteSlug}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <form action={setMessageReadAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="read" value={m.read ? '0' : '1'} />
                  <button className="font-label text-[9px] tracking-[2px] uppercase text-ash hover:text-gold">
                    {m.read ? 'Mark unread' : 'Mark read'}
                  </button>
                </form>
                <form action={deleteMessageAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className="font-label text-[9px] tracking-[2px] uppercase text-red-400 hover:text-red-300">Delete</button>
                </form>
              </div>
            </div>
            <p className="font-body text-parchment/90 text-sm mt-3 whitespace-pre-wrap break-words">{m.body}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
