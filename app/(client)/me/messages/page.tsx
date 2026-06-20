import type { CSSProperties } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { fontVars } from '@/lib/sites/fonts'
import { getPortalSite } from '@/lib/portal/site'
import { getMyMessages, type MyMessage } from '@/lib/portal/messages'
import PortalHeader from '../PortalHeader'
import { sendMessage } from './actions'

export const dynamic = 'force-dynamic'

// Friendly short timestamp for a bubble.
function when(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default async function ClientMessagesPage() {
  const { slug, brand, content, theme, accent } = await getPortalSite()
  const rootStyle = { background: theme.bg, color: theme.text, ...fontVars(content?.fontSystem) } as unknown as CSSProperties

  // Sub-pages require sign-in; /me itself renders the login. Redirect there.
  const user = await getCurrentUser()
  if (!user) redirect('/me')

  // Graceful: empty thread if migration 013 isn't applied (no crash).
  const messages = await getMyMessages(slug)

  const footer = content?.footer || brand

  // Chat bubbles: the client (this person) on the right with an accent tint, the
  // owner (the brand) on the left with a neutral tint. Both theme-aware + midnight-safe.
  const clientBubble: CSSProperties = {
    background: `${accent}14`,
    color: theme.text,
    border: `1px solid ${accent}26`,
    borderRadius: 16,
    maxWidth: '80%',
  }
  const ownerBubble: CSSProperties = {
    background: `${theme.text}0a`,
    color: theme.text,
    border: `1px solid ${theme.muted}26`,
    borderRadius: 16,
    maxWidth: '80%',
  }

  function Bubble({ m }: { m: MyMessage }) {
    const mine = m.sender === 'client'
    return (
      <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
        {!mine && (
          <span
            className="font-label mb-1"
            style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: accent }}
          >
            {brand}
          </span>
        )}
        <div className="px-4 py-3" style={mine ? clientBubble : ownerBubble}>
          <p className="font-body whitespace-pre-wrap break-words" style={{ fontSize: 14, lineHeight: 1.5 }}>
            {m.body}
          </p>
        </div>
        <span className="font-body mt-1" style={{ fontSize: 11, color: theme.muted }}>
          {when(m.createdAt)}
        </span>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={rootStyle}>
      <PortalHeader
        brand={brand}
        logoImage={content?.logoImage}
        theme={{ muted: theme.muted }}
        accent={accent}
        backHref="/me"
      />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-16">
        <h1 className="font-display italic" style={{ color: theme.text, fontSize: 40, lineHeight: 1.1 }}>
          Messages
        </h1>
        <p className="font-body mt-3" style={{ color: theme.muted, fontSize: 15, lineHeight: 1.6 }}>
          Talk with {brand}.
        </p>

        {/* The thread, oldest first */}
        {messages.length === 0 ? (
          <p
            className="font-body text-center mx-auto mt-16"
            style={{ color: theme.muted, fontSize: 15, lineHeight: 1.6, maxWidth: 380 }}
          >
            Start a conversation with {brand}.
          </p>
        ) : (
          <div className="mt-12 flex flex-col gap-5">
            {messages.map(m => (
              <Bubble key={m.id} m={m} />
            ))}
          </div>
        )}

        {/* Send box — always shown (even on the empty state) */}
        <form action={sendMessage} className="mt-10 flex flex-col gap-3">
          <textarea
            name="body"
            required
            rows={3}
            placeholder={`Write to ${brand}…`}
            className="font-body w-full resize-y px-4 py-3 outline-none"
            style={{
              background: `${theme.text}08`,
              color: theme.text,
              border: `1px solid ${theme.muted}33`,
              borderRadius: 14,
              fontSize: 14,
              lineHeight: 1.5,
            }}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="font-label px-6 py-2.5 transition-opacity hover:opacity-80"
              style={{
                background: accent,
                color: theme.bg,
                borderRadius: 999,
                fontSize: 11,
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}
            >
              Send
            </button>
          </div>
        </form>
      </main>

      <footer className="text-center py-10" style={{ borderTop: `1px solid ${accent}1f` }}>
        <p className="font-body" style={{ fontSize: 13, color: theme.muted }}>{footer}</p>
      </footer>
    </div>
  )
}
