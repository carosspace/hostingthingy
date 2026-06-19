'use client'
import { useState, type CSSProperties, type FormEvent } from 'react'
import { submitMessageAction } from '@/app/(portal)/sites/actions'
import { defaultFormFields, type FormField } from './types'

// Live contact form rendered on a published canvas page. Renders the owner's chosen
// fields and submits through a server action → submit_message RPC. The fields map onto
// the existing messages schema (an email field → email, a text field → name, all fields
// → the body), so the inbox stays unchanged.
export function ContactForm({
  slug,
  accent,
  label,
  radius,
  fontFamily,
  textColor,
  fields,
}: {
  slug: string
  accent: string
  label: string
  radius: number
  fontFamily?: string
  textColor: string
  fields?: FormField[]
}) {
  const list = fields && fields.length ? fields : defaultFormFields()
  const [vals, setVals] = useState<Record<number, string>>({})
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
  const set = (i: number, v: string) => setVals(p => ({ ...p, [i]: v }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (state === 'sending') return
    // Required fields must be filled.
    for (let i = 0; i < list.length; i++) {
      if (list[i].required && !(vals[i] || '').trim()) return
    }
    const emailIdx = list.findIndex(f => f.type === 'email')
    const nameIdx = list.findIndex(f => f.type === 'text')
    const email = emailIdx >= 0 ? (vals[emailIdx] || '').trim() : ''
    const name = nameIdx >= 0 ? (vals[nameIdx] || '').trim() : ''
    const body = list
      .map((f, i) => ((vals[i] || '').trim() ? `${f.label}: ${(vals[i] || '').trim()}` : ''))
      .filter(Boolean)
      .join('\n')
    if (!body) return
    setState('sending')
    try {
      const res = await submitMessageAction({ slug, name, email, body, hp })
      if (res.ok) {
        setState('sent')
        setVals({})
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div style={{ font: 'inherit', fontFamily, color: textColor, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '1em' }}>
        Thanks — your message was sent.
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} style={{ font: 'inherit', fontFamily, color: textColor, display: 'flex', flexDirection: 'column', height: '100%' }}>
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
      {list.map((f, i) =>
        f.type === 'textarea' ? (
          <textarea
            key={i}
            style={{ ...field, flex: 1, minHeight: 56, resize: 'none' }}
            placeholder={f.label + (f.required ? ' *' : '')}
            value={vals[i] || ''}
            onChange={(e) => set(i, e.target.value)}
          />
        ) : (
          <input
            key={i}
            style={field}
            type={f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : 'text'}
            placeholder={f.label + (f.required ? ' *' : '')}
            value={vals[i] || ''}
            onChange={(e) => set(i, e.target.value)}
          />
        )
      )}
      <button
        type="submit"
        disabled={state === 'sending'}
        style={{ padding: '0.6em 1em', borderRadius: r, border: 'none', background: accent, color: '#fff', font: 'inherit', fontWeight: 600, cursor: 'pointer', opacity: state === 'sending' ? 0.7 : 1 }}
      >
        {state === 'sending' ? 'Sending…' : label}
      </button>
      {state === 'error' && <div style={{ color: '#c0392b', fontSize: '0.85em', marginTop: '0.4em' }}>Couldn’t send. Please try again.</div>}
    </form>
  )
}
