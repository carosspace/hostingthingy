'use client'

import { useRef, useState, type CSSProperties } from 'react'
import { THEMES } from '@/lib/sites/types'
import type { SiteContent, SiteTheme, CtaType, SiteLayout, NavLink, SiteAlign, SectionKind, SectionImageLayout, ImageSize, ImageFit, Social, SocialKind, BlockType, MenuPosition } from '@/lib/sites/types'
import { FONT_SYSTEMS, fontVars } from '@/lib/sites/fonts'
import { SECTION_BLOCKS } from '@/lib/sites/blocks'
import { saveSiteContentJsonAction, aiSectionAction, aiPageAction } from '../../actions'

interface EdItem {
  id: string
  title: string
  body: string
  image: string
  block?: BlockType
  col?: 0 | 1 | 2
  href?: string
  ctaType?: CtaType
  boxColor?: string
  outline?: boolean
}

interface EdSection {
  id: string
  heading: string
  body: string
  image: string
  bgImage: string
  bgColor: string
  align: '' | SiteAlign
  kind: SectionKind
  items: EdItem[]
  columns: number
  reveal: boolean
  imageLayout: '' | SectionImageLayout
  imageSize: '' | ImageSize
  imageFit: '' | ImageFit
  overlay: number
  embedUrl: string
  ctaLabel: string
  ctaType: CtaType
  ctaHref: string
}

interface BtnPatch {
  type?: CtaType
  label?: string
  href?: string
}

const BLOCK_CHIPS: { type: BlockType; label: string }[] = [
  { type: 'text', label: 'Text' },
  { type: 'heading', label: 'Heading' },
  { type: 'image', label: 'Picture' },
  { type: 'button', label: 'Button' },
  { type: 'banner', label: 'Banner' },
  { type: 'divider', label: 'Line' },
  { type: 'spacer', label: 'Spacer' },
]

const edStyle: CSSProperties = { outline: 'none', cursor: 'text', minHeight: '1em' }
const urlInput: CSSProperties = {
  background: 'rgba(255,255,255,0.65)',
  color: '#222',
  border: '1px solid rgba(0,0,0,0.1)',
}

// Resize an uploaded image in the browser and return a compact data URL.
// Keeps the page self-contained (no storage bucket needed) while staying small.
function resizeToDataUrl(file: File, maxW = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read failed'))
    reader.onload = () => {
      const img = new window.Image()
      img.onerror = () => reject(new Error('decode failed'))
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width)
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('no canvas'))
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

function ImageField({ value, onChange, maxW = 1600 }: { value: string; onChange: (v: string) => void; maxW?: number }) {
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  async function handle(file?: File | null) {
    if (!file || !file.type.startsWith('image/')) return
    setBusy(true)
    try {
      onChange(await resizeToDataUrl(file, maxW))
    } catch {
      /* ignore bad image */
    } finally {
      setBusy(false)
    }
  }
  return (
    <div
      onDragOver={e => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => {
        e.preventDefault()
        setDrag(false)
        handle(e.dataTransfer.files?.[0])
      }}
      className="rounded-sm text-center"
      style={{
        border: `1.5px dashed ${drag ? '#a85c36' : 'rgba(0,0,0,0.18)'}`,
        background: drag ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.5)',
        padding: 10,
      }}
    >
      {value ? (
        <div className="flex items-center justify-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" style={{ height: 40, width: 60, objectFit: 'cover', borderRadius: 3 }} />
          <label style={{ cursor: 'pointer', fontSize: 11, color: '#444', textDecoration: 'underline' }}>
            {busy ? 'replacing…' : 'replace'}
            <input type="file" accept="image/*" hidden onChange={e => handle(e.target.files?.[0])} />
          </label>
          <button type="button" onClick={() => onChange('')} style={{ fontSize: 11, color: '#b3402f' }}>
            remove
          </button>
        </div>
      ) : (
        <label style={{ cursor: 'pointer', fontSize: 11, color: '#555', display: 'block' }}>
          {busy ? 'Adding…' : 'Drag an image here, or click to upload'}
          <input type="file" accept="image/*" hidden onChange={e => handle(e.target.files?.[0])} />
        </label>
      )}
    </div>
  )
}

// A small reusable "button" editor (target + label + custom link). Used for the
// hero button and for every section button.
function ButtonControl({
  title,
  type,
  label,
  href,
  siteSlug,
  onChange,
}: {
  title: string
  type: CtaType
  label: string
  href: string
  siteSlug: string
  onChange: (patch: BtnPatch) => void
}) {
  return (
    <div className="rounded-sm" style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(0,0,0,0.1)', padding: 10 }}>
      <div className="flex items-center justify-between gap-2">
        <span style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#555' }}>{title}</span>
        <select
          value={type}
          onChange={e => onChange({ type: e.target.value as CtaType })}
          style={{ ...urlInput, fontSize: 12, padding: '5px 6px', borderRadius: 3 }}
        >
          <option value="none">No button</option>
          <option value="booking">→ Booking page</option>
          <option value="email">→ Email me</option>
          <option value="link">→ Custom link</option>
        </select>
      </div>
      {type !== 'none' && (
        <>
          <input
            value={label}
            onChange={e => onChange({ label: e.target.value })}
            placeholder="Button text"
            className="w-full mt-2"
            style={{ ...urlInput, fontSize: 13, padding: '7px 10px', borderRadius: 3 }}
          />
          {type === 'link' && (
            <input
              value={href}
              onChange={e => onChange({ href: e.target.value })}
              placeholder="https://example.com  or  mailto:you@email.com"
              className="w-full mt-2"
              style={{ ...urlInput, fontSize: 12, padding: '7px 10px', borderRadius: 3 }}
            />
          )}
          <p style={{ fontSize: 11, color: '#666', marginTop: 6 }}>
            {type === 'booking' && `Goes to your booking page (/book/${siteSlug}).`}
            {type === 'email' && 'Opens an email to your contact address.'}
            {type === 'link' && 'Goes to the link above.'}
          </p>
        </>
      )}
    </div>
  )
}

const BAR_CHIPS: { type: BlockType; label: string }[] = [
  { type: 'image', label: 'Logo / picture' },
  { type: 'text', label: 'Text' },
  { type: 'heading', label: 'Title' },
  { type: 'button', label: 'Link / button' },
  { type: 'divider', label: 'Line' },
]
const BAR_LABEL: Record<string, string> = { image: 'Logo / picture', heading: 'Title', button: 'Link / button', divider: 'Line', text: 'Text' }

// A small block-list editor for a hand-composed header or footer bar.
function BarBlocksEditor({
  title,
  hint,
  items,
  setItems,
  accent,
  onTouch,
  newId,
}: {
  title: string
  hint: string
  items: EdItem[]
  setItems: (updater: (prev: EdItem[]) => EdItem[]) => void
  accent: string
  onTouch: () => void
  newId: () => string
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const chip: CSSProperties = { fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', border: `1px solid ${accent}66`, color: accent, padding: '5px 11px', borderRadius: 3, background: 'transparent', cursor: 'pointer' }
  const update = (id: string, patch: Partial<EdItem>) => { setItems(p => p.map(x => (x.id === id ? { ...x, ...patch } : x))); onTouch() }
  const remove = (id: string) => { setItems(p => p.filter(x => x.id !== id)); onTouch() }
  const move = (id: string, dir: -1 | 1) => {
    setItems(p => {
      const i = p.findIndex(x => x.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= p.length) return p
      const copy = p.slice()
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
    onTouch()
  }
  const add = (type: BlockType) => {
    setItems(p => [...p, { id: newId(), title: '', body: '', image: '', block: type }])
    setMenuOpen(false)
    onTouch()
  }
  return (
    <div>
      <p style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#888', marginBottom: 6 }}>{title}</p>
      <div className="space-y-2">
        {items.map((it, idx) => (
          <div key={it.id} className="rounded-sm" style={{ border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)', padding: 8 }}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: '#777' }}>{BAR_LABEL[it.block ?? 'text']}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => move(it.id, -1)} disabled={idx === 0} title="Move up" style={{ fontSize: 13, color: idx === 0 ? '#ccc' : accent }}>↑</button>
                <button type="button" onClick={() => move(it.id, 1)} disabled={idx === items.length - 1} title="Move down" style={{ fontSize: 13, color: idx === items.length - 1 ? '#ccc' : accent }}>↓</button>
                <button type="button" onClick={() => remove(it.id)} title="Remove" style={{ fontSize: 12, color: '#b3402f' }}>✕</button>
              </div>
            </div>
            {it.block === 'image' && <ImageField value={it.image} onChange={v => update(it.id, { image: v })} maxW={400} />}
            {it.block === 'heading' && (
              <input value={it.title} onChange={e => update(it.id, { title: e.target.value })} placeholder="Title" className="w-full" style={{ ...urlInput, fontSize: 14, padding: '6px 8px', borderRadius: 3 }} />
            )}
            {(it.block === 'text' || !it.block) && (
              <textarea value={it.body} onChange={e => update(it.id, { body: e.target.value })} placeholder="Text — e.g. © 2026, opening hours, an address…" rows={2} className="w-full resize-none" style={{ ...urlInput, fontSize: 13, padding: '6px 8px', borderRadius: 3 }} />
            )}
            {it.block === 'button' && (
              <div className="space-y-1">
                <input value={it.title} onChange={e => update(it.id, { title: e.target.value })} placeholder="Link text — e.g. Contact" className="w-full" style={{ ...urlInput, fontSize: 13, padding: '6px 8px', borderRadius: 3 }} />
                <select value={it.ctaType || 'none'} onChange={e => update(it.id, { ctaType: e.target.value as CtaType })} style={{ ...urlInput, fontSize: 12, padding: '4px 6px', borderRadius: 3 }}>
                  <option value="none">No link</option>
                  <option value="booking">→ Booking page</option>
                  <option value="email">→ Email me</option>
                  <option value="link">→ Custom link</option>
                </select>
                {it.ctaType === 'link' && <input value={it.href || ''} onChange={e => update(it.id, { href: e.target.value })} placeholder="https://…  or  /about" className="w-full" style={{ ...urlInput, fontSize: 12, padding: '6px 8px', borderRadius: 3 }} />}
              </div>
            )}
            {it.block === 'divider' && <div style={{ height: 1, background: accent, opacity: 0.4 }} />}
          </div>
        ))}
      </div>
      {menuOpen ? (
        <div className="flex flex-wrap gap-1 rounded-sm mt-2" style={{ border: `1px dashed ${accent}`, padding: 8 }}>
          {BAR_CHIPS.map(bc => (
            <button key={bc.type} type="button" onClick={() => add(bc.type)} style={chip}>{bc.label}</button>
          ))}
          <button type="button" onClick={() => setMenuOpen(false)} style={{ fontSize: 11, color: '#888' }}>cancel</button>
        </div>
      ) : (
        items.length < 12 && (
          <button type="button" onClick={() => setMenuOpen(true)} className="w-full rounded-sm mt-2" style={{ border: `1.5px dashed ${accent}`, color: accent, padding: 8, fontSize: 12 }}>
            + add to {title.toLowerCase()}
          </button>
        )
      )}
      {items.length === 0 && <p style={{ fontSize: 11, color: '#999', marginTop: 6 }}>{hint}</p>}
    </div>
  )
}

export default function LiveEditor({
  siteId,
  siteSlug,
  siteName,
  siteStatus,
  pageSlug,
  navPages,
  navLinks,
  initial,
}: {
  siteId: string
  siteSlug: string
  siteName: string
  siteStatus: string
  pageSlug: string
  navPages: { slug: string; label: string }[]
  navLinks: NavLink[]
  initial: SiteContent | null
}) {
  const idc = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const [theme, setTheme] = useState<SiteTheme>(initial?.theme ?? 'sand')
  const [accentColor, setAccentColor] = useState(initial?.accentColor ?? '')
  const [logoImage, setLogoImage] = useState(initial?.logoImage ?? '')
  const [logoOpen, setLogoOpen] = useState(false)
  const [faviconImage, setFaviconImage] = useState(initial?.faviconImage ?? '')
  const [faviconOpen, setFaviconOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<MenuPosition>(initial?.menuPosition ?? 'top')
  const [socials, setSocials] = useState<Social[]>(initial?.socials ?? [])
  const [headerItems, setHeaderItems] = useState<EdItem[]>(
    (initial?.headerItems ?? []).map((it, j) => ({ id: `hi${j}`, title: it.title ?? '', body: it.body ?? '', image: it.image ?? '', block: it.block, href: it.href, ctaType: it.ctaType, boxColor: it.boxColor, outline: it.outline })),
  )
  const [footerItems, setFooterItems] = useState<EdItem[]>(
    (initial?.footerItems ?? []).map((it, j) => ({ id: `fi${j}`, title: it.title ?? '', body: it.body ?? '', image: it.image ?? '', block: it.block, href: it.href, ctaType: it.ctaType, boxColor: it.boxColor, outline: it.outline })),
  )
  const [heroOverlay, setHeroOverlay] = useState(typeof initial?.heroOverlay === 'number' ? initial.heroOverlay : 42)
  const [undoStack, setUndoStack] = useState<{ sections: EdSection[]; headline: string; subheadline: string }[]>([])
  const [undoNonce, setUndoNonce] = useState(0)
  const [layout, setLayout] = useState<SiteLayout>(initial?.layout ?? 'contained')
  const [fontSystem, setFontSystem] = useState(initial?.fontSystem ?? 'serif')
  const [heroImage, setHeroImage] = useState(initial?.heroImage ?? '')
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? '')
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle ?? '')
  const [seoDescription, setSeoDescription] = useState(initial?.seoDescription ?? '')
  const [ctaLabel, setCtaLabel] = useState(initial?.ctaLabel ?? '')
  const [ctaType, setCtaType] = useState<CtaType>(initial?.ctaType ?? 'none')
  const [ctaHref, setCtaHref] = useState(initial?.ctaHref ?? '')
  const [sections, setSections] = useState<EdSection[]>(
    (initial?.sections ?? []).map((s, i) => ({
      id: 'i' + i,
      heading: s.heading,
      body: s.body,
      image: s.image ?? '',
      bgImage: s.bgImage ?? '',
      bgColor: s.bgColor ?? '',
      align: (s.align ?? '') as '' | SiteAlign,
      kind: s.kind ?? 'prose',
      items: (s.items ?? []).map((it, j) => ({ id: `it${i}-${j}`, title: it.title ?? '', body: it.body ?? '', image: it.image ?? '', block: it.block, col: it.col, href: it.href, ctaType: it.ctaType, boxColor: it.boxColor, outline: it.outline })),
      columns: typeof s.columns === 'number' ? s.columns : 1,
      reveal: s.reveal ?? false,
      imageLayout: (s.imageLayout ?? '') as '' | SectionImageLayout,
      imageSize: (s.imageSize ?? '') as '' | ImageSize,
      imageFit: (s.imageFit ?? '') as '' | ImageFit,
      overlay: typeof s.overlay === 'number' ? s.overlay : 50,
      embedUrl: s.embedUrl ?? '',
      ctaLabel: s.ctaLabel ?? '',
      ctaType: s.ctaType ?? 'none',
      ctaHref: s.ctaHref ?? '',
    })),
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [aiFor, setAiFor] = useState('')
  const [aiText, setAiText] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [addAiOpen, setAddAiOpen] = useState(false)
  const [addAiText, setAddAiText] = useState('')
  const [blocksOpen, setBlocksOpen] = useState(false)
  const [blockMenu, setBlockMenu] = useState('') // `${sectionId}:${col}` of an open + block menu
  const [pageAiText, setPageAiText] = useState('')
  const [pageAiBusy, setPageAiBusy] = useState(false)
  const [dragId, setDragId] = useState('')
  // Which optional slots the user has chosen to add (sections by id; hero by flag).
  const [heroImgOpen, setHeroImgOpen] = useState(false)
  const [heroBtnOpen, setHeroBtnOpen] = useState(false)
  const [openImg, setOpenImg] = useState<Set<string>>(new Set())
  const [openBg, setOpenBg] = useState<Set<string>>(new Set())
  const [openBtn, setOpenBtn] = useState<Set<string>>(new Set())

  const t = THEMES[theme]
  const accent = accentColor || t.accent

  const ctaPreview =
    ctaType !== 'none' ? (
      <div className="mt-6">
        <span
          className="font-label inline-block"
          style={{ background: accent, color: t.bg, padding: '12px 28px', borderRadius: 3, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}
        >
          {ctaLabel || 'Book a session'}
        </span>
      </div>
    ) : null

  const showHeroImg = heroImgOpen || Boolean(heroImage)
  const showHeroBtn = heroBtnOpen || ctaType !== 'none'
  const chipStyle: CSSProperties = { fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', border: `1px solid ${accent}66`, color: accent, padding: '5px 11px', borderRadius: 3, background: 'transparent', cursor: 'pointer' }
  const ctlLabel: CSSProperties = { fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: '#888' }
  const cancelStyle: CSSProperties = { fontSize: 11, color: '#b3402f', background: 'transparent', cursor: 'pointer' }

  function touched() {
    setSaved(false)
  }
  function newId() {
    idc.current += 1
    return 'n' + idc.current
  }
  function addSection() {
    pushUndo()
    setSections(p => [...p, { id: newId(), heading: 'New section', body: 'Tell your story here…', image: '', bgImage: '', bgColor: '', align: '', kind: 'prose', items: [], imageLayout: '', imageSize: '', imageFit: '', overlay: 50, embedUrl: '', columns: 1, reveal: false, ctaLabel: '', ctaType: 'none', ctaHref: '' }])
    touched()
  }
  function addBlock(b: (typeof SECTION_BLOCKS)[number]) {
    pushUndo()
    setSections(p => [
      ...p,
      {
        id: newId(),
        heading: b.heading,
        body: b.body,
        image: '',
        bgImage: '',
        bgColor: '',
        align: '',
        kind: b.kind ?? 'prose',
        items: (b.items ?? []).map(it => ({ id: newId(), title: it.title ?? '', body: it.body ?? '', image: '' })),
        imageLayout: '',
        imageSize: '',
        imageFit: '',
        overlay: 50,
        embedUrl: '',
        columns: 1,
        reveal: false,
        ctaLabel: b.ctaLabel ?? '',
        ctaType: b.ctaType ?? 'none',
        ctaHref: '',
      },
    ])
    setBlocksOpen(false)
    touched()
  }
  function duplicate(id: string) {
    pushUndo()
    const root = rootRef.current
    const read = (f: string) => ((root?.querySelector(`[data-field="${f}"]`) as HTMLElement | null)?.innerText ?? '')
    setSections(p => {
      const i = p.findIndex(s => s.id === id)
      if (i < 0) return p
      const src = p[i]
      const copy: EdSection = {
        ...src,
        id: newId(),
        heading: read('h-' + id) || src.heading,
        body: read('b-' + id) || src.body,
        items: src.items.map(it => ({ ...it, id: newId() })),
      }
      const n = [...p]
      n.splice(i + 1, 0, copy)
      return n
    })
    touched()
  }
  function setSectionField(id: string, patch: Partial<EdSection>) {
    // Only re-sync the editable heading/body when the change restructures the section
    // (kind, image layout, background, image) — avoids a caret jump on other edits.
    const structural = 'kind' in patch || 'imageLayout' in patch || 'bgImage' in patch || 'image' in patch
    const hEl = rootRef.current?.querySelector(`[data-field="h-${id}"]`) as HTMLElement | null
    const bEl = rootRef.current?.querySelector(`[data-field="b-${id}"]`) as HTMLElement | null
    if ('kind' in patch) pushUndo()
    else setUndoStack([])
    setSections(p =>
      p.map(s => {
        if (s.id !== id) return s
        // Capture live text on a structural change, but fall back to existing state when
        // the editable isn't mounted (e.g. a layout section renders no h-/b- field).
        const sync = structural ? { heading: hEl ? hEl.innerText : s.heading, body: bEl ? bEl.innerText : s.body } : {}
        return { ...s, ...sync, ...patch }
      }),
    )
    touched()
  }
  function addItem(sectionId: string) {
    setUndoStack([])
    setSections(p => p.map(s => (s.id === sectionId && s.items.length < 12 ? { ...s, items: [...s.items, { id: newId(), title: '', body: '', image: '' }] } : s)))
    touched()
  }
  function removeItem(sectionId: string, itemId: string) {
    setUndoStack([])
    setSections(p => p.map(s => (s.id === sectionId ? { ...s, items: s.items.filter(it => it.id !== itemId) } : s)))
    touched()
  }
  function updateItem(sectionId: string, itemId: string, patch: Partial<EdItem>) {
    setUndoStack([])
    setSections(p => p.map(s => (s.id === sectionId ? { ...s, items: s.items.map(it => (it.id === itemId ? { ...it, ...patch } : it)) } : s)))
    touched()
  }
  // Add a typed block to a column of a 'layout' section.
  function addLayoutBlock(sectionId: string, col: 0 | 1 | 2, block: BlockType) {
    setUndoStack([])
    setSections(p =>
      p.map(s =>
        s.id === sectionId && s.items.length < 16
          ? {
              ...s,
              items: [
                ...s.items,
                {
                  id: newId(),
                  title: block === 'heading' ? 'Heading' : block === 'banner' ? 'Banner title' : block === 'button' ? 'Button' : '',
                  body: block === 'text' ? 'Your text here…' : '',
                  image: '',
                  block,
                  col,
                  href: '',
                  ctaType: (block === 'button' ? 'email' : 'none') as CtaType,
                  boxColor: '',
                  outline: false,
                },
              ],
            }
          : s,
      ),
    )
    setBlockMenu('')
    touched()
  }
  // Convert a normal section into a free-layout one, seeding heading + text blocks.
  function toLayout(id: string) {
    const h = domText('h-' + id)
    const b = domText('b-' + id)
    pushUndo()
    setSections(p =>
      p.map(s => {
        if (s.id !== id) return s
        const hasBlocks = s.items.some(it => it.block)
        const items: EdItem[] = hasBlocks
          ? s.items
          : [
              { id: newId(), title: h || s.heading || 'Heading', body: '', image: '', block: 'heading', col: 0, href: '', ctaType: 'none', boxColor: '', outline: false },
              { id: newId(), title: '', body: b || s.body || 'Your text here…', image: '', block: 'text', col: 0, href: '', ctaType: 'none', boxColor: '', outline: false },
            ]
        return { ...s, kind: 'layout', columns: s.columns || 1, items }
      }),
    )
    touched()
  }
  // Change a layout section's column count, re-homing any block left in a dropped column.
  function setColumns(id: string, n: number) {
    setUndoStack([])
    setSections(p => p.map(s => (s.id === id ? { ...s, columns: n, items: s.items.map(it => ({ ...it, col: it.col != null && it.col > n - 1 ? ((n - 1) as 0 | 1 | 2) : it.col })) } : s)))
    touched()
  }
  function sectionBtnChange(id: string, patch: BtnPatch) {
    setSectionField(id, {
      ...(patch.type !== undefined ? { ctaType: patch.type } : {}),
      ...(patch.label !== undefined ? { ctaLabel: patch.label } : {}),
      ...(patch.href !== undefined ? { ctaHref: patch.href } : {}),
    })
  }
  function heroBtnChange(patch: BtnPatch) {
    if (patch.type !== undefined) setCtaType(patch.type)
    if (patch.label !== undefined) setCtaLabel(patch.label)
    if (patch.href !== undefined) setCtaHref(patch.href)
    touched()
  }
  function domText(field: string) {
    return (rootRef.current?.querySelector(`[data-field="${field}"]`) as HTMLElement | null)?.innerText ?? ''
  }
  async function runSectionAi(id: string, instruction: string) {
    setAiBusy(true)
    try {
      const res = await aiSectionAction({ siteId, instruction, heading: domText('h-' + id), body: domText('b-' + id) })
      const h = rootRef.current?.querySelector(`[data-field="h-${id}"]`) as HTMLElement | null
      const b = rootRef.current?.querySelector(`[data-field="b-${id}"]`) as HTMLElement | null
      if (h && res.heading) h.innerText = res.heading
      if (b && res.body) b.innerText = res.body
      // Keep state in sync (so a later remount doesn't lose it) and clear undo.
      setUndoStack([])
      setSections(p => p.map(s => (s.id === id ? { ...s, heading: res.heading || s.heading, body: res.body || s.body } : s)))
      touched()
    } finally {
      setAiBusy(false)
      setAiFor('')
      setAiText('')
    }
  }
  async function addAiSection() {
    const prompt = addAiText.trim()
    if (!prompt) return
    pushUndo()
    setAiBusy(true)
    try {
      const res = await aiSectionAction({ siteId, instruction: prompt, heading: '', body: '' })
      setSections(p => [...p, { id: newId(), heading: res.heading || 'New section', body: res.body || '', image: '', bgImage: '', bgColor: '', align: '', kind: 'prose', items: [], imageLayout: '', imageSize: '', imageFit: '', overlay: 50, embedUrl: '', columns: 1, reveal: false, ctaLabel: '', ctaType: 'none', ctaHref: '' }])
      touched()
    } finally {
      setAiBusy(false)
      setAddAiOpen(false)
      setAddAiText('')
    }
  }
  // The in-editor assistant: rewrite the whole current page from an instruction.
  async function runPageAi() {
    const instruction = pageAiText.trim()
    if (!instruction) return
    setPageAiBusy(true)
    try {
      const cur = sections.map(s => ({ heading: domText('h-' + s.id), body: domText('b-' + s.id) }))
      const res = await aiPageAction({ siteId, instruction, headline: domText('headline'), subheadline: domText('subheadline'), sections: cur })
      if (res) {
        const h = rootRef.current?.querySelector('[data-field="headline"]') as HTMLElement | null
        const sh = rootRef.current?.querySelector('[data-field="subheadline"]') as HTMLElement | null
        if (h) h.innerText = res.headline
        if (sh) sh.innerText = res.subheadline
        pushUndo()
        const sameShape = res.sections.length === sections.length
        setSections(
          res.sections.map((sec, i) => {
            // Only carry a section's media/layout/items across the rewrite when the
            // AI returned the same number of sections (so index i still maps 1:1).
            const old = sameShape ? sections[i] : undefined
            return { id: newId(), heading: sec.heading, body: sec.body, image: old?.image ?? '', bgImage: old?.bgImage ?? '', bgColor: old?.bgColor ?? '', align: old?.align ?? '', kind: old?.kind ?? 'prose', items: old?.items ?? [], imageLayout: old?.imageLayout ?? '', imageSize: old?.imageSize ?? '', imageFit: old?.imageFit ?? '', overlay: typeof old?.overlay === 'number' ? old.overlay : 50, embedUrl: old?.embedUrl ?? '', columns: typeof old?.columns === 'number' ? old.columns : 1, reveal: old?.reveal ?? false, ctaLabel: old?.ctaLabel ?? '', ctaType: old?.ctaType ?? 'none', ctaHref: old?.ctaHref ?? '' }
          }),
        )
        setPageAiText('')
        touched()
      }
    } finally {
      setPageAiBusy(false)
    }
  }
  // Drag a section onto another to drop it into that position.
  function reorder(srcId: string, destId: string) {
    setUndoStack([])
    setSections(p => {
      const from = p.findIndex(s => s.id === srcId)
      const to = p.findIndex(s => s.id === destId)
      if (from < 0 || to < 0 || from === to) return p
      const n = [...p]
      const [moved] = n.splice(from, 1)
      n.splice(to, 0, moved)
      return n
    })
    setDragId('')
    touched()
  }
  // Snapshot the current sections + hero text (all with live DOM text) so a structural
  // change can be undone. Cleared by any other edit (see setUndoStack([]) calls).
  function pushUndo() {
    const snap = sections.map(s => ({ ...s, heading: domText('h-' + s.id), body: domText('b-' + s.id), items: s.items.map(it => ({ ...it })) }))
    setUndoStack(st => [...st.slice(-9), { sections: snap, headline: domText('headline'), subheadline: domText('subheadline') }])
  }
  function undo() {
    if (!undoStack.length) return
    const prev = undoStack[undoStack.length - 1]
    setSections(prev.sections)
    setUndoNonce(n => n + 1) // remount sections so the contentEditable text re-syncs from state
    const h = rootRef.current?.querySelector('[data-field="headline"]') as HTMLElement | null
    const sh = rootRef.current?.querySelector('[data-field="subheadline"]') as HTMLElement | null
    if (h) h.innerText = prev.headline
    if (sh) sh.innerText = prev.subheadline
    setUndoStack(st => st.slice(0, -1))
    touched()
  }
  const updateSocial = (i: number, patch: Partial<Social>) => {
    setSocials(p => p.map((x, j) => (j === i ? { ...x, ...patch } : x)))
    touched()
  }
  const addSocial = () => {
    setSocials(p => [...p, { kind: 'instagram', url: '' }])
    touched()
  }
  const removeSocial = (i: number) => {
    setSocials(p => p.filter((_, j) => j !== i))
    touched()
  }
  function removeSection(id: string) {
    pushUndo()
    setSections(p => p.filter(s => s.id !== id))
    touched()
  }
  function move(id: string, dir: -1 | 1) {
    setUndoStack([])
    setSections(p => {
      const i = p.findIndex(s => s.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= p.length) return p
      const n = [...p]
      const tmp = n[i]
      n[i] = n[j]
      n[j] = tmp
      return n
    })
    touched()
  }
  async function save() {
    setSaving(true)
    const root = rootRef.current
    const read = (f: string) =>
      ((root?.querySelector(`[data-field="${f}"]`) as HTMLElement | null)?.innerText ?? '').trim()
    // Reads the live editable text, but falls back to state when the field isn't
    // mounted (a layout section renders no h-/b- field) so it isn't wiped to ''.
    const readOr = (f: string, fallback: string) => {
      const el = root?.querySelector(`[data-field="${f}"]`) as HTMLElement | null
      return el ? (el.innerText ?? '').trim() : fallback
    }
    const built = sections
      .map(s => {
        const isItemKind = s.kind === 'cards' || s.kind === 'faq' || s.kind === 'gallery' || s.kind === 'layout'
        const maxCol = Math.max(1, s.columns || 1) - 1
        const items = isItemKind
          ? s.items
              .map(it => ({
                title: it.title.trim() || undefined,
                body: it.body.trim() || undefined,
                image: it.image.trim() || undefined,
                block: it.block,
                col: it.col != null ? (Math.min(it.col, maxCol) as 0 | 1 | 2) : undefined,
                href: it.href?.trim() || undefined,
                ctaType: it.ctaType && it.ctaType !== 'none' ? it.ctaType : undefined,
                boxColor: it.boxColor || undefined,
                outline: it.outline || undefined,
              }))
              .filter(it => it.block || it.title || it.body || it.image)
          : []
        return {
          heading: readOr('h-' + s.id, s.heading),
          body: readOr('b-' + s.id, s.body),
          image: s.image.trim() || undefined,
          bgImage: s.bgImage.trim() || undefined,
          bgColor: s.bgColor.trim() || undefined,
          align: s.align || undefined,
          kind: s.kind === 'prose' ? undefined : s.kind,
          columns: s.kind === 'layout' ? (Math.min(3, Math.max(1, s.columns || 1)) as 1 | 2 | 3) : undefined,
          reveal: s.reveal || undefined,
          imageLayout: s.imageLayout || undefined,
          items: items.length ? items : undefined,
          imageSize: s.imageSize || undefined,
          imageFit: s.imageFit || undefined,
          overlay: s.bgImage.trim() ? s.overlay : undefined,
          embedUrl: s.kind === 'embed' ? s.embedUrl.trim() || undefined : undefined,
          ctaType: s.ctaType === 'none' ? undefined : s.ctaType,
          ctaLabel: s.ctaType === 'none' ? undefined : s.ctaLabel.trim() || 'Learn more',
          ctaHref: s.ctaType === 'link' ? s.ctaHref.trim() || undefined : undefined,
        }
      })
      .filter(s => s.heading || s.body || s.image || s.bgImage || s.embedUrl || s.kind === 'layout' || (s.items && s.items.length))
    const buildBar = (arr: EdItem[]) =>
      arr
        .map(it => ({
          title: it.title.trim() || undefined,
          body: it.body.trim() || undefined,
          image: it.image.trim() || undefined,
          block: it.block,
          href: it.href?.trim() || undefined,
          ctaType: it.ctaType && it.ctaType !== 'none' ? it.ctaType : undefined,
          boxColor: it.boxColor || undefined,
          outline: it.outline || undefined,
        }))
        .filter(it => it.block === 'divider' || it.title || it.body || it.image)
    const builtHeader = buildBar(headerItems)
    const builtFooter = buildBar(footerItems)
    const content: SiteContent = {
      theme,
      accentColor: accentColor || undefined,
      layout,
      fontSystem,
      brand: read('brand') || initial?.brand || undefined,
      logoImage: logoImage.trim() || undefined,
      faviconImage: faviconImage.trim() || undefined,
      menuPosition: menuPosition !== 'top' ? menuPosition : undefined,
      navLinks: navLinks.length ? navLinks : undefined,
      headerItems: builtHeader.length ? builtHeader : undefined,
      footerItems: builtFooter.length ? builtFooter : undefined,
      seoTitle: seoTitle.trim() || undefined,
      seoDescription: seoDescription.trim() || undefined,
      headline: read('headline'),
      subheadline: read('subheadline'),
      heroImage: heroImage.trim() || undefined,
      sections: built,
      ctaType: ctaType === 'none' ? undefined : ctaType,
      ctaLabel: ctaType === 'none' ? undefined : ctaLabel.trim() || 'Book a session',
      ctaHref: ctaType === 'link' ? ctaHref.trim() || undefined : undefined,
      contactLabel: read('contactLabel') || undefined,
      contactEmail: contactEmail.trim(),
      footer: read('footer') || undefined,
      socials: socials.length ? socials : undefined,
      heroOverlay: heroImage.trim() ? heroOverlay : undefined,
    }
    const fd = new FormData()
    fd.set('id', siteId)
    fd.set('pageSlug', pageSlug)
    fd.set('content', JSON.stringify(content))
    try {
      await saveSiteContentJsonAction(fd)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <style>{`.ht-ed[contenteditable]:hover{background:rgba(128,128,128,0.14);border-radius:4px}.ht-ed[contenteditable]:empty:before{content:'Click to edit';opacity:.4}`}</style>

      <div
        className="sticky top-0 z-20 -mx-6 px-6 py-3 mb-3 border-b border-gold/15 flex flex-wrap items-center gap-3"
        style={{ background: 'rgba(246,240,230,0.97)', backdropFilter: 'blur(4px)' }}
      >
        <span className="font-label text-[10px] tracking-[2px] uppercase text-gold/70">Look</span>
        {(Object.keys(THEMES) as Array<keyof typeof THEMES>).map(key => (
          <button
            key={key}
            type="button"
            aria-label={THEMES[key].label}
            title={THEMES[key].label}
            onClick={() => {
              setTheme(key)
              touched()
            }}
            className={`w-6 h-6 rounded-full ${theme === key ? 'ring-2 ring-gold' : ''}`}
            style={{ background: THEMES[key].bg, boxShadow: `inset 0 0 0 3px ${THEMES[key].accent}` }}
          />
        ))}
        <label className="flex items-center gap-1.5 font-label text-[9px] tracking-[2px] uppercase text-ash ml-1">
          accent
          <input
            type="color"
            value={accent}
            onChange={e => {
              setAccentColor(e.target.value)
              touched()
            }}
            className="w-7 h-7 rounded cursor-pointer bg-transparent"
            style={{ border: '1px solid rgba(201,168,76,0.3)' }}
          />
        </label>
        <span className="flex items-center gap-1.5 font-label text-[9px] tracking-[2px] uppercase text-ash ml-1">
          width
          <button
            type="button"
            onClick={() => { setLayout('contained'); touched() }}
            className={`px-2 py-1 rounded-sm ${layout === 'contained' ? 'bg-gold text-background' : 'border border-gold/30 text-gold'}`}
          >
            Middle
          </button>
          <button
            type="button"
            onClick={() => { setLayout('full'); touched() }}
            className={`px-2 py-1 rounded-sm ${layout === 'full' ? 'bg-gold text-background' : 'border border-gold/30 text-gold'}`}
          >
            Full
          </button>
        </span>
        <span className="flex items-center gap-1.5 font-label text-[9px] tracking-[2px] uppercase text-ash ml-1">
          menu
          {(['top', 'scroll', 'side'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { setMenuPosition(m); touched() }}
              className={`px-2 py-1 rounded-sm ${menuPosition === m ? 'bg-gold text-background' : 'border border-gold/30 text-gold'}`}
            >
              {m}
            </button>
          ))}
        </span>
        <label className="flex items-center gap-1.5 font-label text-[9px] tracking-[2px] uppercase text-ash ml-1">
          font
          <select
            value={fontSystem}
            onChange={e => { setFontSystem(e.target.value); touched() }}
            className="bg-surface border border-gold/30 text-parchment rounded-sm px-1.5 py-1"
            style={{ fontSize: 11 }}
          >
            {FONT_SYSTEMS.map(f => (
              <option key={f.key} value={f.key}>{f.name}</option>
            ))}
          </select>
        </label>
        <div className="flex-1" />
        <button
          type="button"
          onClick={addSection}
          className="font-label text-[10px] tracking-[2px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-3 py-2 rounded-sm"
        >
          + Section
        </button>
        <button
          type="button"
          onClick={() => setBlocksOpen(o => !o)}
          className="font-label text-[10px] tracking-[2px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-3 py-2 rounded-sm"
        >
          + Block
        </button>
        <button
          type="button"
          onClick={() => setAddAiOpen(o => !o)}
          className="font-label text-[10px] tracking-[2px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-3 py-2 rounded-sm"
        >
          ✨ AI section
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={!undoStack.length}
          title="Undo the last add, delete or AI change"
          className="font-label text-[10px] tracking-[2px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-3 py-2 rounded-sm disabled:opacity-30"
        >
          ↩ Undo
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="font-label text-[10px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-4 py-2 rounded-sm disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save & publish'}
        </button>
        {siteStatus === 'live' && (
          <a
            href={pageSlug ? `/s/${siteSlug}/${pageSlug}` : `/s/${siteSlug}`}
            target="_blank"
            rel="noreferrer"
            className="font-label text-[10px] tracking-[2px] uppercase text-gold hover:text-goldLight"
          >
            View ↗
          </a>
        )}
      </div>

      <p className="font-body text-ash/60 text-xs mb-3 text-center">
        Click any text below to edit it. Recolour with the swatches above. Then Save &amp; publish.
      </p>

      <div className="border border-gold/30 bg-gold/5 rounded-sm p-3 mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="font-label text-[9px] tracking-[2px] uppercase text-gold/70 shrink-0">✨ AI assistant</span>
        <input
          value={pageAiText}
          onChange={e => setPageAiText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') runPageAi() }}
          placeholder="Ask AI to change this page (e.g. make it more premium, add a testimonials section)"
          className="flex-1 bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-3 py-2 rounded-sm outline-none placeholder:text-ash/40"
        />
        <button
          type="button"
          onClick={runPageAi}
          disabled={pageAiBusy || !pageAiText.trim()}
          className="font-label text-[10px] tracking-[2px] uppercase bg-gold text-background hover:bg-goldLight px-4 py-2 rounded-sm disabled:opacity-50"
        >
          {pageAiBusy ? 'Working…' : 'Ask AI'}
        </button>
      </div>

      <details className="border border-gold/15 rounded-sm p-4 mb-4">
        <summary className="font-label text-[9px] tracking-[3px] uppercase text-gold/60 cursor-pointer">Search &amp; social (SEO)</summary>
        <div className="space-y-3 mt-3">
          <input
            value={seoTitle}
            onChange={e => { setSeoTitle(e.target.value); touched() }}
            placeholder="Page title for Google & the browser tab (e.g. Anima Temple — Reiki & Soul Readings)"
            className="w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-3 py-2 rounded-sm outline-none placeholder:text-ash/40"
          />
          <textarea
            value={seoDescription}
            onChange={e => { setSeoDescription(e.target.value); touched() }}
            rows={2}
            placeholder="Short description shown in Google results and link previews (1–2 sentences)"
            className="w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-3 py-2 rounded-sm outline-none resize-none placeholder:text-ash/40"
          />
        </div>
      </details>

      <div ref={rootRef} className="rounded-sm overflow-hidden border border-gold/15" style={{ background: t.bg, color: t.text, ...fontVars(fontSystem) } as unknown as CSSProperties}>
        <div className="px-6 py-5 text-center" style={{ borderBottom: `1px solid ${accent}33` }}>
          {logoImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logoImage} alt="" style={{ height: 44, maxWidth: 200, objectFit: 'contain', display: 'inline-block' }} />
          ) : (
            <div className="ht-ed inline-block" contentEditable suppressContentEditableWarning data-field="brand" style={{ ...edStyle, fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', color: accent }}>
              {initial?.brand || siteName}
            </div>
          )}
          {(navPages.length > 1 || navLinks.length > 0) && (
            <div className="flex flex-wrap items-center justify-center gap-4 mt-3">
              {navPages.map(p => (
                <span key={p.slug} className="font-label" style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: p.slug === pageSlug ? accent : t.muted }}>
                  {p.label}
                </span>
              ))}
              {navLinks.map((l, i) => (
                <span key={`nl-${i}`} className="font-label" style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: t.muted }}>
                  {l.label}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-2" style={{ background: 'rgba(128,128,128,0.06)' }}>
          <div className="max-w-md mx-auto space-y-2">
            {((!logoImage && !logoOpen) || (!faviconImage && !faviconOpen)) && (
              <div className="flex flex-wrap gap-2 justify-center">
                {!logoImage && !logoOpen && <button type="button" onClick={() => setLogoOpen(true)} className="font-label" style={chipStyle}>+ Logo image</button>}
                {!faviconImage && !faviconOpen && <button type="button" onClick={() => setFaviconOpen(true)} className="font-label" style={chipStyle}>+ Favicon (tab icon)</button>}
              </div>
            )}
            {(logoImage || logoOpen) && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span style={ctlLabel}>Logo (shown instead of the name)</span>
                  {!logoImage && <button type="button" onClick={() => setLogoOpen(false)} style={cancelStyle}>× cancel</button>}
                </div>
                <ImageField value={logoImage} onChange={v => { setLogoImage(v); touched() }} />
              </div>
            )}
            {(faviconImage || faviconOpen) && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span style={ctlLabel}>Favicon — browser-tab icon (a small square works best)</span>
                  {!faviconImage && <button type="button" onClick={() => setFaviconOpen(false)} style={cancelStyle}>× cancel</button>}
                </div>
                <ImageField value={faviconImage} onChange={v => { setFaviconImage(v); touched() }} maxW={128} />
              </div>
            )}
            <div className="pt-2 mt-1" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
              <BarBlocksEditor
                title="Header"
                hint="Build your own header bar — add a logo, a tagline, or a link. Leave empty to keep the simple logo + menu above."
                items={headerItems}
                setItems={setHeaderItems}
                accent={accent}
                onTouch={touched}
                newId={() => 'b' + idc.current++}
              />
            </div>
          </div>
        </div>

        {heroImage ? (
          <div className="relative" style={{ minHeight: 300 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${heroOverlay / 100})` }} />
            <div className="relative px-6 py-24 text-center">
              <div className="ht-ed font-display text-4xl md:text-5xl italic" contentEditable suppressContentEditableWarning data-field="headline" style={{ ...edStyle, color: '#fff' }}>
                {initial?.headline || siteName}
              </div>
              <div className="ht-ed font-body text-lg mt-4" contentEditable suppressContentEditableWarning data-field="subheadline" style={{ ...edStyle, color: 'rgba(255,255,255,0.9)' }}>
                {initial?.subheadline ?? ''}
              </div>
              {ctaPreview}
            </div>
          </div>
        ) : (
          <div className="px-6 pt-16 pb-10 text-center">
            <div className="ht-ed font-display text-4xl md:text-5xl italic" contentEditable suppressContentEditableWarning data-field="headline" style={{ ...edStyle, color: t.text }}>
              {initial?.headline || siteName}
            </div>
            <div className="ht-ed font-body text-lg mt-4" contentEditable suppressContentEditableWarning data-field="subheadline" style={{ ...edStyle, color: t.muted }}>
              {initial?.subheadline ?? ''}
            </div>
            {ctaPreview}
            <div className="mx-auto mt-6 h-px w-16" style={{ background: accent }} />
          </div>
        )}

        <div className="px-6 py-3" style={{ background: 'rgba(128,128,128,0.06)' }}>
          <div className="max-w-md mx-auto space-y-2">
            {(!showHeroImg || !showHeroBtn) && (
              <div className="flex flex-wrap gap-2 justify-center">
                {!showHeroImg && <button type="button" onClick={() => setHeroImgOpen(true)} className="font-label" style={chipStyle}>+ Hero image</button>}
                {!showHeroBtn && <button type="button" onClick={() => setHeroBtnOpen(true)} className="font-label" style={chipStyle}>+ Hero button</button>}
              </div>
            )}
            {showHeroImg && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span style={ctlLabel}>Hero image</span>
                  {!heroImage && <button type="button" onClick={() => setHeroImgOpen(false)} style={cancelStyle}>× cancel</button>}
                </div>
                <ImageField value={heroImage} onChange={v => { setHeroImage(v); touched() }} />
                {heroImage && (
                  <label className="flex items-center gap-2 mt-2" style={{ fontSize: 12, color: '#666' }}>
                    Darken
                    <input type="range" min={0} max={80} step={5} value={heroOverlay} onChange={e => { setHeroOverlay(parseInt(e.target.value, 10)); touched() }} style={{ flex: 1 }} />
                    {heroOverlay}%
                  </label>
                )}
              </div>
            )}
            {showHeroBtn && (
              <div>
                {ctaType === 'none' && (
                  <div className="flex justify-end mb-1">
                    <button type="button" onClick={() => setHeroBtnOpen(false)} style={cancelStyle}>× cancel</button>
                  </div>
                )}
                <ButtonControl title="Hero button" type={ctaType} label={ctaLabel} href={ctaHref} siteSlug={siteSlug} onChange={heroBtnChange} />
              </div>
            )}
          </div>
        </div>

        <div className={`${layout === 'full' ? 'max-w-5xl' : 'max-w-2xl'} mx-auto px-6 py-10 space-y-10`}>
          {sections.map(s => {
            const onBg = Boolean(s.bgImage) && s.kind === 'prose'
            const showImg = openImg.has(s.id) || Boolean(s.image)
            const showSecBg = openBg.has(s.id) || Boolean(s.bgImage)
            const showSecBtn = openBtn.has(s.id) || s.ctaType !== 'none'
            const btnPreview =
              s.ctaType !== 'none' ? (
                <div className="mt-4">
                  <span className="font-label inline-block" style={{ background: accent, color: t.bg, padding: '10px 24px', borderRadius: 3, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>
                    {s.ctaLabel || 'Learn more'}
                  </span>
                </div>
              ) : null
            const headingEl = (
              <div className="ht-ed font-display text-2xl md:text-3xl italic mb-2" contentEditable suppressContentEditableWarning data-field={'h-' + s.id} style={{ ...edStyle, color: accent }}>
                {s.heading}
              </div>
            )
            const bodyEl = (
              <div className="ht-ed font-body leading-relaxed whitespace-pre-wrap" contentEditable suppressContentEditableWarning data-field={'b-' + s.id} style={{ ...edStyle, color: t.text, opacity: 0.88 }}>
                {s.body}
              </div>
            )
            const imageEl = s.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={s.image} alt="" className="w-full rounded-sm" style={{ maxHeight: 360, objectFit: 'cover' }} />
            ) : null
            const sideBySide = s.kind === 'prose' && s.image && (s.imageLayout === 'imageLeft' || s.imageLayout === 'imageRight')
            const itemsWrap =
              s.kind === 'faq'
                ? 'space-y-2 mt-4'
                : s.kind === 'gallery'
                  ? 'grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4'
                  : 'grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4'
            const itemsEditor =
              s.kind === 'cards' || s.kind === 'faq' || s.kind === 'gallery' ? (
                <div className={itemsWrap} style={{ textAlign: 'left' }}>
                  {s.items.map(it => (
                    <div key={it.id} className="relative rounded-sm" style={{ border: `1px solid ${accent}33`, background: 'rgba(255,255,255,0.55)', padding: 12 }}>
                      <button type="button" onClick={() => removeItem(s.id, it.id)} className="absolute z-10" style={{ top: 4, right: 6, fontSize: 12, color: '#b3402f' }} aria-label="Remove item">✕</button>
                      {(s.kind === 'cards' || s.kind === 'gallery') && (
                        <div className={s.kind === 'gallery' ? '' : 'mb-2'}>
                          <ImageField value={it.image} onChange={v => updateItem(s.id, it.id, { image: v })} />
                        </div>
                      )}
                      {s.kind !== 'gallery' && (
                        <>
                          <input
                            value={it.title}
                            onChange={e => updateItem(s.id, it.id, { title: e.target.value })}
                            placeholder={s.kind === 'faq' ? 'Question' : 'Title'}
                            className="w-full"
                            style={{ background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, color: accent }}
                          />
                          <textarea
                            value={it.body}
                            onChange={e => updateItem(s.id, it.id, { body: e.target.value })}
                            placeholder={s.kind === 'faq' ? 'Answer' : 'Description'}
                            rows={2}
                            className="w-full mt-1 resize-none"
                            style={{ background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font-body)', fontSize: 14, color: t.text, opacity: 0.85 }}
                          />
                        </>
                      )}
                    </div>
                  ))}
                  {s.items.length < 12 && (
                    <button type="button" onClick={() => addItem(s.id)} className="rounded-sm" style={{ border: `1.5px dashed ${accent}`, color: accent, padding: 16, fontSize: 13 }}>
                      + Add {s.kind === 'faq' ? 'question' : s.kind === 'gallery' ? 'photo' : 'card'}
                    </button>
                  )}
                </div>
              ) : null
            const embedEditor =
              s.kind === 'embed' ? (
                <div className="mt-4" style={{ textAlign: 'left' }}>
                  <input
                    value={s.embedUrl}
                    onChange={e => setSectionField(s.id, { embedUrl: e.target.value })}
                    placeholder="Paste a YouTube, Vimeo or Google Maps link"
                    className="w-full"
                    style={{ ...urlInput, fontSize: 13, padding: '8px 10px', borderRadius: 3 }}
                  />
                  {s.embedUrl && (
                    <p style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                      Shows as an embedded video/map on your live site.{' '}
                      <a href={s.embedUrl} target="_blank" rel="noreferrer" style={{ color: accent, textDecoration: 'underline' }}>Open ↗</a>
                    </p>
                  )}
                </div>
              ) : null
            const layoutEditor =
              s.kind === 'layout' ? (
                <div className={`flex flex-col gap-4 mt-2 ${(s.columns || 1) >= 2 ? 'md:flex-row md:items-start' : ''}`} style={{ textAlign: 'left' }}>
                  {Array.from({ length: s.columns || 1 }).map((_, col) => (
                    <div key={col} className="flex-1 min-w-0 space-y-3">
                      {s.items.filter(it => Math.min(it.col ?? 0, (s.columns || 1) - 1) === col).map(it => (
                        <div key={it.id} className="rounded-sm" style={{ border: it.outline ? `1px solid ${accent}55` : '1px solid rgba(0,0,0,0.1)', background: it.outline ? 'transparent' : it.boxColor || 'rgba(255,255,255,0.55)', padding: 10 }}>
                          <div className="flex items-center justify-between mb-1">
                            <span style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: '#999' }}>{it.block || 'text'}</span>
                            <div className="flex items-center gap-2">
                              {(s.columns || 1) >= 2 && (
                                <button type="button" title="Move to next column" onClick={() => updateItem(s.id, it.id, { col: (((it.col ?? 0) + 1) % (s.columns || 1)) as 0 | 1 | 2 })} style={{ fontSize: 13, color: accent }}>⇄</button>
                              )}
                              {it.block !== 'divider' && it.block !== 'spacer' && (
                                <input type="color" value={it.boxColor || '#ffffff'} onChange={e => updateItem(s.id, it.id, { boxColor: e.target.value })} title="Box colour" style={{ width: 20, height: 18, border: '1px solid rgba(0,0,0,0.2)', borderRadius: 3, background: 'transparent', padding: 0 }} />
                              )}
                              {it.block !== 'divider' && it.block !== 'spacer' && (
                                <button type="button" title="Outline box" onClick={() => updateItem(s.id, it.id, { outline: !it.outline })} style={{ fontSize: 13, lineHeight: 1, color: it.outline ? accent : '#bbb' }}>▢</button>
                              )}
                              {it.boxColor && <button type="button" onClick={() => updateItem(s.id, it.id, { boxColor: '' })} title="No box" style={{ fontSize: 11, color: '#888' }}>×</button>}
                              <button type="button" onClick={() => removeItem(s.id, it.id)} style={{ fontSize: 12, color: '#b3402f' }} aria-label="Remove block">✕</button>
                            </div>
                          </div>
                          {it.block === 'heading' && (
                            <input value={it.title} onChange={e => updateItem(s.id, it.id, { title: e.target.value })} placeholder="Heading" className="w-full" style={{ background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 20, color: accent }} />
                          )}
                          {(it.block === 'text' || !it.block) && (
                            <textarea value={it.body} onChange={e => updateItem(s.id, it.id, { body: e.target.value })} placeholder="Your text…" rows={3} className="w-full resize-none" style={{ background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font-body)', fontSize: 14, color: t.text, opacity: 0.85 }} />
                          )}
                          {it.block === 'image' && <ImageField value={it.image} onChange={v => updateItem(s.id, it.id, { image: v })} />}
                          {it.block === 'button' && (
                            <div className="space-y-1">
                              <input value={it.title} onChange={e => updateItem(s.id, it.id, { title: e.target.value })} placeholder="Button text" className="w-full" style={{ ...urlInput, fontSize: 13, padding: '6px 8px', borderRadius: 3 }} />
                              <select value={it.ctaType || 'none'} onChange={e => updateItem(s.id, it.id, { ctaType: e.target.value as CtaType })} style={{ ...urlInput, fontSize: 12, padding: '4px 6px', borderRadius: 3 }}>
                                <option value="none">No link</option>
                                <option value="booking">→ Booking page</option>
                                <option value="email">→ Email me</option>
                                <option value="link">→ Custom link</option>
                              </select>
                              {it.ctaType === 'link' && <input value={it.href || ''} onChange={e => updateItem(s.id, it.id, { href: e.target.value })} placeholder="https://…" className="w-full" style={{ ...urlInput, fontSize: 12, padding: '6px 8px', borderRadius: 3 }} />}
                            </div>
                          )}
                          {it.block === 'banner' && (
                            <div className="space-y-1">
                              <ImageField value={it.image} onChange={v => updateItem(s.id, it.id, { image: v })} />
                              <input value={it.title} onChange={e => updateItem(s.id, it.id, { title: e.target.value })} placeholder="Banner title" className="w-full" style={{ ...urlInput, fontSize: 13, padding: '6px 8px', borderRadius: 3 }} />
                              <textarea value={it.body} onChange={e => updateItem(s.id, it.id, { body: e.target.value })} placeholder="Banner text" rows={2} className="w-full resize-none" style={{ ...urlInput, fontSize: 12, padding: '6px 8px', borderRadius: 3 }} />
                            </div>
                          )}
                          {it.block === 'divider' && <div style={{ height: 1, background: accent, opacity: 0.4 }} />}
                          {it.block === 'spacer' && <div style={{ height: 24, background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.05) 4px, rgba(0,0,0,0.05) 8px)' }} />}
                        </div>
                      ))}
                      {blockMenu === `${s.id}:${col}` ? (
                        <div className="flex flex-wrap gap-1 rounded-sm" style={{ border: `1px dashed ${accent}`, padding: 8 }}>
                          {BLOCK_CHIPS.map(bc => (
                            <button key={bc.type} type="button" onClick={() => addLayoutBlock(s.id, col as 0 | 1 | 2, bc.type)} className="font-label" style={{ ...chipStyle, fontSize: 11 }}>
                              {bc.label}
                            </button>
                          ))}
                          <button type="button" onClick={() => setBlockMenu('')} style={{ fontSize: 11, color: '#888' }}>cancel</button>
                        </div>
                      ) : (
                        s.items.length < 16 && (
                          <button type="button" onClick={() => setBlockMenu(`${s.id}:${col}`)} className="w-full rounded-sm" style={{ border: `1.5px dashed ${accent}`, color: accent, padding: 10, fontSize: 13 }}>
                            + block
                          </button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              ) : null
            return (
              <div
                key={`${s.id}-${undoNonce}`}
                className="group relative"
                style={{ opacity: dragId === s.id ? 0.4 : 1 }}
                onDragOver={e => { if (dragId && dragId !== s.id) e.preventDefault() }}
                onDrop={e => { e.preventDefault(); if (dragId) reorder(dragId, s.id) }}
              >
                <div className="absolute right-0 -top-3 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" title="Drag to reorder" draggable onDragStart={() => setDragId(s.id)} onDragEnd={() => setDragId('')} className="text-xs px-2 py-0.5 rounded cursor-grab" style={{ background: accent, color: t.bg }}>⠿</button>
                  <button type="button" title="Move up" onClick={() => move(s.id, -1)} className="text-xs px-2 py-0.5 rounded" style={{ background: accent, color: t.bg }}>↑</button>
                  <button type="button" title="Move down" onClick={() => move(s.id, 1)} className="text-xs px-2 py-0.5 rounded" style={{ background: accent, color: t.bg }}>↓</button>
                  <button type="button" title="Duplicate" onClick={() => duplicate(s.id)} className="text-xs px-2 py-0.5 rounded" style={{ background: accent, color: t.bg }}>⧉</button>
                  <button type="button" title="Improve with AI" onClick={() => { setAiFor(aiFor === s.id ? '' : s.id); setAiText('') }} className="text-xs px-2 py-0.5 rounded" style={{ background: accent, color: t.bg }}>✨</button>
                  <button type="button" title="Delete" onClick={() => removeSection(s.id)} className="text-xs px-2 py-0.5 rounded" style={{ background: '#b3402f', color: '#fff' }}>✕</button>
                </div>

                {onBg ? (
                  <div className="relative rounded-sm overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${s.overlay / 100})` }} />
                    <div className="relative px-6 py-16" style={{ textAlign: s.align || 'center' }}>
                      <div className="ht-ed font-display text-2xl md:text-3xl italic mb-2" contentEditable suppressContentEditableWarning data-field={'h-' + s.id} style={{ ...edStyle, color: '#fff' }}>
                        {s.heading}
                      </div>
                      <div className="ht-ed font-body leading-relaxed whitespace-pre-wrap" contentEditable suppressContentEditableWarning data-field={'b-' + s.id} style={{ ...edStyle, color: 'rgba(255,255,255,0.92)' }}>
                        {s.body}
                      </div>
                      {btnPreview}
                    </div>
                  </div>
                ) : (
                  <div style={{ background: s.bgColor || undefined, borderRadius: s.bgColor ? 6 : undefined, padding: s.bgColor ? '24px 22px' : undefined, textAlign: s.align || 'left' }}>
                    {s.kind === 'layout' ? (
                      <>
                        {layoutEditor}
                        {btnPreview}
                      </>
                    ) : sideBySide ? (
                      <div className={`flex flex-col gap-6 md:items-center ${s.imageLayout === 'imageRight' ? 'md:flex-row-reverse' : 'md:flex-row'}`}>
                        <div className="md:w-1/2 w-full">{imageEl}</div>
                        <div className="md:w-1/2 w-full">
                          {headingEl}
                          {bodyEl}
                          {btnPreview}
                        </div>
                      </div>
                    ) : s.kind === 'cards' || s.kind === 'faq' || s.kind === 'gallery' ? (
                      <>
                        {headingEl}
                        {bodyEl}
                        {itemsEditor}
                        {btnPreview}
                      </>
                    ) : s.kind === 'embed' ? (
                      <>
                        {headingEl}
                        {bodyEl}
                        {embedEditor}
                        {btnPreview}
                      </>
                    ) : (
                      <>
                        {s.image && <div className="mb-4">{imageEl}</div>}
                        {headingEl}
                        {bodyEl}
                        {btnPreview}
                      </>
                    )}
                  </div>
                )}

                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span style={ctlLabel}>Align</span>
                    {(['left', 'center', 'right'] as const).map(a => {
                      const on = (s.align || (onBg ? 'center' : 'left')) === a
                      return (
                        <button
                          key={a}
                          type="button"
                          onClick={() => setSectionField(s.id, { align: a })}
                          className="font-label"
                          style={{ ...chipStyle, ...(on ? { background: accent, color: t.bg, border: `1px solid ${accent}` } : {}) }}
                        >
                          {a[0].toUpperCase()}
                        </button>
                      )
                    })}
                    {!onBg && (
                      <>
                        <span style={{ ...ctlLabel, marginLeft: 8 }}>Tint</span>
                        <input
                          type="color"
                          value={s.bgColor || '#ffffff'}
                          onChange={e => setSectionField(s.id, { bgColor: e.target.value })}
                          style={{ width: 28, height: 24, border: '1px solid rgba(0,0,0,0.2)', borderRadius: 3, background: 'transparent', cursor: 'pointer', padding: 0 }}
                          title="Panel colour behind this section"
                        />
                        {s.bgColor && (
                          <button type="button" onClick={() => setSectionField(s.id, { bgColor: '' })} style={cancelStyle}>× no tint</button>
                        )}
                      </>
                    )}
                    <label className="flex items-center gap-1.5 ml-2" style={{ fontSize: 11, color: '#666' }}>
                      <input type="checkbox" checked={s.reveal} onChange={e => setSectionField(s.id, { reveal: e.target.checked })} style={{ accentColor: accent }} />
                      Reveal on scroll
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span style={ctlLabel}>Type</span>
                    {(['prose', 'cards', 'faq', 'gallery', 'embed'] as const).map(k => {
                      const on = s.kind === k
                      const label = k === 'prose' ? 'Text' : k === 'cards' ? 'Cards' : k === 'faq' ? 'FAQ' : k === 'gallery' ? 'Gallery' : 'Embed'
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setSectionField(s.id, { kind: k })}
                          className="font-label"
                          style={{ ...chipStyle, ...(on ? { background: accent, color: t.bg, border: `1px solid ${accent}` } : {}) }}
                        >
                          {label}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => toLayout(s.id)}
                      className="font-label"
                      style={{ ...chipStyle, ...(s.kind === 'layout' ? { background: accent, color: t.bg, border: `1px solid ${accent}` } : {}) }}
                    >
                      ⊞ Free layout
                    </button>
                    {s.kind === 'layout' && (
                      <>
                        <span style={{ ...ctlLabel, marginLeft: 8 }}>Columns</span>
                        <select
                          value={s.columns || 1}
                          onChange={e => setColumns(s.id, parseInt(e.target.value, 10))}
                          style={{ ...urlInput, fontSize: 12, padding: '4px 6px', borderRadius: 3 }}
                        >
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                        </select>
                      </>
                    )}
                    {s.kind === 'prose' && s.image && (
                      <>
                        <span style={{ ...ctlLabel, marginLeft: 8 }}>Image</span>
                        <select
                          value={s.imageLayout || 'stack'}
                          onChange={e => setSectionField(s.id, { imageLayout: e.target.value === 'stack' ? '' : (e.target.value as SectionImageLayout) })}
                          style={{ ...urlInput, fontSize: 12, padding: '4px 6px', borderRadius: 3 }}
                        >
                          <option value="stack">Above text</option>
                          <option value="imageLeft">Left of text</option>
                          <option value="imageRight">Right of text</option>
                        </select>
                        <select
                          value={s.imageSize || 'full'}
                          onChange={e => setSectionField(s.id, { imageSize: e.target.value === 'full' ? '' : (e.target.value as ImageSize) })}
                          style={{ ...urlInput, fontSize: 12, padding: '4px 6px', borderRadius: 3 }}
                        >
                          <option value="full">Full width</option>
                          <option value="md">Medium</option>
                          <option value="sm">Small</option>
                        </select>
                        <select
                          value={s.imageFit || 'cover'}
                          onChange={e => setSectionField(s.id, { imageFit: e.target.value === 'cover' ? '' : (e.target.value as ImageFit) })}
                          style={{ ...urlInput, fontSize: 12, padding: '4px 6px', borderRadius: 3 }}
                        >
                          <option value="cover">Crop to fit</option>
                          <option value="contain">Show whole image</option>
                        </select>
                      </>
                    )}
                  </div>
                  {(!showImg || !showSecBg || !showSecBtn) && (
                    <div className="flex flex-wrap gap-2">
                      {!showImg && <button type="button" onClick={() => setOpenImg(p => new Set(p).add(s.id))} className="font-label" style={chipStyle}>+ Image</button>}
                      {!showSecBg && s.kind === 'prose' && <button type="button" onClick={() => setOpenBg(p => new Set(p).add(s.id))} className="font-label" style={chipStyle}>+ Background</button>}
                      {!showSecBtn && <button type="button" onClick={() => setOpenBtn(p => new Set(p).add(s.id))} className="font-label" style={chipStyle}>+ Button</button>}
                    </div>
                  )}
                  {showImg && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span style={ctlLabel}>Inline image</span>
                        {!s.image && <button type="button" onClick={() => setOpenImg(p => { const n = new Set(p); n.delete(s.id); return n })} style={cancelStyle}>× cancel</button>}
                      </div>
                      <ImageField value={s.image} onChange={v => setSectionField(s.id, { image: v })} />
                    </div>
                  )}
                  {showSecBg && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span style={ctlLabel}>Background photo</span>
                        {!s.bgImage && <button type="button" onClick={() => setOpenBg(p => { const n = new Set(p); n.delete(s.id); return n })} style={cancelStyle}>× cancel</button>}
                      </div>
                      <ImageField value={s.bgImage} onChange={v => setSectionField(s.id, { bgImage: v })} />
                      {s.bgImage && (
                        <label className="flex items-center gap-2 mt-2" style={{ fontSize: 12, color: '#666' }}>
                          Darken
                          <input type="range" min={0} max={80} step={5} value={s.overlay} onChange={e => setSectionField(s.id, { overlay: parseInt(e.target.value, 10) })} style={{ flex: 1 }} />
                          {s.overlay}%
                        </label>
                      )}
                    </div>
                  )}
                  {showSecBtn && (
                    <div>
                      {s.ctaType === 'none' && (
                        <div className="flex justify-end mb-1">
                          <button type="button" onClick={() => setOpenBtn(p => { const n = new Set(p); n.delete(s.id); return n })} style={cancelStyle}>× cancel</button>
                        </div>
                      )}
                      <ButtonControl title="Section button" type={s.ctaType} label={s.ctaLabel} href={s.ctaHref} siteSlug={siteSlug} onChange={patch => sectionBtnChange(s.id, patch)} />
                    </div>
                  )}
                </div>
                {aiFor === s.id && (
                  <div className="mt-2 rounded-sm" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.12)', padding: 10 }}>
                    <span style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#555' }}>✨ Ask AI</span>
                    <input
                      value={aiText}
                      onChange={e => setAiText(e.target.value)}
                      placeholder="How should AI change this section? (e.g. shorter and warmer)"
                      className="w-full mt-2"
                      style={{ ...urlInput, fontSize: 13, padding: '7px 10px', borderRadius: 3 }}
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        disabled={aiBusy}
                        onClick={() => runSectionAi(s.id, 'Improve the writing — clearer, warmer and more professional, same meaning.')}
                        style={{ fontSize: 12, background: accent, color: t.bg, padding: '6px 12px', borderRadius: 3, opacity: aiBusy ? 0.5 : 1 }}
                      >
                        {aiBusy ? 'AI…' : 'Improve writing'}
                      </button>
                      <button
                        type="button"
                        disabled={aiBusy || !aiText.trim()}
                        onClick={() => runSectionAi(s.id, aiText.trim())}
                        style={{ fontSize: 12, border: `1px solid ${accent}`, color: accent, padding: '6px 12px', borderRadius: 3, opacity: aiBusy || !aiText.trim() ? 0.5 : 1 }}
                      >
                        Apply
                      </button>
                      <button type="button" onClick={() => { setAiFor(''); setAiText('') }} style={{ fontSize: 12, color: '#888' }}>
                        cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {blocksOpen && (
            <div className="rounded-sm" style={{ background: 'rgba(255,255,255,0.65)', border: `1px dashed ${accent}`, padding: 12 }}>
              <span style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#555' }}>Add a ready-made section</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {SECTION_BLOCKS.map(b => (
                  <button key={b.key} type="button" onClick={() => addBlock(b)} style={{ fontSize: 12, border: `1px solid ${accent}`, color: accent, padding: '6px 12px', borderRadius: 3 }}>
                    {b.name}
                  </button>
                ))}
                <button type="button" onClick={() => setBlocksOpen(false)} style={{ fontSize: 12, color: '#888' }}>cancel</button>
              </div>
            </div>
          )}
          {addAiOpen && (
            <div className="rounded-sm" style={{ background: 'rgba(255,255,255,0.65)', border: `1px dashed ${accent}`, padding: 12 }}>
              <span style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#555' }}>✨ New section with AI</span>
              <input
                value={addAiText}
                onChange={e => setAddAiText(e.target.value)}
                placeholder="Describe the section (e.g. a testimonials section with two short client quotes)"
                className="w-full mt-2"
                style={{ ...urlInput, fontSize: 13, padding: '7px 10px', borderRadius: 3 }}
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  disabled={aiBusy || !addAiText.trim()}
                  onClick={addAiSection}
                  style={{ fontSize: 12, background: accent, color: t.bg, padding: '7px 14px', borderRadius: 3, opacity: aiBusy || !addAiText.trim() ? 0.5 : 1 }}
                >
                  {aiBusy ? 'Writing…' : 'Generate section ✨'}
                </button>
                <button type="button" onClick={() => { setAddAiOpen(false); setAddAiText('') }} style={{ fontSize: 12, color: '#888' }}>
                  cancel
                </button>
              </div>
            </div>
          )}
          {sections.length === 0 && !addAiOpen && !blocksOpen && (
            <button type="button" onClick={addSection} className="w-full py-10 rounded-sm text-sm" style={{ border: `2px dashed ${accent}`, color: accent }}>
              + Add your first section
            </button>
          )}
        </div>

        <div className="px-6 pb-12 text-center">
          <span className="ht-ed" contentEditable suppressContentEditableWarning data-field="contactLabel" style={{ background: accent, color: t.bg, padding: '11px 26px', borderRadius: 3, display: 'inline-block', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', outline: 'none', cursor: 'text' }}>
            {initial?.contactLabel || 'Get in touch'}
          </span>
          <div className="mt-3 flex justify-center">
            <input
              value={contactEmail}
              onChange={e => {
                setContactEmail(e.target.value)
                touched()
              }}
              placeholder="contact email (the button links here)"
              className="text-xs px-3 py-1.5 rounded-sm"
              style={{ ...urlInput, width: 300 }}
            />
          </div>
        </div>

        <div className="py-8 text-center" style={{ borderTop: `1px solid ${accent}22` }}>
          <div className="ht-ed inline-block" contentEditable suppressContentEditableWarning data-field="footer" style={{ ...edStyle, fontSize: 13, color: t.muted }}>
            {initial?.footer || siteName}
          </div>
        </div>

        <div className="px-6 pb-6" style={{ background: 'rgba(128,128,128,0.06)' }}>
          <div className="max-w-md mx-auto pt-3">
            <div className="pb-3 mb-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              <BarBlocksEditor
                title="Footer"
                hint="Build your own footer — add a copyright line, an address, opening hours, or links. Leave empty to keep the simple footer line below."
                items={footerItems}
                setItems={setFooterItems}
                accent={accent}
                onTouch={touched}
                newId={() => 'b' + idc.current++}
              />
            </div>
            <p style={ctlLabel}>Social links (footer)</p>
            {socials.map((sc, i) => (
              <div key={i} className="flex items-center gap-2 mt-2">
                <select
                  value={sc.kind}
                  onChange={e => updateSocial(i, { kind: e.target.value as SocialKind })}
                  style={{ ...urlInput, fontSize: 12, padding: '5px 6px', borderRadius: 3 }}
                >
                  {(['instagram', 'facebook', 'tiktok', 'youtube', 'whatsapp', 'email', 'website'] as const).map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                <input
                  value={sc.url}
                  onChange={e => updateSocial(i, { url: e.target.value })}
                  placeholder={sc.kind === 'email' ? 'you@email.com' : 'https://…'}
                  className="flex-1"
                  style={{ ...urlInput, fontSize: 12, padding: '6px 8px', borderRadius: 3 }}
                />
                <button type="button" onClick={() => removeSocial(i)} style={{ fontSize: 12, color: '#b3402f' }} aria-label="Remove social link">✕</button>
              </div>
            ))}
            <button type="button" onClick={addSocial} className="mt-2 font-label" style={chipStyle}>+ Add social link</button>
          </div>
        </div>
      </div>
    </div>
  )
}
