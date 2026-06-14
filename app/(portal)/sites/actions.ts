'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { getEngine } from '@/lib/sites/engine'
import { slugify } from '@/lib/sites/slug'
import {
  createSiteRecord,
  updateSiteStatus,
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
}
