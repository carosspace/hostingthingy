'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import {
  createTier,
  updateTier,
  deleteTier,
  grantMembership,
  revokeMembership,
  MEMBERSHIP_CURRENCIES,
  type MembershipInterval,
  type TierPricing,
} from '@/lib/memberships/repo'

// ---- Tiers -------------------------------------------------------------

// Read the optional pricing fields off the form. A tier is PAID only when "paid" is checked AND a
// valid amount is given; otherwise it's free (priceCents: null, which clears any prior price). The
// amount field is in MAJOR units (e.g. "9.99" euros) → converted to cents here; the repo re-validates
// the cents against the MEMBERSHIP_* bounds, so an out-of-range value is rejected server-side.
function readPricing(formData: FormData): TierPricing {
  const paid = String(formData.get('paid') ?? '') === 'on'
  if (!paid) return { priceCents: null }
  const raw = String(formData.get('price') ?? '').trim().replace(',', '.')
  const major = Number(raw)
  if (!raw || !Number.isFinite(major) || major <= 0) return { priceCents: null }
  const cents = Math.round(major * 100)
  const currencyRaw = String(formData.get('currency') ?? 'eur').toLowerCase()
  const currency = (MEMBERSHIP_CURRENCIES as readonly string[]).includes(currencyRaw) ? currencyRaw : 'eur'
  const interval: MembershipInterval = String(formData.get('interval') ?? 'month') === 'year' ? 'year' : 'month'
  return { priceCents: cents, currency, interval }
}

export async function createTierAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const description = String(formData.get('description') ?? '').trim()
  // owner_id is the AUTHED user — never a posted field. The repo validates the price.
  try {
    await createTier(user.id, { name, description, ...readPricing(formData) })
  } catch (e) {
    if (!(e instanceof Error && e.message === 'invalid_price')) throw e
  }
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
  try {
    await updateTier(id, { name, description, ...readPricing(formData) })
  } catch (e) {
    if (!(e instanceof Error && e.message === 'invalid_price')) throw e
  }
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
