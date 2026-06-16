'use client'

import { useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { THEMES } from '@/lib/sites/types'
import { STYLE_PRESETS, WEBSITE_TYPES, PAGE_OPTIONS } from '@/lib/sites/styles'
import { aiCreateSiteAction } from './actions'

const STEPS = ['Type', 'About', 'Pages', 'Style']

interface CustomPage {
  title: string
  purpose: string
}

function GenerateButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="font-label text-[11px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-7 py-3 rounded-sm transition-colors disabled:opacity-50"
    >
      {pending ? 'Creating your website…' : 'Generate my website ✨'}
    </button>
  )
}

export default function AiWizard({
  siteId,
  siteName,
  hasContent,
}: {
  siteId: string
  siteName: string
  hasContent: boolean
}) {
  const [step, setStep] = useState(0)
  const [type, setType] = useState('')
  const [customType, setCustomType] = useState('')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<Set<string>>(
    new Set(PAGE_OPTIONS.filter(p => p.required || p.default).map(p => p.title)),
  )
  const [customPages, setCustomPages] = useState<CustomPage[]>([])
  const [newPageTitle, setNewPageTitle] = useState('')
  const [newPagePurpose, setNewPagePurpose] = useState('')
  const [styleKey, setStyleKey] = useState('')

  const resolvedType = type === 'Other' ? customType.trim() : type

  function togglePage(p: { title: string; required?: boolean }) {
    if (p.required) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(p.title)) next.delete(p.title)
      else next.add(p.title)
      return next
    })
  }
  function addCustomPage() {
    const title = newPageTitle.trim()
    if (!title) return
    setCustomPages(prev => [...prev, { title, purpose: newPagePurpose.trim() || `The ${title} page.` }])
    setNewPageTitle('')
    setNewPagePurpose('')
  }

  const payload = useMemo(() => {
    const pages = [
      ...PAGE_OPTIONS.filter(p => selected.has(p.title)).map(p => ({ title: p.title, purpose: p.purpose })),
      ...customPages,
    ]
    return JSON.stringify({ type: resolvedType, description: description.trim(), styleKey, pages })
  }, [selected, customPages, resolvedType, description, styleKey])

  const canNext =
    step === 0 ? Boolean(resolvedType) : step === 1 ? description.trim().length > 10 : step === 2 ? true : Boolean(styleKey)

  const card = 'border border-gold/20 rounded-sm p-4 text-left transition-colors hover:border-gold/50'
  const cardOn = 'border-gold bg-gold/10'

  return (
    <div className="space-y-7">
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={`font-label text-[9px] tracking-[2px] uppercase px-2.5 py-1 rounded-sm ${
                i === step ? 'bg-gold text-background' : i < step ? 'text-gold' : 'text-ash/50'
              }`}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && <span className="text-ash/30">·</span>}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <h2 className="font-display text-2xl italic text-parchment">What type of website is this?</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {WEBSITE_TYPES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`font-body text-sm px-3 py-2.5 rounded-sm border transition-colors ${
                  type === t ? 'border-gold bg-gold/10 text-parchment' : 'border-gold/20 text-ash hover:border-gold/50 hover:text-parchment'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {type === 'Other' && (
            <input
              value={customType}
              onChange={e => setCustomType(e.target.value)}
              placeholder="Describe your type of website"
              className="w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none placeholder:text-ash/40"
              autoFocus
            />
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="font-display text-2xl italic text-parchment">What is your website about?</h2>
          <p className="font-body text-ash/70 text-sm">
            Describe it in a few sentences — the AI uses this to write your whole site.
          </p>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={5}
            placeholder="e.g. I help people reconnect with their authentic selves through coaching, meditation, energy healing, and online courses."
            className="w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none resize-none placeholder:text-ash/40"
            autoFocus
          />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="font-display text-2xl italic text-parchment">Which pages do you want?</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PAGE_OPTIONS.map(p => {
              const on = selected.has(p.title)
              return (
                <button
                  key={p.title}
                  type="button"
                  onClick={() => togglePage(p)}
                  disabled={p.required}
                  className={`flex items-center gap-2 font-body text-sm px-3 py-2.5 rounded-sm border text-left transition-colors ${
                    on ? 'border-gold bg-gold/10 text-parchment' : 'border-gold/20 text-ash hover:border-gold/50'
                  } ${p.required ? 'opacity-90 cursor-default' : ''}`}
                >
                  <span style={{ color: on ? undefined : 'transparent' }}>{on ? '✓' : '○'}</span>
                  {p.title}
                  {p.required && <span className="text-ash/40 text-xs">(always)</span>}
                </button>
              )
            })}
          </div>

          {customPages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {customPages.map((p, i) => (
                <span key={i} className="flex items-center gap-2 font-body text-sm px-3 py-2 rounded-sm border border-gold bg-gold/10 text-parchment">
                  {p.title}
                  <button type="button" onClick={() => setCustomPages(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300" aria-label="Remove page">✕</button>
                </span>
              ))}
            </div>
          )}

          <div className="border border-gold/15 rounded-sm p-4 space-y-2">
            <p className="font-label text-[9px] tracking-[2px] uppercase text-gold/60">Add your own page</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={newPageTitle}
                onChange={e => setNewPageTitle(e.target.value)}
                placeholder="Page name (e.g. Retreats)"
                className="flex-1 bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-3 py-2 rounded-sm outline-none placeholder:text-ash/40"
              />
              <input
                value={newPagePurpose}
                onChange={e => setNewPagePurpose(e.target.value)}
                placeholder="What it's for (optional)"
                className="flex-1 bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-3 py-2 rounded-sm outline-none placeholder:text-ash/40"
              />
              <button
                type="button"
                onClick={addCustomPage}
                className="font-label text-[10px] tracking-[2px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-4 py-2 rounded-sm"
              >
                + Add
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="font-display text-2xl italic text-parchment">Choose your visual style</h2>
          <p className="font-body text-ash/70 text-sm">Each style sets a matching palette — you can fine-tune colours afterwards.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {STYLE_PRESETS.map(s => {
              const t = THEMES[s.theme]
              const on = styleKey === s.key
              return (
                <button key={s.key} type="button" onClick={() => setStyleKey(s.key)} className={`${card} ${on ? cardOn : ''} flex items-center gap-3`}>
                  <span className="shrink-0 rounded-sm flex items-center justify-center" style={{ width: 46, height: 46, background: t.bg, border: `1px solid ${s.accentColor}` }}>
                    <span style={{ width: 16, height: 16, borderRadius: 3, background: s.accentColor }} />
                  </span>
                  <span>
                    <span className="block font-body text-parchment text-sm">{s.name}</span>
                    <span className="block font-body text-ash/60 text-xs">{s.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {hasContent && (
        <p className="font-body text-amber-600/80 text-xs">
          Heads-up: generating will replace this site&rsquo;s current design with a fresh one.
        </p>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-gold/10">
        <button
          type="button"
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          className="font-label text-[10px] tracking-[2px] uppercase text-ash hover:text-gold disabled:opacity-30"
        >
          ← Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => canNext && setStep(s => s + 1)}
            disabled={!canNext}
            className="font-label text-[11px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-6 py-3 rounded-sm transition-colors disabled:opacity-40"
          >
            Next →
          </button>
        ) : (
          <form action={aiCreateSiteAction}>
            <input type="hidden" name="id" value={siteId} />
            <input type="hidden" name="payload" value={payload} />
            <GenerateButton disabled={!styleKey || description.trim().length < 10} />
          </form>
        )}
      </div>
    </div>
  )
}
