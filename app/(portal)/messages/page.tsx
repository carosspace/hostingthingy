import { listMessages, type SiteMessage } from '@/lib/sites/messages'
import { replyToThread, setThreadReadAction, deleteThreadAction } from './actions'

export const dynamic = 'force-dynamic'

// Friendly absolute date — the time a message was sent.
function when(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// A conversation: every message to/from one person, keyed by lower(email).
interface Thread {
  key: string
  name: string
  email: string
  siteSlug: string | null
  messages: SiteMessage[] // chronological (oldest first)
  unread: number          // unread CLIENT messages (drives the dot + "Mark read")
  lastAt: string          // newest message time, for thread ordering
}

// Group the flat message list into threads by client email (case-insensitive).
function groupThreads(messages: SiteMessage[]): Thread[] {
  const map = new Map<string, Thread>()
  for (const m of messages) {
    const email = (m.email || '').trim()
    const key = email.toLowerCase() || `noemail:${m.id}` // emailless rows each stand alone
    let t = map.get(key)
    if (!t) {
      t = { key, name: m.name || 'Someone', email, siteSlug: m.siteSlug, messages: [], unread: 0, lastAt: m.createdAt }
      map.set(key, t)
    }
    t.messages.push(m)
    // A real client name (not an owner reply) is the friendliest thread label.
    if (m.sender !== 'owner' && m.name) t.name = m.name
    if (!t.siteSlug && m.siteSlug) t.siteSlug = m.siteSlug
    if (m.sender === 'client' && !m.read) t.unread += 1
  }
  const threads = Array.from(map.values())
  for (const t of threads) {
    t.messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    t.lastAt = t.messages[t.messages.length - 1]?.createdAt ?? t.lastAt
  }
  // Newest activity first.
  threads.sort((a, b) => b.lastAt.localeCompare(a.lastAt))
  return threads
}

export default async function MessagesPage({ searchParams }: { searchParams?: { error?: string } }) {
  let messages: SiteMessage[] = []
  let dbError = false
  try {
    messages = await listMessages()
  } catch {
    dbError = true
  }

  const replyError = searchParams?.error === 'reply'

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

  const threads = groupThreads(messages)
  const unread = messages.filter(m => m.sender !== 'owner' && !m.read).length

  return (
    <div className="space-y-8 max-w-2xl">
      <section>
        <h1 className="font-display text-4xl italic text-parchment">Messages</h1>
        <p className="font-body text-ash mt-2 text-sm">
          Conversations with people who reached out from your sites, grouped by person.
          {unread > 0 ? ` ${unread} unread.` : ''}
        </p>
        {replyError && (
          <p className="font-body text-amber-300/90 text-sm mt-3">
            Couldn&apos;t send that reply. Run migration <code className="text-gold/70">013_client_messages.sql</code> in Supabase, then try again.
          </p>
        )}
      </section>

      <section className="space-y-4">
        {threads.length === 0 && (
          <p className="font-body text-ash/60 text-sm">
            No messages yet. Add a <b className="text-ash">Contact form</b> to a page (Add → Media &amp; buttons → Contact form) and replies will appear here.
          </p>
        )}

        {threads.map(t => {
          const ids = t.messages.map(m => m.id).join(',')
          // Read/unread toggles only the CLIENT-sent rows — never the owner's own
          // replies (those stay read=true), so the nav unread badge can't be inflated.
          const clientIds = t.messages.filter(m => m.sender === 'client').map(m => m.id).join(',')
          const hasUnread = t.unread > 0
          return (
            <div
              key={t.key}
              className={`border rounded-sm p-4 ${hasUnread ? 'border-gold/35 bg-gold/[0.03]' : 'border-gold/10'}`}
            >
              {/* Thread header: who + their email + thread-level actions */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-body text-parchment">
                    {hasUnread && <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold mr-2 align-middle" />}
                    {t.name}
                    {t.email && (
                      <a href={`mailto:${encodeURIComponent(t.email)}`} className="text-ash/50 text-sm ml-2 hover:text-gold">
                        {t.email}
                      </a>
                    )}
                  </p>
                  <p className="font-body text-ash/45 text-[11px] mt-0.5">
                    {t.messages.length} message{t.messages.length === 1 ? '' : 's'}
                    {t.siteSlug ? ` · ${t.siteSlug}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <form action={setThreadReadAction}>
                    <input type="hidden" name="ids" value={clientIds} />
                    <input type="hidden" name="read" value={hasUnread ? '1' : '0'} />
                    <button className="font-label text-[9px] tracking-[2px] uppercase text-ash hover:text-gold">
                      {hasUnread ? 'Mark read' : 'Mark unread'}
                    </button>
                  </form>
                  <form action={deleteThreadAction}>
                    <input type="hidden" name="ids" value={ids} />
                    <button className="font-label text-[9px] tracking-[2px] uppercase text-red-400 hover:text-red-300">Delete</button>
                  </form>
                </div>
              </div>

              {/* The conversation: client on the left, owner replies on the right */}
              <div className="mt-4 flex flex-col gap-2.5">
                {t.messages.map(m => {
                  const owner = m.sender === 'owner'
                  return (
                    <div key={m.id} className={`flex flex-col ${owner ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-sm px-3 py-2 ${owner ? 'bg-gold/10 border border-gold/20' : 'bg-parchment/[0.04] border border-gold/10'}`}
                      >
                        <p className="font-body text-parchment/90 text-sm whitespace-pre-wrap break-words">{m.body}</p>
                      </div>
                      <p className={`font-body text-ash/40 text-[10px] mt-0.5 ${owner ? 'text-right' : ''}`}>
                        {owner ? 'You' : t.name} · {when(m.createdAt)}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Reply box — targets the thread's email server-side (never the UI's word) */}
              <form action={replyToThread} className="mt-4 flex flex-col gap-2">
                <input type="hidden" name="email" value={t.email} />
                <input type="hidden" name="siteSlug" value={t.siteSlug ?? ''} />
                <textarea
                  name="body"
                  required
                  rows={2}
                  placeholder={`Reply to ${t.name}…`}
                  className="font-body w-full resize-y bg-background border border-gold/15 rounded-sm px-3 py-2 text-sm text-parchment placeholder:text-ash/40 focus:outline-none focus:border-gold/40"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="font-label text-[10px] tracking-[2px] uppercase bg-gold text-background rounded-sm px-4 py-2 hover:bg-gold/90 transition-colors"
                  >
                    Send reply
                  </button>
                </div>
              </form>
            </div>
          )
        })}
      </section>
    </div>
  )
}
