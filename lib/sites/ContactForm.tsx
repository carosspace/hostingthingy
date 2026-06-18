'use client'
import { useState, type CSSProperties, type FormEvent } from 'react'
import { submitMessageAction } from '@/app/(portal)/sites/actions'

// Live contact form rendered on a published canvas page. Submits through a server
// action → submit_message RPC, which stores the message in the owner's inbox.
export function ContactForm({
  slug,
  accent,
  label,
  radius,
  fontFamily,
  textColor,
}: {
  slug: string
  accent: string
  label: string
  radius: number
  fontFamily?: string
  textColor: string
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [body, setBody] = useState('')
  const [hp, setHp] = useState('') // honeypot — humans never see/fill it; bots do
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const r = Math.max(0, radius - 2)
  const field: CSSProperties = {
    width: '100%',
    padding: '0.6em 0.75em',
    borderRadius: r,
    border: '1px solid rgba(0,0,0,0.16)',
    background: 'rgba(255,255,255,0.86)',
    font: 'inherit',
    color: textColor,
    marginBottom: '0.5em',
    boxSizing: 'border-box',
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!body.trim() || state === 'sending') return
    setState('sending')
    try {
      const res = await submitMessageAction({ slug, name, email, body, hp })
      if (res.ok) {
        setState('sent')
        setName('')
        setEmail('')
        setBody('')
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div
        style={{
          font: 'inherit',
          fontFamily,
          color: textColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          textAlign: 'center',
          padding: '1em',
        }}
      >
        Thanks — your message was sent.
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ font: 'inherit', fontFamily, color: textColor, display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* Honeypot: off-screen + hidden from assistive tech and tab order. A real
          person never fills it; bots usually do, and we silently drop those. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
      <input style={field} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
      <input style={field} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <textarea
        style={{ ...field, flex: 1, minHeight: 56, resize: 'none' }}
        placeholder="Message"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <button
        type="submit"
        disabled={state === 'sending'}
        style={{
          padding: '0.6em 1em',
          borderRadius: r,
          border: 'none',
          background: accent,
          color: '#fff',
          font: 'inherit',
          fontWeight: 600,
          cursor: 'pointer',
          opacity: state === 'sending' ? 0.7 : 1,
        }}
      >
        {state === 'sending' ? 'Sending…' : label}
      </button>
      {state === 'error' && (
        <div style={{ color: '#c0392b', fontSize: '0.85em', marginTop: '0.4em' }}>Couldn’t send. Please try again.</div>
      )}
    </form>
  )
}
