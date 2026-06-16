'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getSite, saveSiteContent } from '@/lib/sites/store'
import { slugify } from '@/lib/sites/slug'
import { generateSitePages } from '@/lib/sites/generate'
import { getStylePreset } from '@/lib/sites/styles'
import { getFontSystem } from '@/lib/sites/fonts'
import type { SiteContent, SitePage } from '@/lib/sites/types'

export async function aiCreateSiteAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const id = String(formData.get('id') ?? '')
  if (!id) return

  let payload: {
    type?: string
    description?: string
    styleKey?: string
    fontKey?: string
    pages?: { title?: string; purpose?: string }[]
  }
  try {
    payload = JSON.parse(String(formData.get('payload') ?? '{}'))
  } catch {
    return
  }

  const site = await getSite(id)
  if (!site) return

  const description = String(payload.description ?? '').trim()
  const type = String(payload.type ?? '').trim() || 'website'
  const style = getStylePreset(String(payload.styleKey ?? ''))

  // Build the page specs (Home is always first, slug ''). De-duplicate slugs.
  const rawPages = (Array.isArray(payload.pages) ? payload.pages : [])
    .map(p => ({ title: String(p?.title ?? '').trim(), purpose: String(p?.purpose ?? '').trim() }))
    .filter(p => p.title)
    .slice(0, 12)
  const specs = rawPages.length ? rawPages : [{ title: 'Home', purpose: 'The homepage.' }]
  if (!specs.some(p => p.title.toLowerCase() === 'home')) {
    specs.unshift({ title: 'Home', purpose: 'The homepage.' })
  }

  const usedSlugs = new Set<string>()
  const slugs = specs.map((p, i) => {
    if (i === 0 || p.title.toLowerCase() === 'home') {
      usedSlugs.add('')
      return ''
    }
    let s = slugify(p.title) || 'page'
    let n = 1
    while (usedSlugs.has(s)) {
      n += 1
      s = `${slugify(p.title) || 'page'}-${n}`
    }
    usedSlugs.add(s)
    return s
  })

  const generated = await generateSitePages({
    siteName: site.name,
    type,
    description,
    styleName: style.name,
    pageSpecs: specs,
  })

  const pages: SitePage[] = specs.map((spec, i) => ({
    id: 'p' + i,
    title: spec.title,
    slug: slugs[i],
    headline: generated[i]?.headline || spec.title,
    subheadline: generated[i]?.subheadline || '',
    sections: generated[i]?.sections ?? [],
    // Give the Home and Contact pages a sensible call-to-action by default.
    ...(spec.title.toLowerCase() === 'home' || spec.title.toLowerCase() === 'contact'
      ? { ctaType: 'email' as const, ctaLabel: 'Get in touch' }
      : {}),
  }))

  const home = pages.find(p => p.slug === '') ?? pages[0]
  const existing = site.content ?? null

  const content: SiteContent = {
    theme: style.theme,
    accentColor: style.accentColor,
    fontSystem: getFontSystem(payload.fontKey).key,
    brand: existing?.brand,
    seoTitle: existing?.seoTitle,
    seoDescription: existing?.seoDescription || description.slice(0, 160) || undefined,
    headline: home.headline,
    subheadline: home.subheadline,
    sections: home.sections,
    ctaType: home.ctaType,
    ctaLabel: home.ctaLabel,
    contactLabel: existing?.contactLabel,
    contactEmail: existing?.contactEmail ?? '',
    footer: existing?.footer,
    pages,
  }

  await saveSiteContent(id, content)
  revalidatePath(`/sites/${id}/design`)
  revalidatePath(`/sites/${id}`)
  redirect(`/sites/${id}/design`)
}
