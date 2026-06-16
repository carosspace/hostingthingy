'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getEngine } from '@/lib/sites/engine'
import { generateSiteContent, aiSection, aiRewritePage, type GeneratedPage } from '@/lib/sites/generate'
import { slugify } from '@/lib/sites/slug'
import { getPages } from '@/lib/sites/types'
import type { SiteContent, SiteTheme, SitePage, CtaType, SiteLayout, SiteAlign } from '@/lib/sites/types'
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

  // Normalise: strip protocol/whitespace, lowercase.
  const raw = String(formData.get('domain') ?? '').trim().toLowerCase()
  const domain = raw.replace(/^https?:\/\//, '').replace(/\/.*$/, '') || null

  try {
    await setSiteDomain(id, domain)
  } catch {
    // The `domain` column may not exist yet (migration 002 not run).
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
    seoTitle: existing?.seoTitle,
    seoDescription: existing?.seoDescription,
    ...homeFields,
    ctaLabel: existing?.ctaLabel,
    ctaType: existing?.ctaType,
    ctaHref: existing?.ctaHref,
    contactLabel: existing?.contactLabel,
    contactEmail: String(formData.get('contactEmail') ?? '').trim(),
    footer: existing?.footer,
    pages: updatedPages,
  })

  revalidatePath(`/sites/${id}`)
  revalidatePath(`/sites/${id}/edit`)
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
      return {
        heading: String(s?.heading ?? '').trim(),
        body: String(s?.body ?? '').trim(),
        image: String(s?.image ?? '').trim() || undefined,
        bgImage: String(s?.bgImage ?? '').trim() || undefined,
        bgColor: String(s?.bgColor ?? '').trim() || undefined,
        align: (['left', 'center', 'right'].includes(alignRaw) ? alignRaw : undefined) as SiteAlign | undefined,
        ctaType: ct,
        ctaLabel: ct ? String(s?.ctaLabel ?? '').trim() || 'Learn more' : undefined,
        ctaHref: ct === 'link' ? String(s?.ctaHref ?? '').trim() || undefined : undefined,
      }
    })
    .filter(s => s.heading || s.body || s.image || s.bgImage)
    .slice(0, 20)

  const layout: SiteLayout = parsed.layout === 'full' ? 'full' : 'contained'

  const rawNavLinks = Array.isArray(parsed.navLinks) ? (parsed.navLinks as Record<string, unknown>[]) : []
  const navLinks = rawNavLinks
    .map(l => ({ label: String(l?.label ?? '').trim(), href: String(l?.href ?? '').trim(), newTab: Boolean(l?.newTab) }))
    .filter(l => l.label && l.href)
    .slice(0, 10)

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
    ctaHref: ctaType === 'link' ? String(parsed.ctaHref ?? '').trim() || undefined : undefined,
  }
  const updatedPages: SitePage[] = getPages(existing).map(p => (p.slug === pageSlug ? { ...p, ...pageFields } : p))
  const home = updatedPages.find(p => p.slug === '') ?? updatedPages[0]

  const content: SiteContent = {
    theme,
    accentColor: String(parsed.accentColor ?? '').trim() || undefined,
    layout,
    fontSystem: String(parsed.fontSystem ?? '').trim() || undefined,
    brand: String(parsed.brand ?? '').trim() || undefined,
    logoImage: String(parsed.logoImage ?? '').trim() || undefined,
    navLinks: navLinks.length ? navLinks : undefined,
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
    footer: String(parsed.footer ?? '').trim() || undefined,
    pages: updatedPages,
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

  const newPage: SitePage = { id: 'p' + Date.now(), title, slug, headline: title, subheadline: '', sections: [] }
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

  const existing = (await getSite(id))?.content ?? null
  const pages = getPages(existing).map(p =>
    p.slug === slug
      ? { ...p, title: title || p.title, navLabel: navLabel || undefined, hidden: hidden || undefined }
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
