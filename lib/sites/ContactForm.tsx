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
  const [step, setStep] = useState(0) // current step in a multi-step form

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

  // Conditional visibility. Evaluated top-to-bottom so a field is shown only when its
  // controlling field is BOTH visible and equal to the chosen value — references point
  // at earlier fields (enforced by the editor), so chains resolve without cycles.
  const visible: boolean[] = []
  list.forEach((f, i) => {
    visible[i] = true
    if (!f.showIf) return
    const ci = list.findIndex(x => x.id === f.showIf!.field)
    // Only apply the condition when it points at an EARLIER field; a dangling or forward
    // reference is ignored (fail open) so a field is never permanently stuck hidden.
    if (ci >= 0 && ci < i) visible[i] = visible[ci] && (vals[ci] || '').trim() === f.showIf!.equals
  })

  // Multi-step: a field with newStep begins a new step. Steps with no currently-visible
  // field are skipped during navigation (so a conditionally-emptied step is never shown).
  const stepOf: number[] = []
  { let s = 0; list.forEach((f, i) => { if (i > 0 && f.newStep) s += 1; stepOf[i] = s }) }
  const totalSteps = list.length ? stepOf[list.length - 1] + 1 : 1
  const multi = totalSteps > 1
  const stepHasVisible = (s: number) => list.some((_, i) => stepOf[i] === s && visible[i])
  const nextActive = (from: number) => { for (let s = from + 1; s < totalSteps; s++) if (stepHasVisible(s)) return s; return -1 }
  const prevActive = (from: number) => { for (let s = from - 1; s >= 0; s--) if (stepHasVisible(s)) return s; return -1 }
  const cur = multi ? Math.min(Math.max(step, 0), totalSteps - 1) : 0
  const onLastStep = !multi || nextActive(cur) === -1
  // Required, but only for the fields shown on the current step (used to gate "Next").
  const stepValid = (s: number) => list.every((f, i) => !(stepOf[i] === s && visible[i] && f.required && !(vals[i] || '').trim()))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (state === 'sending') return
    // Required fields must be filled — but only the ones currently shown.
    for (let i = 0; i < list.length; i++) {
      if (visible[i] && list[i].required && !(vals[i] || '').trim()) return
    }
    const emailIdx = list.findIndex(f => f.type === 'email')
    const nameIdx = list.findIndex(f => f.type === 'text')
    const email = emailIdx >= 0 && visible[emailIdx] ? (vals[emailIdx] || '').trim() : ''
    const name = nameIdx >= 0 && visible[nameIdx] ? (vals[nameIdx] || '').trim() : ''
    const body = list
      .map((f, i) => (visible[i] && (vals[i] || '').trim() ? `${f.label}: ${(vals[i] || '').trim()}` : ''))
      .filter(Boolean)
      .join('\n')
    if (!body) return
    setState('sending')
    try {
      const res = await submitMessageAction({ slug, name, email, body, hp })
      if (res.ok) {
        setState('sent')
        setVals({})
        setStep(0)
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
      {multi && (
        <div style={{ fontSize: '0.78em', opacity: 0.7, marginBottom: '0.5em', letterSpacing: '0.05em' }}>
          Step {cur + 1} of {totalSteps}
        </div>
      )}
      {list.map((f, i) =>
        !visible[i] || (multi && stepOf[i] !== cur) ? null : f.type === 'textarea' ? (
          <textarea
            key={i}
            style={{ ...field, flex: 1, minHeight: 56, resize: 'none' }}
            placeholder={f.label + (f.required ? ' *' : '')}
            value={vals[i] || ''}
            onChange={(e) => set(i, e.target.value)}
          />
        ) : f.type === 'select' ? (
          <select
            key={i}
            style={{ ...field, appearance: 'auto' }}
            value={vals[i] || ''}
            onChange={(e) => set(i, e.target.value)}
          >
            <option value="">{f.label + (f.required ? ' *' : '')}</option>
            {(f.options ?? []).map((opt, oi) => (
              <option key={oi} value={opt}>{opt}</option>
            ))}
          </select>
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
      <div style={{ display: 'flex', gap: '0.5em', marginTop: 'auto' }}>
        {multi && prevActive(cur) !== -1 && (
          <button
            type="button"
            onClick={() => setStep(prevActive(cur))}
            style={{ padding: '0.6em 1em', borderRadius: r, border: `1px solid ${accent}`, background: 'transparent', color: accent, font: 'inherit', fontWeight: 600, cursor: 'pointer' }}
          >
            Back
          </button>
        )}
        {multi && !onLastStep ? (
          <button
            type="button"
            onClick={() => { if (stepValid(cur)) { const n = nextActive(cur); if (n !== -1) setStep(n) } }}
            style={{ flex: 1, padding: '0.6em 1em', borderRadius: r, border: 'none', background: accent, color: '#fff', font: 'inherit', fontWeight: 600, cursor: 'pointer' }}
          >
            Next
          </button>
        ) : (
          <button
            type="submit"
            disabled={state === 'sending'}
            style={{ flex: 1, padding: '0.6em 1em', borderRadius: r, border: 'none', background: accent, color: '#fff', font: 'inherit', fontWeight: 600, cursor: 'pointer', opacity: state === 'sending' ? 0.7 : 1 }}
          >
            {state === 'sending' ? 'Sending…' : label}
          </button>
        )}
      </div>
      {state === 'error' && <div style={{ color: '#c0392b', fontSize: '0.85em', marginTop: '0.4em' }}>Couldn’t send. Please try again.</div>}
    </form>
  )
}
