'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getEngine } from '@/lib/sites/engine'
import { generateSiteContent } from '@/lib/sites/generate'
import { slugify } from '@/lib/sites/slug'
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

  const content = await generateSiteContent(site.name, description)
  await saveSiteContent(id, content)

  revalidatePath(`/sites/${id}`)
  revalidatePath(`/sites/${id}/edit`)
}

export async function saveSiteContentAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const id = String(formData.get('id') ?? '')
  if (!id) return

  const sections = [1, 2, 3]
    .map(i => ({
      heading: String(formData.get(`s${i}h`) ?? '').trim(),
      body: String(formData.get(`s${i}b`) ?? '').trim(),
    }))
    .filter(s => s.heading || s.body)

  const themeRaw = String(formData.get('theme') ?? 'sand')
  const theme = (['sand', 'midnight', 'sage', 'rose'].includes(themeRaw) ? themeRaw : 'sand') as
    | 'sand'
    | 'midnight'
    | 'sage'
    | 'rose'

  await saveSiteContent(id, {
    theme,
    headline: String(formData.get('headline') ?? '').trim(),
    subheadline: String(formData.get('subheadline') ?? '').trim(),
    sections,
    contactEmail: String(formData.get('contactEmail') ?? '').trim(),
  })

  revalidatePath(`/sites/${id}`)
  revalidatePath(`/sites/${id}/edit`)
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
