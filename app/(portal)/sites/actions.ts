'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getEngine } from '@/lib/sites/engine'
import { slugify } from '@/lib/sites/slug'
import {
  createSiteRecord,
  updateSiteStatus,
  renameSiteRecord,
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
