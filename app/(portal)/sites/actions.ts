'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getEngine } from '@/lib/sites/engine'
import { generateSiteContent, aiSection, aiText, aiRewritePage, aiAltText, aiCritiqueDesign, aiPalette, aiPolishCopy, aiMobileLayout, type GeneratedPage, type DesignCritique, type MobileEmphasis } from '@/lib/sites/generate'
import { slugify } from '@/lib/sites/slug'
import { canvasFromContent } from '@/lib/sites/canvasFromContent'
import { submitMessage, setMessageRead, deleteMessageRecord } from '@/lib/sites/messages'
import { siteSlugForDomain } from '@/lib/sites/public'
import { cfConfigured, cfCreateHostname, cfDeleteHostname, isOwnZone } from '@/lib/sites/cloudflare'
import { getPages, MAX_SAVED_DESIGNS, BLEND_MODES, REVEAL_KINDS, HOVER_KINDS, SHADOW_KINDS, SHAPE_KINDS, CURSOR_KINDS, MENU_STYLES, TEXT_STYLE_KEYS, FORM_FIELD_TYPES, PAGE_TRANSITION_KINDS, type TextStyleProps, type FormField, type FormFieldType, type PageTransitionKind } from '@/lib/sites/types'
import { ICON_KINDS } from '@/lib/sites/icons'
import { FONT_SYSTEM_KEYS } from '@/lib/sites/fonts'
import type {
  SiteContent,
  BookingCopy,
  SavedDesign,
  SiteFont,
  SiteComponent,
  StockPhoto,
  Gradient,
  BlendMode,
  RevealKind,
  HoverKind,
  ShadowKind,
  ShapeKind,
  MenuStyle,
  CursorKind,
  ImageAdjust,
  SiteTheme,
  SitePage,
  CtaType,
  SiteLayout,
  SiteAlign,
  SectionKind,
  SectionImageLayout,
  SectionItem,
  ImageSize,
  ImageFit,
  Social,
  SocialKind,
  BlockType,
  MenuPosition,
  PageCanvas,
  CanvasElement,
  CanvasElementType,
} from '@/lib/sites/types'
import {
  createSiteRecord,
  updateSiteStatus,
  renameSiteRecord,
  setSiteDomain,
  saveSiteContent,
  deleteSiteRecord,
  getSite,
} from '@/lib/sites/store'

export async function createSiteAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const name = String(formData.get('name') ?? '').trim()
  const template = String(formData.get('template') ?? 'Blank')
  if (!name) return

  const slug = slugify(name)
  const site = await createSiteRecord(user.id, { name, slug, template, status: 'building' })

  try {
    const res = await getEngine().provision({ slug, template })
    await updateSiteStatus(site.id, res.status, res.url)
  } catch {
    await updateSiteStatus(site.id, 'failed', null)
  }

  revalidatePath('/sites')
}

export async function renameSiteAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  if (!id || !name) return

  const site = await getSite(id)
  if (!site) return

  const slug = slugify(name)
  await renameSiteRecord(id, name, slug)

  // The address depends on the slug, so re-provision to refresh the URL.
  try {
    const res = await getEngine().provision({ slug, template: site.template })
    await updateSiteStatus(id, res.status, res.url)
  } catch {
    // keep the existing url/status if the engine call fails
  }

  revalidatePath(`/sites/${id}`)
  revalidatePath('/sites')
}

export async function redeploySiteAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const id = String(formData.get('id') ?? '')
  if (!id) return

  const site = await getSite(id)
  if (!site) return

  await updateSiteStatus(id, 'building', site.url)
  try {
    const res = await getEngine().redeploy(site.slug)
    await updateSiteStatus(id, res.status, res.url)
  } catch {
    await updateSiteStatus(id, 'failed', site.url)
  }

  revalidatePath(`/sites/${id}`)
  revalidatePath('/sites')
}

export async function setDomainAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const id = String(formData.get('id') ?? '')
  if (!id) return

  // Normalise: strip protocol/path/whitespace + a leading www, lowercase.
  const raw = String(formData.get('domain') ?? '').trim().toLowerCase()
  let domain: string | null = raw.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '') || null

  if (domain) {
    const validFqdn = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain)
    // Block the platform's own host/subdomains so a site can't hijack them. www. is already
    // stripped above, so the bare apex must be checked explicitly (it doesn't end in ".animatemple.com").
    const isPlatform = domain === 'animatemple.com' || domain.endsWith('.animatemple.com')
    if (!validFqdn || isPlatform) domain = null
  }

  // Must own the site, and only act on a real change (avoids needless redeploys).
  const site = await getSite(id)
  if (!site) return
  const prev = site.domain ?? null
  if (prev === domain) {
    revalidatePath(`/sites/${id}`)
    return
  }

  // Don't let one site claim a domain another site already uses (cross-tenant guard).
  if (domain) {
    const claimant = await siteSlugForDomain(domain)
    if (claimant && claimant !== site.slug) {
      revalidatePath(`/sites/${id}`)
      return
    }
  }

  try {
    await setSiteDomain(id, domain)
    // Cloudflare for SaaS: give a customer's OWN domain edge HTTPS. Skipped for the
    // platform's own zone (animatemple.com is served directly via Traefik) and a no-op
    // until CF_SAAS_* env is configured. Fail-safe — never blocks the save.
    if (cfConfigured()) {
      if (prev && prev !== domain && !isOwnZone(prev)) await cfDeleteHostname(prev)
      if (domain && !isOwnZone(domain)) await cfCreateHostname(domain)
    }
  } catch {
    // The `domain` column may not exist yet (migration 002 not run), or a CF hiccup —
    // the domain is still saved either way.
  }

  revalidatePath(`/sites/${id}`)
}

export async function generateSiteAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const id = String(formData.get('id') ?? '')
  const description = String(formData.get('description') ?? '').trim()
  if (!id || !description) return

  const site = await getSite(id)
  if (!site) return

  const pageSlug = String(formData.get('pageSlug') ?? '')
  const gen = await generateSiteContent(site.name, description)
  const existing = site.content ?? null

  // If this page is a free-canvas page, lay the AI-written content out ON the canvas
  // (so AI and the free canvas work together) instead of writing block sections.
  const targetPage = getPages(existing).find(p => p.slug === pageSlug)
  if (targetPage?.canvas) {
    const canvas = sanitizeCanvas(canvasFromContent({
      headline: gen.headline,
      subheadline: gen.subheadline,
      heroImage: gen.heroImage,
      sections: gen.sections,
      theme: gen.theme,
      accent: existing?.accentColor,
    }))
    await setPageCanvas(id, pageSlug, canvas)
    return
  }

  const updatedPages: SitePage[] = getPages(existing).map(p =>
    p.slug === pageSlug
      ? { ...p, headline: gen.headline, subheadline: gen.subheadline, heroImage: gen.heroImage, sections: gen.sections }
      : p,
  )
  const home = updatedPages.find(p => p.slug === '') ?? updatedPages[0]
  const base: SiteContent = existing ?? { theme: 'sand', headline: '', subheadline: '', sections: [], contactEmail: '' }

  await saveSiteContent(id, {
    ...base,
    theme: gen.theme,
    headline: home.headline,
    subheadline: home.subheadline,
    heroImage: home.heroImage,
    sections: home.sections,
    pages: updatedPages,
  })

  revalidatePath(`/sites/${id}/design`)
  revalidatePath(`/sites/${id}`)
}

// Improve/rewrite (or generate) one section with AI. Returns the new text so the
// editor can drop it straight into the live preview — no full save round-trip.
export async function aiSectionAction(args: {
  siteId: string
  instruction: string
  heading: string
  body: string
}): Promise<{ heading: string; body: string }> {
  const fallback = { heading: args.heading, body: args.body }
  const user = await getCurrentUser()
  if (!user) return fallback
  const site = await getSite(args.siteId)
  if (!site) return fallback
  try {
    return await aiSection({
      siteName: site.name,
      instruction: args.instruction || 'Improve the writing — clearer, warmer and more professional, same meaning.',
      heading: args.heading,
      body: args.body,
    })
  } catch {
    return fallback
  }
}

// Write/redesign a whole free-canvas page with AI from a plain-language description.
// Returns a laid-out canvas the editor drops in (undoable) — it does NOT persist, so
// the owner reviews/tweaks and saves normally.
export async function aiCanvasAction(args: {
  siteId: string
  description: string
}): Promise<{ ok: boolean; canvas?: PageCanvas }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false }
  const site = await getSite(args.siteId)
  if (!site) return { ok: false }
  const desc = String(args.description ?? '').trim()
  if (!desc) return { ok: false }
  try {
    const gen = await generateSiteContent(site.name, desc)
    const canvas = sanitizeCanvas(canvasFromContent({
      headline: gen.headline,
      subheadline: gen.subheadline,
      heroImage: gen.heroImage,
      sections: gen.sections,
      theme: gen.theme,
      accent: site.content?.accentColor,
    }))
    return { ok: true, canvas }
  } catch {
    return { ok: false }
  }
}

// Rewrite a single text element on the free canvas with AI. Returns the new text so
// the editor can drop it straight onto the element (no full save round-trip).
export async function aiTextAction(args: {
  siteId: string
  instruction: string
  text: string
}): Promise<{ text: string }> {
  const fallback = { text: args.text }
  const user = await getCurrentUser()
  if (!user) return fallback
  const site = await getSite(args.siteId)
  if (!site) return fallback
  try {
    return await aiText({
      siteName: site.name,
      instruction: args.instruction || 'Improve the writing — clearer, warmer and more professional, same meaning.',
      text: args.text,
      brandVoice: site.content?.brandVoice,
    })
  } catch {
    return fallback
  }
}

// Owner-only: suggest alt text for an image via Claude vision. Returns {alt} or an
// {error} the editor can surface gently. Caps the payload so a huge data URL can't
// blow the action body limit.
export async function suggestAltAction(src: string): Promise<{ alt: string; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { alt: '', error: 'auth' }
  const s = String(src ?? '').trim()
  if (!s) return { alt: '', error: 'nosrc' }
  if (s.length > 7_000_000) return { alt: '', error: 'toobig' }
  try {
    return await aiAltText(s)
  } catch {
    return { alt: '', error: 'failed' }
  }
}

// The in-editor "design pair": Claude reviews a compact text summary of the canvas
// and returns a few warm, specific design + accessibility notes. No save, read-only.
export async function critiqueDesignAction(args: { siteId: string; summary: string }): Promise<DesignCritique | { error: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'auth' }
  const site = await getSite(args.siteId)
  if (!site) return { error: 'notfound' }
  const summary = String(args.summary ?? '').trim()
  if (!summary) return { error: 'empty' }
  try {
    return await aiCritiqueDesign({ siteName: site.name, summary: summary.slice(0, 20_000), brandVoice: site.content?.brandVoice })
  } catch {
    return { error: 'failed' }
  }
}

// Decide a phone layout for the canvas (the editor applies the hints as a clean stack).
export async function mobileLayoutAction(args: { siteId: string; items: { id: string; type: string; text: string; w: number; h: number }[] }): Promise<{ items: { id: string; order: number; emphasis: MobileEmphasis; hide: boolean }[] } | { error: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'auth' }
  const site = await getSite(args.siteId)
  if (!site) return { error: 'notfound' }
  const items = (Array.isArray(args.items) ? args.items : [])
    .map(it => ({ id: String(it?.id ?? '').slice(0, 40), type: String(it?.type ?? '').slice(0, 20), text: String(it?.text ?? '').slice(0, 80), w: Math.max(0, Math.round(Number(it?.w) || 0)), h: Math.max(0, Math.round(Number(it?.h) || 0)) }))
    .filter(it => it.id)
    .slice(0, 40)
  if (!items.length) return { error: 'empty' }
  try {
    return await aiMobileLayout({ siteName: site.name, items })
  } catch {
    return { error: 'failed' }
  }
}

// Polish all the copy on a canvas page in a chosen tone (batched, brand-voice aware).
export async function polishCopyAction(args: { siteId: string; tone: string; items: { id: string; text: string }[] }): Promise<{ items: { id: string; text: string }[] } | { error: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'auth' }
  const site = await getSite(args.siteId)
  if (!site) return { error: 'notfound' }
  const TONES = ['warmer', 'calmer', 'more premium', 'punchier']
  const tone = TONES.includes(String(args.tone)) ? String(args.tone) : 'warmer'
  const items = (Array.isArray(args.items) ? args.items : [])
    .map(it => ({ id: String(it?.id ?? '').slice(0, 40), text: String(it?.text ?? '').slice(0, 500) }))
    .filter(it => it.id && it.text)
    .slice(0, 30)
  if (!items.length) return { error: 'empty' }
  try {
    return await aiPolishCopy({ siteName: site.name, brandVoice: site.content?.brandVoice, tone, items })
  } catch {
    return { error: 'failed' }
  }
}

// Suggest a cohesive brand palette via Claude (uses the saved brand voice for tone).
export async function suggestPaletteAction(siteId: string): Promise<{ colors: string[] } | { error: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'auth' }
  const site = await getSite(siteId)
  if (!site) return { error: 'notfound' }
  try {
    return await aiPalette({ siteName: site.name, brandVoice: site.content?.brandVoice })
  } catch {
    return { error: 'failed' }
  }
}

// Save the site-wide brand voice (a short description of how the brand sounds). Loads
// the full content and writes it back with the spread intact, so nothing else — pages,
// saved designs, settings — is dropped. Used by the editor's Brand-voice field.
export async function setBrandVoiceAction(siteId: string, voice: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false }
  const site = await getSite(siteId)
  if (!site) return { ok: false }
  const existing: SiteContent = site.content ?? { theme: 'sand', headline: '', subheadline: '', sections: [], contactEmail: '' }
  const brandVoice = String(voice ?? '').trim().slice(0, 600) || undefined
  await saveSiteContent(siteId, { ...existing, brandVoice })
  return { ok: true }
}

// Save the editable copy for the public booking page (/book/[slug]). Loads the full
// content and writes it back with the spread intact (FOOTGUN: a bare write would drop
// pages/savedDesigns/etc.), so only `booking` changes. Each field is trimmed and capped;
// an empty field is dropped so the public page falls back to its default.
export async function setBookingCopyAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const site = await getSite(id) // RLS-scoped — only the owner's site comes back
  if (!site) return

  const short = (key: string) => String(formData.get(key) ?? '').trim().slice(0, 80) || undefined
  const long = (key: string) => String(formData.get(key) ?? '').trim().slice(0, 300) || undefined
  const next: BookingCopy = {
    heading: short('heading'),
    intro: long('intro'),
    successTitle: short('successTitle'),
    successBody: long('successBody'),
    closedTitle: short('closedTitle'),
    closedBody: long('closedBody'),
  }
  // Drop the whole object when every field is empty (keeps content tidy + defaults clean).
  const booking = Object.values(next).some(Boolean) ? next : undefined

  const existing: SiteContent = site.content ?? { theme: 'sand', headline: '', subheadline: '', sections: [], contactEmail: '' }
  await saveSiteContent(id, { ...existing, booking })
  revalidatePath(`/sites/${id}`)
}

// Save the site-wide page-transition style (a gentle enter animation on every page).
// Spread-preserves all other content, like setBrandVoiceAction.
export async function setPageTransitionAction(siteId: string, kind: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false }
  const site = await getSite(siteId)
  if (!site) return { ok: false }
  const existing: SiteContent = site.content ?? { theme: 'sand', headline: '', subheadline: '', sections: [], contactEmail: '' }
  const pageTransition = (PAGE_TRANSITION_KINDS.includes(kind as PageTransitionKind) && kind !== 'none' ? kind : undefined) as PageTransitionKind | undefined
  await saveSiteContent(siteId, { ...existing, pageTransition })
  return { ok: true }
}

// The in-editor assistant: rewrite the current page from an instruction. Returns
// the revised page so the editor can apply it to the live preview (no save yet).
export async function aiPageAction(args: {
  siteId: string
  instruction: string
  headline: string
  subheadline: string
  sections: { heading: string; body: string }[]
}): Promise<GeneratedPage | null> {
  const user = await getCurrentUser()
  if (!user) return null
  const site = await getSite(args.siteId)
  if (!site || !args.instruction.trim()) return null
  try {
    return await aiRewritePage({
      siteName: site.name,
      instruction: args.instruction.trim(),
      headline: args.headline,
      subheadline: args.subheadline,
      sections: args.sections,
      brandVoice: site.content?.brandVoice,
    })
  } catch {
    return null
  }
}

export async function saveSiteContentAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const id = String(formData.get('id') ?? '')
  if (!id) return

  let sections: { heading: string; body: string }[] = []
  try {
    const raw = JSON.parse(String(formData.get('sections') ?? '[]'))
    if (Array.isArray(raw)) {
      sections = raw
        .map((s: { heading?: string; body?: string; image?: string }) => ({
          heading: String(s?.heading ?? '').trim(),
          body: String(s?.body ?? '').trim(),
          image: String(s?.image ?? '').trim() || undefined,
        }))
        .filter(s => s.heading || s.body || s.image)
        .slice(0, 12)
    }
  } catch {
    // ignore a malformed sections payload
  }

  const themeRaw = String(formData.get('theme') ?? 'sand')
  const theme = (['sand', 'midnight', 'sage', 'rose'].includes(themeRaw) ? themeRaw : 'sand') as
    | 'sand'
    | 'midnight'
    | 'sage'
    | 'rose'

  // Preserve fields the form editor doesn't expose, and update the home page.
  const existing = (await getSite(id))?.content ?? null
  const homeFields = {
    headline: String(formData.get('headline') ?? '').trim(),
    subheadline: String(formData.get('subheadline') ?? '').trim(),
    heroImage: String(formData.get('heroImage') ?? '').trim() || undefined,
    sections,
  }
  const updatedPages: SitePage[] = getPages(existing).map(p => (p.slug === '' ? { ...p, ...homeFields } : p))

  await saveSiteContent(id, {
    theme,
    accentColor: existing?.accentColor,
    layout: existing?.layout,
    fontSystem: existing?.fontSystem,
    brand: existing?.brand,
    brandVoice: existing?.brandVoice, // set in the visual editor; never drop on a content save
    pageTransition: existing?.pageTransition,
    seoTitle: existing?.seoTitle,
    seoDescription: existing?.seoDescription,
    ...homeFields,
    ctaLabel: existing?.ctaLabel,
    ctaType: existing?.ctaType,
    ctaHref: existing?.ctaHref,
    contactLabel: existing?.contactLabel,
    contactEmail: String(formData.get('contactEmail') ?? '').trim(),
    bookingHost: existing?.bookingHost, // edited elsewhere; preserve across content saves
    booking: existing?.booking, // edited via setBookingCopyAction; never drop on a content save
    footer: existing?.footer,
    pages: updatedPages,
    savedDesigns: existing?.savedDesigns, // never drop saved designs on a content save
  })

  revalidatePath(`/sites/${id}`)
  revalidatePath(`/sites/${id}/edit`)
}

// Keep only safe link schemes (http/https/mailto/tel or a same-origin path) — a
// defence-in-depth gate so a crafted payload can never store a javascript: href.
function safeStoredHref(v: string): string | undefined {
  const t = (v || '').trim()
  return t && /^(https?:|mailto:|tel:|\/(?!\/))/i.test(t) ? t : undefined
}

// Save the whole content blob as JSON (used by the visual editor).
export async function saveSiteContentJsonAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  if (!id) return

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(String(formData.get('content') ?? '{}'))
  } catch {
    return
  }

  const themeRaw = String(parsed.theme ?? 'sand')
  const theme = (['sand', 'midnight', 'sage', 'rose'].includes(themeRaw) ? themeRaw : 'sand') as SiteTheme

  const rawSections = Array.isArray(parsed.sections) ? (parsed.sections as Record<string, unknown>[]) : []
  const sections = rawSections
    .map(s => {
      const ctRaw = String(s?.ctaType ?? '')
      const ct = (['booking', 'email', 'link'].includes(ctRaw) ? ctRaw : undefined) as CtaType | undefined
      const alignRaw = String(s?.align ?? '')
      const kindRaw = String(s?.kind ?? '')
      const kind = (['cards', 'faq', 'gallery', 'embed', 'layout'].includes(kindRaw) ? kindRaw : undefined) as SectionKind | undefined
      const colsRaw = Number(s?.columns)
      const columns = colsRaw >= 1 && colsRaw <= 3 ? (Math.round(colsRaw) as 1 | 2 | 3) : undefined
      const ov = Number(s?.overlay)
      const bw = Number(s?.borderWidth)
      const imgLayoutRaw = String(s?.imageLayout ?? '')
      const imageLayout = (['imageLeft', 'imageRight'].includes(imgLayoutRaw) ? imgLayoutRaw : undefined) as
        | SectionImageLayout
        | undefined
      const rawItems = Array.isArray(s?.items) ? (s.items as Record<string, unknown>[]) : []
      const items: SectionItem[] = rawItems
        .map(it => {
          const itCtRaw = String(it?.ctaType ?? '')
          const colN = Number(it?.col)
          const bc = String(it?.boxColor ?? '').trim()
          return {
            title: String(it?.title ?? '').trim() || undefined,
            body: String(it?.body ?? '').trim() || undefined,
            image: String(it?.image ?? '').trim() || undefined,
            block: (['text', 'heading', 'subheading', 'image', 'button', 'banner', 'divider', 'spacer'].includes(String(it?.block)) ? String(it?.block) : undefined) as BlockType | undefined,
            col: colN >= 0 && colN <= 2 ? (Math.min(Math.round(colN), (columns ?? 1) - 1) as 0 | 1 | 2) : undefined,
            href: safeStoredHref(String(it?.href ?? '')),
            ctaType: (['booking', 'email', 'link'].includes(itCtRaw) ? itCtRaw : undefined) as CtaType | undefined,
            boxColor: /^#[0-9a-f]{6}$/i.test(bc) ? bc : undefined,
            outline: it?.outline ? true : undefined,
          }
        })
        .filter(it => it.block || it.title || it.body || it.image)
        .slice(0, 16)
      return {
        heading: String(s?.heading ?? '').trim(),
        body: String(s?.body ?? '').trim(),
        image: String(s?.image ?? '').trim() || undefined,
        // A full-bleed background photo only renders on prose sections; drop it on
        // other kinds so it doesn't linger as invisible orphan data after a retype.
        bgImage: !kind ? String(s?.bgImage ?? '').trim() || undefined : undefined,
        bgColor: String(s?.bgColor ?? '').trim() || undefined,
        borderColor: /^#[0-9a-f]{6}$/i.test(String(s?.borderColor ?? '').trim()) ? String(s?.borderColor).trim() : undefined,
        borderWidth: bw > 0 ? Math.min(8, Math.round(bw)) : undefined,
        textColor: /^#[0-9a-f]{6}$/i.test(String(s?.textColor ?? '').trim()) ? String(s?.textColor).trim() : undefined,
        textScale: (['sm', 'lg'].includes(String(s?.textScale)) ? String(s?.textScale) : undefined) as 'sm' | 'lg' | undefined,
        align: (['left', 'center', 'right'].includes(alignRaw) ? alignRaw : undefined) as SiteAlign | undefined,
        kind,
        columns,
        reveal: s?.reveal ? true : undefined,
        imageLayout,
        items: items.length ? items : undefined,
        imageSize: (['sm', 'md', 'full'].includes(String(s?.imageSize)) ? String(s?.imageSize) : undefined) as ImageSize | undefined,
        imageFit: (['cover', 'contain'].includes(String(s?.imageFit)) ? String(s?.imageFit) : undefined) as ImageFit | undefined,
        overlay: Number.isFinite(ov) ? Math.min(80, Math.max(0, Math.round(ov))) : undefined,
        embedUrl: String(s?.embedUrl ?? '').trim() || undefined,
        ctaType: ct,
        ctaLabel: ct ? String(s?.ctaLabel ?? '').trim() || 'Learn more' : undefined,
        ctaHref: ct === 'link' ? safeStoredHref(String(s?.ctaHref ?? '')) : undefined,
      }
    })
    .filter(s => s.heading || s.body || s.image || s.bgImage || s.embedUrl || s.kind === 'layout' || (s.items && s.items.length))
    .slice(0, 20)

  const layout: SiteLayout = parsed.layout === 'full' ? 'full' : 'contained'

  const rawNavLinks = Array.isArray(parsed.navLinks) ? (parsed.navLinks as Record<string, unknown>[]) : []
  const navLinks = rawNavLinks
    .map(l => ({ label: String(l?.label ?? '').trim(), href: String(l?.href ?? '').trim(), newTab: Boolean(l?.newTab) }))
    .filter(l => l.label && l.href)
    .slice(0, 10)

  const validSocial: SocialKind[] = ['instagram', 'facebook', 'tiktok', 'youtube', 'whatsapp', 'email', 'website']
  const rawSocials = Array.isArray(parsed.socials) ? (parsed.socials as Record<string, unknown>[]) : []
  const socials: Social[] = rawSocials
    .map(sc => ({ kind: String(sc?.kind ?? '') as SocialKind, url: String(sc?.url ?? '').trim() }))
    .filter(sc => validSocial.includes(sc.kind) && sc.url)
    .slice(0, 8)
  const hoRaw = Number(parsed.heroOverlay)
  const heroOverlay = Number.isFinite(hoRaw) ? Math.min(80, Math.max(0, Math.round(hoRaw))) : undefined

  const ctaTypeRaw = String(parsed.ctaType ?? '')
  const ctaType = (['booking', 'email', 'link'].includes(ctaTypeRaw) ? ctaTypeRaw : undefined) as CtaType | undefined

  const pageSlug = String(formData.get('pageSlug') ?? '')
  const existing = (await getSite(id))?.content ?? null
  const pageFields = {
    headline: String(parsed.headline ?? '').trim(),
    subheadline: String(parsed.subheadline ?? '').trim(),
    heroImage: String(parsed.heroImage ?? '').trim() || undefined,
    sections,
    ctaType,
    ctaLabel: ctaType ? String(parsed.ctaLabel ?? '').trim() || 'Book a session' : undefined,
    ctaHref: ctaType === 'link' ? safeStoredHref(String(parsed.ctaHref ?? '')) : undefined,
  }
  const updatedPages: SitePage[] = getPages(existing).map(p => (p.slug === pageSlug ? { ...p, ...pageFields } : p))
  const home = updatedPages.find(p => p.slug === '') ?? updatedPages[0]

  // Header/footer are small hand-composed bars of blocks (logo/text/link/line).
  const mapBarItems = (raw: unknown): SectionItem[] =>
    (Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [])
      .map(it => {
        const itCtRaw = String(it?.ctaType ?? '')
        const bc = String(it?.boxColor ?? '').trim()
        const zone = Number(it?.col)
        const ih = Number(it?.imgH)
        const rawHref = String(it?.href ?? '').trim()
        // A bare social URL gets a scheme so it stays a link: email → mailto:, the rest → https://.
        const schemeless = String(it?.block) === 'social' && rawHref && !/^[a-z][a-z0-9+.-]*:/i.test(rawHref) && !rawHref.startsWith('/')
        const normHref = schemeless ? (String(it?.title) === 'email' ? 'mailto:' + rawHref : 'https://' + rawHref) : rawHref
        return {
          title: String(it?.title ?? '').trim() || undefined,
          body: String(it?.body ?? '').trim() || undefined,
          image: String(it?.image ?? '').trim() || undefined,
          block: (['text', 'heading', 'subheading', 'image', 'button', 'divider', 'social'].includes(String(it?.block)) ? String(it?.block) : undefined) as BlockType | undefined,
          col: zone === 1 || zone === 2 ? (zone as 1 | 2) : undefined,
          imgH: ih >= 16 && ih <= 200 ? Math.round(ih) : undefined,
          href: safeStoredHref(normHref),
          ctaType: (['booking', 'email', 'link'].includes(itCtRaw) ? itCtRaw : undefined) as CtaType | undefined,
          boxColor: /^#[0-9a-f]{6}$/i.test(bc) ? bc : undefined,
          outline: it?.outline ? true : undefined,
        }
      })
      .filter(it => it.block === 'divider' || it.title || it.body || it.image)
      .slice(0, 12)
  const headerItems = mapBarItems(parsed.headerItems)
  const footerItems = mapBarItems(parsed.footerItems)

  const content: SiteContent = {
    theme,
    accentColor: String(parsed.accentColor ?? '').trim() || undefined,
    pageBg: /^#[0-9a-f]{6}$/i.test(String(parsed.pageBg ?? '').trim()) ? String(parsed.pageBg).trim() : undefined,
    layout,
    fontSystem: String(parsed.fontSystem ?? '').trim() || undefined,
    brand: String(parsed.brand ?? '').trim() || undefined,
    brandVoice: existing?.brandVoice, // edited via setBrandVoiceAction; preserve across visual-editor saves
    pageTransition: existing?.pageTransition, // edited via setPageTransitionAction; preserve across saves
    logoImage: String(parsed.logoImage ?? '').trim() || undefined,
    headerLogoPos: ([0, 1, 2].includes(Number(parsed.headerLogoPos)) ? Number(parsed.headerLogoPos) : undefined) as 0 | 1 | 2 | undefined,
    faviconImage: String(parsed.faviconImage ?? '').trim() || undefined,
    menuPosition: (['top', 'scroll', 'side'].includes(String(parsed.menuPosition)) ? String(parsed.menuPosition) : undefined) as MenuPosition | undefined,
    navLinks: navLinks.length ? navLinks : undefined,
    headerItems: headerItems.length ? headerItems : undefined,
    footerItems: footerItems.length ? footerItems : undefined,
    seoTitle: String(parsed.seoTitle ?? '').trim() || undefined,
    seoDescription: String(parsed.seoDescription ?? '').trim() || undefined,
    headline: home.headline,
    subheadline: home.subheadline,
    heroImage: home.heroImage,
    sections: home.sections,
    ctaLabel: home.ctaLabel,
    ctaType: home.ctaType,
    ctaHref: home.ctaHref,
    contactLabel: String(parsed.contactLabel ?? '').trim() || undefined,
    contactEmail: String(parsed.contactEmail ?? '').trim(),
    bookingHost: existing?.bookingHost, // edited elsewhere; preserve across visual-editor saves
    booking: existing?.booking, // edited via setBookingCopyAction; preserve across visual-editor saves
    footer: String(parsed.footer ?? '').trim() || undefined,
    socials: socials.length ? socials : undefined,
    heroOverlay,
    pages: updatedPages,
    savedDesigns: existing?.savedDesigns, // managed elsewhere; never drop on a content save
  }

  await saveSiteContent(id, content)
  revalidatePath(`/sites/${id}/design`)
  revalidatePath(`/sites/${id}/edit`)
  revalidatePath(`/sites/${id}`)
}

// Add a new page to a site.
export async function addPageAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  if (!id) return

  const title = String(formData.get('title') ?? '').trim() || 'New page'
  const base = slugify(title) || 'page'
  const existing = (await getSite(id))?.content ?? null
  const pages = getPages(existing)
  let slug = base
  let n = 1
  while (pages.some(p => p.slug === slug)) {
    n += 1
    slug = `${base}-${n}`
  }

  // Inherit the build mode you're in: if you add a page while working on the free
  // canvas, the new page starts as a (blank) canvas too, instead of bouncing you
  // back to the block editor.
  const wantCanvas = String(formData.get('canvas') ?? '') === '1'
  const newPage: SitePage = { id: 'p' + Date.now(), title, slug, headline: title, subheadline: '', sections: [], ...(wantCanvas ? { canvas: { h: 1000, elements: [], bg: '#ffffff' } } : {}) }
  const baseContent: SiteContent = existing ?? { theme: 'sand', headline: '', subheadline: '', sections: [], contactEmail: '' }
  await saveSiteContent(id, { ...baseContent, pages: [...pages, newPage] })
  revalidatePath(`/sites/${id}/design`)
  redirect(`/sites/${id}/design?page=${slug}`)
}

// Remove a page (cannot remove the home page).
export async function removePageAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  if (!id || !slug) return

  const existing = (await getSite(id))?.content ?? null
  const pages = getPages(existing).filter(p => p.slug !== slug)
  const baseContent: SiteContent = existing ?? { theme: 'sand', headline: '', subheadline: '', sections: [], contactEmail: '' }
  await saveSiteContent(id, { ...baseContent, pages })
  revalidatePath(`/sites/${id}/design`)
  redirect(`/sites/${id}/design`)
}

// Duplicate a page (with its blocks AND free-canvas layout) right after it.
export async function duplicatePageAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  if (!id) return
  const existing = (await getSite(id))?.content ?? null
  const pages = getPages(existing)
  const src = pages.find(p => p.slug === slug)
  if (!src) return
  const title = `${src.title || 'Page'} copy`
  const base = slugify(title) || 'page'
  let newSlug = base
  let n = 1
  while (pages.some(p => p.slug === newSlug)) { n += 1; newSlug = `${base}-${n}` }
  // Deep clone so the copy shares nothing with the original (canvas, sections, etc.).
  const clone: SitePage = JSON.parse(JSON.stringify(src))
  clone.id = 'p' + Date.now()
  clone.slug = newSlug
  clone.title = title
  clone.navLabel = undefined
  const i = pages.findIndex(p => p.slug === slug)
  const newPages = [...pages.slice(0, i + 1), clone, ...pages.slice(i + 1)]
  const baseContent: SiteContent = existing ?? { theme: 'sand', headline: '', subheadline: '', sections: [], contactEmail: '' }
  await saveSiteContent(id, { ...baseContent, pages: newPages })
  revalidatePath(`/sites/${id}/design`)
  redirect(`/sites/${id}/design?page=${newSlug}`)
}

// Rename a page (its internal title) and/or its menu label, and toggle whether it
// shows in the header menu. The slug (URL) stays the same so links don't break.
export async function updatePageAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  if (!id) return

  const title = String(formData.get('title') ?? '').trim()
  const navLabel = String(formData.get('navLabel') ?? '').trim()
  const hidden = String(formData.get('hidden') ?? '') === '1'
  const seoTitle = String(formData.get('seoTitle') ?? '').trim().slice(0, 70)
  const seoDescription = String(formData.get('seoDescription') ?? '').trim().slice(0, 200)
  const seoImageRaw = String(formData.get('seoImage') ?? '').trim()
  const seoImage = /^https:\/\/[^\s()'"\\<>]+$/i.test(seoImageRaw) ? seoImageRaw.slice(0, 500) : undefined

  const existing = (await getSite(id))?.content ?? null
  const pages = getPages(existing).map(p =>
    p.slug === slug
      ? { ...p, title: title || p.title, navLabel: navLabel || undefined, hidden: hidden || undefined, seoTitle: seoTitle || undefined, seoDescription: seoDescription || undefined, seoImage }
      : p,
  )
  const baseContent: SiteContent = existing ?? { theme: 'sand', headline: '', subheadline: '', sections: [], contactEmail: '' }
  await saveSiteContent(id, { ...baseContent, pages })
  revalidatePath(`/sites/${id}/design`)
  revalidatePath(`/sites/${id}`)
}

// Move a page earlier/later in the menu. Home (slug '') stays pinned first.
export async function movePageAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const dir = String(formData.get('dir') ?? '') === 'up' ? -1 : 1
  if (!id || !slug) return

  const existing = (await getSite(id))?.content ?? null
  const pages = getPages(existing)
  const i = pages.findIndex(p => p.slug === slug)
  const j = i + dir
  // Never move the home page, and never displace it from index 0.
  if (i <= 0 || j <= 0 || j >= pages.length) {
    revalidatePath(`/sites/${id}/design`)
    return
  }
  const next = [...pages]
  const tmp = next[i]
  next[i] = next[j]
  next[j] = tmp
  const baseContent: SiteContent = existing ?? { theme: 'sand', headline: '', subheadline: '', sections: [], contactEmail: '' }
  await saveSiteContent(id, { ...baseContent, pages: next })
  revalidatePath(`/sites/${id}/design`)
}

// Save the owner's custom header menu links (external URLs, booking, mailto, etc.).
export async function setNavLinksAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  if (!id) return

  let links: { label: string; href: string; newTab?: boolean }[] = []
  try {
    const raw = JSON.parse(String(formData.get('navLinks') ?? '[]'))
    if (Array.isArray(raw)) {
      links = raw
        .map((l: Record<string, unknown>) => ({
          label: String(l?.label ?? '').trim(),
          href: String(l?.href ?? '').trim(),
          newTab: Boolean(l?.newTab),
        }))
        .filter(l => l.label && l.href)
        .slice(0, 10)
    }
  } catch {
    return
  }

  const existing = (await getSite(id))?.content ?? null
  const baseContent: SiteContent = existing ?? { theme: 'sand', headline: '', subheadline: '', sections: [], contactEmail: '' }
  await saveSiteContent(id, { ...baseContent, navLinks: links.length ? links : undefined })
  revalidatePath(`/sites/${id}/design`)
  revalidatePath(`/sites/${id}`)
}

export async function pauseSiteAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const id = String(formData.get('id') ?? '')
  if (!id) return

  const site = await getSite(id)
  if (!site) return

  await updateSiteStatus(id, 'stopped', site.url)

  revalidatePath(`/sites/${id}`)
  revalidatePath('/sites')
}

export async function deleteSiteAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const id = String(formData.get('id') ?? '')
  if (!id) return

  const site = await getSite(id)
  if (site) {
    try {
      await getEngine().destroy(site.slug)
    } catch {
      // best-effort teardown; still remove the record
    }
  }
  await deleteSiteRecord(id)

  revalidatePath('/sites')
  redirect('/sites')
}

// --- Free canvas (Canva-style) pages ---------------------------------------

// Whitelist + clamp a free-canvas payload (THE GATE for canvas pages).
function sanitizeCanvas(raw: unknown): PageCanvas {
  const c = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const num = (v: unknown, min: number, max: number, dflt: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : dflt
  }
  const hex = (v: unknown) => (/^#[0-9a-f]{6}$/i.test(String(v ?? '').trim()) ? String(v).trim() : undefined)
  // A colour is either a hex or a strict brand-palette token; the anchored regex
  // (only var(--brand-0..5)) means a stored value can never inject CSS.
  const color = (v: unknown) => { const s = String(v ?? '').trim(); return /^var\(--brand-[0-5]\)$/.test(s) ? s : hex(v) }
  // A two-stop gradient is only kept if both stops are valid hex (so the stored
  // value can never inject arbitrary CSS); the angle is clamped to 0-360.
  const grad = (v: unknown): Gradient | undefined => {
    const g = v && typeof v === 'object' ? (v as Record<string, unknown>) : null
    const from = hex(g?.from)
    const to = hex(g?.to)
    if (!from || !to) return undefined
    const kind = (['linear', 'radial', 'conic'].includes(String(g?.kind)) ? String(g?.kind) : undefined) as Gradient['kind']
    // Optional multi-stop list: up to 6 stops, each a valid hex colour + clamped position.
    // Only kept when at least 3 stops survive validation — exactly two stops always
    // collapse to the from/to model, matching the editor's writeStops, so `stops`
    // present ⟺ a true 3+-stop gradient (no ambiguous 2-entry list can persist).
    let stops: { color: string; at: number }[] | undefined
    if (Array.isArray(g?.stops)) {
      const parsed = (g!.stops as unknown[])
        .map(s => {
          const o = s && typeof s === 'object' ? (s as Record<string, unknown>) : {}
          const c = hex(o.color)
          return c ? { color: c, at: num(o.at, 0, 100, 50) } : null
        })
        .filter((s): s is { color: string; at: number } => s !== null)
        .slice(0, 6)
      if (parsed.length >= 3) stops = parsed
    }
    return { from, to, angle: num(g?.angle, 0, 360, 90), kind: kind && kind !== 'linear' ? kind : undefined, stops }
  }
  const blend = (v: unknown) => {
    const s = String(v ?? '')
    return BLEND_MODES.includes(s as BlendMode) && s !== 'normal' ? (s as BlendMode) : undefined
  }
  const shadow = (v: unknown) => { const s = String(v ?? ''); return SHADOW_KINDS.includes(s as ShadowKind) ? (s as ShadowKind) : undefined }
  const cursor = (v: unknown) => { const s = String(v ?? ''); return CURSOR_KINDS.includes(s as CursorKind) ? (s as CursorKind) : undefined }
  const reveal = (v: unknown) => { const s = String(v ?? ''); return REVEAL_KINDS.includes(s as RevealKind) ? (s as RevealKind) : undefined }
  const hover = (v: unknown) => { const s = String(v ?? ''); return HOVER_KINDS.includes(s as HoverKind) ? (s as HoverKind) : undefined }
  // Photo adjustments: every field is a clamped number, so nothing can inject CSS.
  const adjust = (v: unknown): ImageAdjust | undefined => {
    const a = v && typeof v === 'object' ? (v as Record<string, unknown>) : null
    if (!a) return undefined
    const clamp = (val: unknown, min: number, max: number) => { const x = Number(val); return Number.isFinite(x) ? Math.min(max, Math.max(min, Math.round(x))) : undefined }
    const r: ImageAdjust = {}
    const b = clamp(a.brightness, 0, 200); if (b !== undefined && b !== 100) r.brightness = b
    const c = clamp(a.contrast, 0, 200); if (c !== undefined && c !== 100) r.contrast = c
    const s = clamp(a.saturate, 0, 300); if (s !== undefined && s !== 100) r.saturate = s
    const bl = clamp(a.blur, 0, 20); if (bl) r.blur = bl
    const g = clamp(a.grayscale, 0, 100); if (g) r.grayscale = g
    const se = clamp(a.sepia, 0, 100); if (se) r.sepia = se
    return Object.keys(r).length ? r : undefined
  }
  // A unitless line-height multiplier kept to two decimals.
  const lineH = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0.8 && n <= 4 ? Math.round(n * 100) / 100 : undefined
  }
  const dataOrHttp = (v: unknown) => {
    const s = String(v ?? '').trim()
    // Strict allowlist so a stored value can never break out of a CSS url(...) or an
    // attribute: a base64 image data URL, or an http(s) URL with no quote/paren/semicolon/space.
    // SVG is allowed only base64-encoded and is always rendered via <img>/CSS, where
    // scripts never execute — and base64 contains no quote/paren so it can't break out.
    if (/^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);base64,[a-z0-9+/=]+$/i.test(s)) return s
    if (/^https?:\/\/[^\s()'"\\;]+$/i.test(s)) {
      try {
        const u = new URL(s)
        if (u.protocol === 'http:' || u.protocol === 'https:') return s
      } catch {
        // not a valid URL
      }
    }
    return undefined
  }
  // Component elements (allowComponent=false) can never themselves be a component
  // instance, so a component can never nest another — render recursion is bounded.
  const sanitizeElement = (e: Record<string, unknown>, i: number, allowComponent: boolean): CanvasElement => {
    const types = ['text', 'image', 'button', 'box', 'menu', 'carousel', 'shape', 'icon', 'form', 'embed', 'draw', 'group']
    if (allowComponent) types.push('component')
    const type = (types.includes(String(e?.type)) ? String(e?.type) : 'box') as CanvasElementType
    const al = String(e?.align)
    const align = (['left', 'center', 'right'].includes(al) ? al : undefined) as SiteAlign | undefined
    const ff = String(e?.fontFamily ?? '').trim()
    const fontFamily = ['display', 'body', 'label'].includes(ff) || /^custom:[a-z0-9]{1,12}$/i.test(ff) ? ff : undefined
    const ct = String(e?.ctaType)
    const ctaType = (['booking', 'email', 'link'].includes(ct) ? ct : undefined) as CtaType | undefined
    return {
      id: String(e?.id ?? 'e' + i).slice(0, 24) || 'e' + i,
      type,
      x: num(e?.x, -2000, 8000, 0),
      y: num(e?.y, 0, 40000, 0),
      w: num(e?.w, 1, 4000, 100), // floor 1 so hairline dividers (a 2px line) survive the gate
      h: num(e?.h, 1, 8000, 60),
      z: num(e?.z, -9999, 9999, i),
      rotate: num(e?.rotate, -180, 180, 0) || undefined,
      opacity: num(e?.opacity, 0, 100, 100),
      locked: e?.locked ? true : undefined,
      hidden: e?.hidden ? true : undefined,
      pin: e?.pin === 'footer' ? 'footer' : undefined,
      groupId: /^[a-z0-9]{1,12}$/i.test(String(e?.groupId ?? '')) ? String(e?.groupId) : undefined,
      mx: e?.mx === undefined || e?.mx === null ? undefined : num(e?.mx, -2000, 8000, 0),
      my: e?.my === undefined || e?.my === null ? undefined : num(e?.my, 0, 40000, 0),
      mw: e?.mw === undefined || e?.mw === null ? undefined : num(e?.mw, 8, 4000, 100),
      mh: e?.mh === undefined || e?.mh === null ? undefined : num(e?.mh, 8, 8000, 60),
      mHidden: e?.mHidden ? true : undefined,
      mFontSize: (type === 'text' || type === 'button') && e?.mFontSize ? num(e?.mFontSize, 6, 400, 24) : undefined,
      text: type === 'text' || type === 'button' || type === 'form' ? String(e?.text ?? '').slice(0, 2000) || undefined : undefined,
      fontSize: type === 'text' || type === 'button' ? num(e?.fontSize, 6, 400, 24) : undefined,
      color: color(e?.color),
      align,
      bold: e?.bold ? true : undefined,
      weight: (type === 'text' || type === 'button') && e?.weight ? num(e?.weight, 100, 900, 400) : undefined,
      italic: e?.italic ? true : undefined,
      fontFamily,
      letterSpacing: e?.letterSpacing === undefined || e?.letterSpacing === null ? undefined : num(e?.letterSpacing, -20, 200, 0),
      lineHeight: lineH(e?.lineHeight),
      dropCap: type === 'text' && e?.dropCap ? true : undefined,
      styleRef: allowComponent && type === 'text' && TEXT_STYLE_KEYS.includes(String(e?.styleRef) as (typeof TEXT_STYLE_KEYS)[number]) ? String(e?.styleRef) : undefined,
      href: ctaType === 'link' ? safeStoredHref(String(e?.href ?? '')) : undefined,
      ctaType,
      newTab: e?.newTab ? true : undefined,
      anchorTo: /^[a-z0-9]{1,24}$/i.test(String(e?.anchorTo ?? '')) ? String(e?.anchorTo).trim() : undefined,
      src: type === 'image' ? dataOrHttp(e?.src) : undefined,
      alt: type === 'image' ? (String(e?.alt ?? '').trim().slice(0, 250) || undefined) : undefined,
      fit: (['cover', 'contain'].includes(String(e?.fit)) ? String(e?.fit) : undefined) as ImageFit | undefined,
      adjust: type === 'image' ? adjust(e?.adjust) : undefined,
      lightbox: type === 'image' && e?.lightbox ? true : undefined,
      slides: type === 'carousel' && Array.isArray(e?.slides) ? (e.slides.map(dataOrHttp).filter(Boolean) as string[]).slice(0, 10) : undefined,
      interval: type === 'carousel' ? num(e?.interval, 0, 30, 4) : undefined,
      shape: type === 'shape' && SHAPE_KINDS.includes(String(e?.shape) as ShapeKind) ? (String(e?.shape) as ShapeKind) : type === 'shape' ? 'wave' : undefined,
      icon: type === 'icon' ? (ICON_KINDS.includes(String(e?.icon)) ? String(e?.icon) : 'star') : undefined,
      // Freehand drawing: only allow SVG path-data characters (no quotes/parens → no injection), capped.
      paths: type === 'draw' && Array.isArray(e?.paths) ? (e.paths as unknown[]).map(p => String(p ?? '')).filter(p => p.length <= 20000 && /^[\d\s.,\-MLCQTAHVZmlcqtahvz]+$/.test(p)).slice(0, 400) : undefined,
      strokeW: type === 'draw' ? num(e?.strokeW, 1, 200, 6) : undefined,
      // Flow Groups (layout engine). parentId is a raw element id (validated against surviving
      // groups in a post-pass below); flow/sizeW/sizeH only meaningful on a 'group'.
      parentId: e?.parentId ? String(e.parentId).slice(0, 40) : undefined,
      flow: type === 'group' && e?.flow && typeof e.flow === 'object' ? (() => {
        const f = e.flow as Record<string, unknown>
        return {
          dir: f.dir === 'col' ? 'col' as const : 'row' as const,
          gap: num(f.gap, 0, 400, 16),
          padX: num(f.padX, 0, 400, 0),
          padY: num(f.padY, 0, 400, 0),
          align: (['start', 'center', 'end', 'stretch'].includes(String(f.align)) ? String(f.align) : 'start') as 'start' | 'center' | 'end' | 'stretch',
          justify: (['start', 'center', 'end', 'between'].includes(String(f.justify)) ? String(f.justify) : 'start') as 'start' | 'center' | 'end' | 'between',
          wrap: f.wrap ? true : undefined,
          collapsible: f.collapsible ? true : undefined,
        }
      })() : undefined,
      sizeW: type === 'group' && ['hug', 'fill'].includes(String(e?.sizeW)) ? (String(e?.sizeW) as 'hug' | 'fill') : undefined,
      sizeH: type === 'group' && ['hug', 'fill'].includes(String(e?.sizeH)) ? (String(e?.sizeH) as 'hug' | 'fill') : undefined,
      menuStyle: type === 'menu' && MENU_STYLES.includes(String(e?.menuStyle) as MenuStyle) ? (String(e?.menuStyle) as MenuStyle) : undefined,
      embedUrl: type === 'embed' ? httpUrl(e?.embedUrl) : undefined,
      fields: type === 'form' && Array.isArray(e?.fields)
        ? ((e.fields as Record<string, unknown>[]).slice(0, 12).map((f, fi): FormField => {
            const ftype = FORM_FIELD_TYPES.includes(String(f?.type) as FormFieldType) ? (String(f?.type) as FormFieldType) : 'text'
            // Dropdown choices: trimmed, de-blanked, capped (only kept for select fields).
            const opts = ftype === 'select' && Array.isArray(f?.options)
              ? (f.options as unknown[]).map(o => String(o ?? '').trim().slice(0, 60)).filter(Boolean).slice(0, 12)
              : undefined
            // Conditional visibility: keep only if it names a valid field id + a value.
            const si = f?.showIf && typeof f.showIf === 'object' ? (f.showIf as Record<string, unknown>) : null
            const siField = si && /^[a-z0-9_]{1,16}$/i.test(String(si.field ?? '')) ? String(si.field) : ''
            const siEquals = si ? String(si.equals ?? '').trim().slice(0, 60) : ''
            return {
              id: /^[a-z0-9_]{1,16}$/i.test(String(f?.id ?? '')) ? String(f?.id) : 'f' + fi,
              label: String(f?.label ?? 'Field').slice(0, 60) || 'Field',
              type: ftype,
              required: f?.required ? true : undefined,
              options: opts && opts.length ? opts : undefined,
              showIf: siField && siEquals ? { field: siField, equals: siEquals } : undefined,
              newStep: fi > 0 && f?.newStep ? true : undefined,
            }
          }))
        : undefined,
      fill: color(e?.fill),
      gradient: type === 'box' || type === 'button' || type === 'text' ? grad(e?.gradient) : undefined,
      radius: num(e?.radius, 0, 400, 0) || undefined,
      borderColor: color(e?.borderColor),
      borderWidth: num(e?.borderWidth, 0, 40, 0) || undefined,
      shadow: type === 'box' || type === 'button' || type === 'image' ? shadow(e?.shadow) : undefined,
      blend: blend(e?.blend),
      cursor: cursor(e?.cursor),
      reveal: reveal(e?.reveal),
      revealDelay: e?.reveal && e?.revealDelay ? num(e?.revealDelay, 0, 2000, 0) || undefined : undefined,
      hover: hover(e?.hover),
      parallax: num(e?.parallax, -5, 5, 0) || undefined,
      componentId: type === 'component' && /^[a-z0-9]{1,20}$/i.test(String(e?.componentId ?? '')) ? String(e?.componentId).trim() : undefined,
    }
  }
  // Global text styles: keep only known keys, sanitise each property like a text element.
  const textStylesOf = (v: unknown): Record<string, TextStyleProps> | undefined => {
    if (!v || typeof v !== 'object') return undefined
    const src = v as Record<string, unknown>
    const out: Record<string, TextStyleProps> = {}
    for (const key of TEXT_STYLE_KEYS) {
      const s = src[key] as Record<string, unknown> | undefined
      if (!s || typeof s !== 'object') continue
      const ff = String(s.fontFamily ?? '').trim()
      out[key] = {
        fontSize: num(s.fontSize, 6, 400, 24),
        fontFamily: ['display', 'body', 'label'].includes(ff) || /^custom:[a-z0-9]{1,12}$/i.test(ff) ? ff : undefined,
        weight: s.weight ? num(s.weight, 100, 900, 400) : undefined,
        italic: s.italic ? true : undefined,
        lineHeight: lineH(s.lineHeight),
        letterSpacing: s.letterSpacing === undefined || s.letterSpacing === null ? undefined : num(s.letterSpacing, -20, 200, 0),
        color: color(s.color),
      }
    }
    return Object.keys(out).length ? out : undefined
  }
  const rawEls = Array.isArray(c.elements) ? (c.elements as Record<string, unknown>[]) : []
  const elements: CanvasElement[] = rawEls.slice(0, 80).map((e, i) => sanitizeElement(e, i, true))
  // Flow Groups integrity (runs AFTER the 80-cap slice): a child's parentId must point to a
  // surviving 'group', and a group can't itself be parented (no nested groups). Otherwise drop
  // parentId so the element falls back to absolute positioning — orphans are always safe.
  const groupIds = new Set(elements.filter(el => el.type === 'group').map(el => el.id))
  for (const el of elements) {
    if (el.parentId && (el.type === 'group' || !groupIds.has(el.parentId))) el.parentId = undefined
  }
  const components: SiteComponent[] | undefined = Array.isArray(c.components)
    ? ((c.components as Record<string, unknown>[])
        .map(comp => {
          const id = String(comp?.id ?? '').trim()
          if (!/^[a-z0-9]{1,20}$/i.test(id)) return null
          const cels = Array.isArray(comp?.elements) ? (comp.elements as Record<string, unknown>[]).slice(0, 60).map((e, i) => sanitizeElement(e, i, false)) : []
          return { id, name: String(comp?.name ?? 'Component').slice(0, 40), w: num(comp?.w, 8, 4000, 200), h: num(comp?.h, 8, 8000, 200), elements: cels } as SiteComponent
        })
        .filter(Boolean) as SiteComponent[])
        .slice(0, 30)
    : undefined
  return {
    h: num(c.h, 200, 40000, 1000),
    width: c.width === 'contained' ? 'contained' : undefined,
    bg: color(c.bg),
    bgGradient: grad(c.bgGradient),
    bgImage: dataOrHttp(c.bgImage),
    bgOpacity: (() => { const n = num(c.bgOpacity, 0, 100, 100); return n >= 100 ? undefined : n })(),
    elements,
    mobileCustom: c.mobileCustom ? true : undefined,
    mobileH: c.mobileH === undefined || c.mobileH === null ? undefined : num(c.mobileH, 200, 40000, 1200),
    palette: Array.isArray(c.palette) ? (c.palette.map(hex).filter(Boolean) as string[]).slice(0, 6) : undefined,
    bgVideo: httpUrl(c.bgVideo),
    components: components && components.length ? components : undefined,
    fonts: Array.isArray(c.fonts)
      ? (c.fonts as Record<string, unknown>[])
          .map(f => {
            const id = String(f?.id ?? '').trim()
            const src = String(f?.src ?? '').trim()
            if (!/^[a-z0-9]{1,12}$/i.test(id)) return null
            // A strict base64 font data URL — no quote/paren/space so it can't break out of @font-face url('').
            if (!/^data:(font\/(woff2|woff|ttf|otf)|application\/(x-font-ttf|x-font-woff|font-woff2?|octet-stream));base64,[a-z0-9+/=]+$/i.test(src)) return null
            return { id, name: String(f?.name ?? 'Font').slice(0, 30), src }
          })
          .filter(Boolean)
          .slice(0, 4) as SiteFont[]
      : undefined,
    uploads: Array.isArray(c.uploads)
      ? ((c.uploads as unknown[]).map(dataOrHttp).filter(Boolean) as string[]).slice(0, 24)
      : undefined,
    fontSystem: FONT_SYSTEM_KEYS.includes(String(c.fontSystem ?? '')) ? String(c.fontSystem) : undefined,
    guidesX: guideList(c.guidesX, 0, 4000),
    guidesY: guideList(c.guidesY, 0, 40000),
    textStyles: textStylesOf(c.textStyles),
    banner: (() => {
      const b = c.banner as Record<string, unknown> | undefined
      const text = String(b?.text ?? '').trim().slice(0, 200)
      if (!text) return undefined
      return { text, bg: color(b?.bg), color: color(b?.color), href: safeStoredHref(String(b?.href ?? '')) || undefined }
    })(),
    popup: (() => {
      const p = c.popup as Record<string, unknown> | undefined
      const text = String(p?.text ?? '').trim().slice(0, 600)
      if (!text) return undefined
      return {
        text,
        title: String(p?.title ?? '').trim().slice(0, 120) || undefined,
        bg: color(p?.bg),
        color: color(p?.color),
        ctaLabel: String(p?.ctaLabel ?? '').trim().slice(0, 60) || undefined,
        ctaHref: safeStoredHref(String(p?.ctaHref ?? '')) || undefined,
        delay: num(p?.delay, 0, 60, 2),
      }
    })(),
  }
}

// Editor-only ruler guides: a short list of in-range, de-duplicated integer positions.
function guideList(v: unknown, min: number, max: number): number[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out = Array.from(
    new Set(
      (v as unknown[])
        .map(n => Math.round(Number(n)))
        .filter(n => Number.isFinite(n) && n >= min && n <= max)
    )
  ).slice(0, 24)
  return out.length ? out : undefined
}

// A plain https URL (no quotes/parens/spaces) — for a background video source.
function httpUrl(v: unknown): string | undefined {
  const s = String(v ?? '').trim()
  if (!/^https?:\/\/[^\s()'"\\;<>]+$/i.test(s)) return undefined
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:' ? s : undefined } catch { return undefined }
}

// Patch one page's fields and re-mirror the home page's content onto the top level.
async function patchCanvasPage(id: string, pageSlug: string, patch: Partial<SitePage>): Promise<void> {
  const base: SiteContent = (await getSite(id))?.content ?? { theme: 'sand', headline: '', subheadline: '', sections: [], contactEmail: '' }
  const updatedPages: SitePage[] = getPages(base).map(p => (p.slug === pageSlug ? { ...p, ...patch } : p))
  const home = updatedPages.find(p => p.slug === '') ?? updatedPages[0]
  await saveSiteContent(id, {
    ...base,
    headline: home.headline,
    subheadline: home.subheadline,
    sections: home.sections,
    pages: updatedPages,
  })
  revalidatePath(`/sites/${id}/design`)
  revalidatePath(`/sites/${id}`)
}

async function setPageCanvas(id: string, pageSlug: string, canvas: PageCanvas | undefined): Promise<void> {
  // Setting a canvas also reveals it (canvasHidden=false) so the page shows it.
  await patchCanvasPage(id, pageSlug, { canvas, canvasHidden: canvas ? false : undefined })
}

// Save the current free-canvas page.
export async function saveCanvasAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const pageSlug = String(formData.get('pageSlug') ?? '')
  let raw: unknown = {}
  try {
    raw = JSON.parse(String(formData.get('canvas') ?? '{}'))
  } catch {
    // ignore bad payload
  }
  await setPageCanvas(id, pageSlug, sanitizeCanvas(raw))
}

// Turn a page into a blank free canvas.
export async function startCanvasAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const pageSlug = String(formData.get('pageSlug') ?? '')
  const existing = (await getSite(id))?.content ?? null
  const page = getPages(existing).find(p => p.slug === pageSlug)
  // If a canvas already exists (it was only hidden when you switched to blocks),
  // just reveal it again — never re-seed over your saved canvas work.
  if (page?.canvas) {
    await patchCanvasPage(id, pageSlug, { canvasHidden: false })
    return
  }
  // Otherwise seed a new canvas from whatever the page already has (hand-written or
  // AI-written blocks), so switching to the free canvas brings your content across as
  // draggable elements instead of dropping you onto a blank page.
  const hasContent = !!(page && (page.headline || page.subheadline || (page.sections && page.sections.length)))
  const canvas = hasContent && page
    ? sanitizeCanvas(canvasFromContent({
        headline: page.headline,
        subheadline: page.subheadline,
        heroImage: page.heroImage,
        sections: page.sections,
        ctaLabel: page.ctaLabel,
        ctaType: page.ctaType,
        ctaHref: page.ctaHref,
        theme: existing?.theme,
        accent: existing?.accentColor,
      }))
    : { h: 1000, elements: [], bg: '#ffffff' }
  await setPageCanvas(id, pageSlug, canvas)
}

// Search free stock photos via a server-side Pexels proxy (the key never reaches
// the browser). Returns { error: 'nokey' } when no PEXELS_API_KEY is configured.
export async function searchStockPhotos(query: string): Promise<{ ok: boolean; error?: string; photos?: StockPhoto[] }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'auth' }
  const key = process.env.PEXELS_API_KEY
  if (!key) return { ok: false, error: 'nokey' }
  const q = String(query ?? '').trim().slice(0, 100)
  if (!q) return { ok: true, photos: [] }
  try {
    const res = await fetch(`https://api.pexels.com/v1/search?per_page=28&query=${encodeURIComponent(q)}`, {
      headers: { Authorization: key },
      cache: 'no-store',
    })
    if (!res.ok) return { ok: false, error: 'failed' }
    const data = (await res.json()) as { photos?: Array<Record<string, unknown>> }
    const photos: StockPhoto[] = (data.photos ?? []).map(p => {
      const src = (p.src ?? {}) as Record<string, string>
      return {
        id: String(p.id ?? ''),
        thumb: src.tiny || src.small || src.medium || '',
        url: src.large2x || src.large || src.original || src.medium || '',
        alt: String(p.alt ?? ''),
        credit: String(p.photographer ?? ''),
      }
    }).filter(p => p.url)
    return { ok: true, photos }
  } catch {
    return { ok: false, error: 'failed' }
  }
}

// Public: a visitor submits a contact form. No auth — the RPC resolves the owner from
// the site slug, so a visitor can only ever create a message for that site's owner.
export async function submitMessageAction(args: { slug: string; name: string; email: string; body: string; hp?: string }): Promise<{ ok: boolean }> {
  const slug = String(args?.slug ?? '').trim()
  const body = String(args?.body ?? '').trim()
  if (!slug || !body) return { ok: false }
  // Honeypot filled → almost certainly a bot. Pretend success, store nothing.
  if (String(args?.hp ?? '').trim()) return { ok: true }
  const ok = await submitMessage(slug, String(args?.name ?? '').slice(0, 120), String(args?.email ?? '').slice(0, 200), body.slice(0, 5000))
  return { ok }
}

// Owner: mark a message read/unread or delete it (RLS limits to the owner).
export async function setMessageReadAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await setMessageRead(id, String(formData.get('read') ?? '') === '1')
  revalidatePath('/messages')
}
export async function deleteMessageAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await deleteMessageRecord(id)
  revalidatePath('/messages')
}

// Switch a page back to the block editor — KEEP the canvas (just hide it) so you can
// switch back without losing your free-canvas work.
export async function clearCanvasAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await patchCanvasPage(id, String(formData.get('pageSlug') ?? ''), { canvasHidden: true })
}

// --- Saved designs: keep up to MAX_SAVED_DESIGNS whole-site snapshots and switch between them ---

// A snapshot must never carry its own savedDesigns (no nesting / runaway growth).
function stripSavedDesigns(c: SiteContent): SiteContent {
  const { savedDesigns: _omit, ...rest } = c
  void _omit
  return rest as SiteContent
}

// Save the current live design into a slot — a new one, or overwriting an existing slot.
export async function saveDesignAction(siteId: string, name: string, slotId?: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'auth' }
  const site = await getSite(siteId)
  if (!site || !site.content) return { ok: false, error: 'missing' }

  const designs: SavedDesign[] = [...(site.content.savedDesigns ?? [])]
  const cleanName = (name || '').trim().slice(0, 40) || `Design ${designs.length + 1}`
  const snapshot = stripSavedDesigns(site.content)
  const now = new Date().toISOString()

  if (slotId) {
    const i = designs.findIndex(d => d.id === slotId)
    if (i < 0) return { ok: false, error: 'slot' }
    designs[i] = { ...designs[i], name: cleanName, savedAt: now, snapshot }
  } else {
    if (designs.length >= MAX_SAVED_DESIGNS) return { ok: false, error: 'full' }
    designs.push({ id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: cleanName, savedAt: now, snapshot })
  }

  await saveSiteContent(siteId, { ...site.content, savedDesigns: designs })
  revalidatePath(`/sites/${siteId}`)
  return { ok: true }
}

// Make a saved slot the live design (keeping the slot list intact, so nothing is lost).
export async function loadDesignAction(siteId: string, slotId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'auth' }
  const site = await getSite(siteId)
  if (!site || !site.content) return { ok: false, error: 'missing' }

  const designs = site.content.savedDesigns ?? []
  const slot = designs.find(d => d.id === slotId)
  if (!slot) return { ok: false, error: 'slot' }

  const next: SiteContent = { ...stripSavedDesigns(slot.snapshot), savedDesigns: designs }
  await saveSiteContent(siteId, next)
  revalidatePath(`/sites/${siteId}`)
  revalidatePath(`/sites/${siteId}/design`)
  revalidatePath(`/sites/${siteId}/edit`)
  revalidatePath(`/s/${site.slug}`)
  return { ok: true }
}

// Rename a saved slot.
export async function renameDesignAction(siteId: string, slotId: string, name: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false }
  const site = await getSite(siteId)
  if (!site || !site.content) return { ok: false }
  const designs = (site.content.savedDesigns ?? []).map(d => (d.id === slotId ? { ...d, name: (name || '').trim().slice(0, 40) || d.name } : d))
  await saveSiteContent(siteId, { ...site.content, savedDesigns: designs })
  revalidatePath(`/sites/${siteId}`)
  return { ok: true }
}

// Delete a saved slot.
export async function deleteDesignAction(siteId: string, slotId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false }
  const site = await getSite(siteId)
  if (!site || !site.content) return { ok: false }
  const designs = (site.content.savedDesigns ?? []).filter(d => d.id !== slotId)
  await saveSiteContent(siteId, { ...site.content, savedDesigns: designs })
  revalidatePath(`/sites/${siteId}`)
  return { ok: true }
}
