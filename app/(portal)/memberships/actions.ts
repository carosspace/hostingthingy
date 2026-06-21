'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import {
  createTier,
  updateTier,
  deleteTier,
  grantMembership,
  revokeMembership,
} from '@/lib/memberships/repo'

// ---- Tiers -------------------------------------------------------------

export async function createTierAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const description = String(formData.get('description') ?? '').trim()
  // owner_id is the AUTHED user — never a posted field.
  await createTier(user.id, { name, description })
  revalidatePath('/memberships')
}

export async function updateTierAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const description = String(formData.get('description') ?? '').trim()
  await updateTier(id, { name, description })
  revalidatePath('/memberships')
}

export async function deleteTierAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await deleteTier(id)
  revalidatePath('/memberships')
}

// ---- Memberships -------------------------------------------------------

export async function grantMembershipAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const tierId = String(formData.get('tierId') ?? '')
  const email = String(formData.get('email') ?? '').trim()
  if (!tierId || !email) return
  // owner_id is the AUTHED user; the RLS with_check requires the tier to be the
  // owner's, so a foreign tier id is rejected by the DB.
  await grantMembership(user.id, tierId, email)
  revalidatePath('/memberships')
}

export async function revokeMembershipAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await revokeMembership(id)
  revalidatePath('/memberships')
}
