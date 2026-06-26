import { createSupabaseServerClient } from '@/lib/supabase/server'
import { cancelSubscription } from '@/lib/stripe'

// ---- Pricing rules (server-authoritative) ------------------------------
// A paid tier carries a recurring price. These bound what an owner may set; the
// public subscribe route reads the SAVED price (never the client), so these only
// gate what gets written. Currencies + interval mirror the booking/pay flows.
export const MEMBERSHIP_CURRENCIES = ['eur', 'usd', 'gbp', 'cad', 'aud'] as const
export type MembershipCurrency = (typeof MEMBERSHIP_CURRENCIES)[number]
export const MEMBERSHIP_INTERVALS = ['month', 'year'] as const
export type MembershipInterval = (typeof MEMBERSHIP_INTERVALS)[number]
// Stripe-recurring sanity bounds (in minor units): €1.00 min, €50,000 max.
export const MEMBERSHIP_MIN_CENTS = 100
export const MEMBERSHIP_MAX_CENTS = 5000000

// ---- Types -------------------------------------------------------------

// A membership tier the owner creates (e.g. "Inner Circle"). Courses can be
// gated to a tier; clients granted that tier unlock those courses. A tier may
// also carry a recurring PRICE (priceCents non-null) so the public can subscribe.
export interface Tier {
  id: string
  name: string
  description: string | null
  sort: number
  // null = a free / manual tier (no public subscribe). Non-null = a paid tier.
  priceCents: number | null
  currency: string
  interval: MembershipInterval
}

// A granted membership: a client (by email) holds a tier. Paid memberships also
// carry the Stripe subscription linkage + a lifecycle status the webhook syncs.
export interface Member {
  id: string
  tierId: string
  tierName: string
  clientEmail: string
  createdAt: string
  status: 'active' | 'past_due' | 'canceled'
  // True once a Stripe subscription is attached (i.e. a PAID membership). A free
  // / manual grant has no subscription.
  paid: boolean
}

// ---- Owner side (RLS: owner_id = auth.uid()) ---------------------------
// Every read/write below runs through the auth-aware server client, so RLS
// scopes every row to the signed-in owner. Inserts set owner_id from the
// AUTHED user (passed in), never from posted form data. grantMembership relies
// additionally on the memberships RLS with_check, which requires the target
// tier to belong to the owner — so an owner can't grant into a foreign tier.

function mapTier(r: {
  id: string
  name: string
  description: string | null
  sort: number
  price_cents?: number | null
  currency?: string | null
  bill_interval?: string | null
}): Tier {
  const interval: MembershipInterval = r.bill_interval === 'year' ? 'year' : 'month'
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    sort: r.sort,
    priceCents: typeof r.price_cents === 'number' ? r.price_cents : null,
    currency: (r.currency || 'eur').toLowerCase(),
    interval,
  }
}

// 42703 = undefined_column (Postgres); PGRST204 = column not in PostgREST's schema cache. Both mean
// the 021 pricing columns aren't applied yet — callers fall back to the base (free) tier shape.
function isMissingColumn(code: string | undefined): boolean {
  return code === '42703' || code === 'PGRST204'
}

// All of the owner's tiers, in display order. Reads the pricing columns (021); if they don't exist
// yet, retries with the base columns so pre-021 owners still see + manage their (free) tiers.
export async function listTiers(): Promise<Tier[]> {
  const supabase = createSupabaseServerClient()
  const withPrice = await supabase
    .from('tiers')
    .select('id, name, description, sort, price_cents, currency, bill_interval')
    .order('sort', { ascending: true })
    .order('created_at', { ascending: true })
  if (!withPrice.error) return (withPrice.data ?? []).map(mapTier)
  if (!isMissingColumn(withPrice.error.code)) throw withPrice.error
  const { data, error } = await supabase
    .from('tiers')
    .select('id, name, description, sort')
    .order('sort', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapTier)
}

// The owner's optional pricing for a tier. priceCents:
//   - undefined  → don't touch pricing (used by paths that only edit name/description)
//   - null       → an explicitly FREE tier (clear any price)
//   - a number   → a PAID tier; validated against the MEMBERSHIP_* bounds
export interface TierPricing {
  priceCents?: number | null
  currency?: string
  interval?: MembershipInterval
}

// Build the pricing columns to write, validating server-side. Throws on an out-of-range price so a
// bad amount never reaches Stripe. Returns {} when pricing wasn't submitted (leave columns as-is).
function pricingColumns(p: TierPricing): Record<string, unknown> {
  if (p.priceCents === undefined) return {}
  if (p.priceCents === null) {
    // Explicitly free: clear the price (keep currency/interval at their defaults/whatever's there).
    return { price_cents: null }
  }
  const cents = Math.round(p.priceCents)
  if (!Number.isInteger(cents) || cents < MEMBERSHIP_MIN_CENTS || cents > MEMBERSHIP_MAX_CENTS) {
    throw new Error('invalid_price')
  }
  const currency = (p.currency || 'eur').toLowerCase()
  const safeCurrency = (MEMBERSHIP_CURRENCIES as readonly string[]).includes(currency) ? currency : 'eur'
  const interval: MembershipInterval = p.interval === 'year' ? 'year' : 'month'
  return { price_cents: cents, currency: safeCurrency, bill_interval: interval }
}

export async function createTier(
  ownerId: string,
  input: { name: string; description: string } & TierPricing,
): Promise<void> {
  const supabase = createSupabaseServerClient()
  // Append: place new tiers after the current last sibling.
  const { data: last } = await supabase
    .from('tiers')
    .select('sort')
    .order('sort', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextSort = (last?.sort ?? -1) + 1
  const price = pricingColumns(input)
  // owner_id is the AUTHED user — never a posted field.
  const base = {
    owner_id: ownerId,
    name: input.name,
    description: input.description || null,
    sort: nextSort,
  }
  const withPrice = await supabase.from('tiers').insert({ ...base, ...price })
  if (!withPrice.error) return
  // Pre-021: the pricing columns don't exist — insert the free tier without them so tier creation
  // keeps working. (A submitted price is silently dropped until the migration is applied.)
  if (!isMissingColumn(withPrice.error.code)) throw withPrice.error
  const { error } = await supabase.from('tiers').insert(base)
  if (error) throw error
}

export async function updateTier(
  id: string,
  input: { name: string; description: string } & TierPricing,
): Promise<void> {
  const supabase = createSupabaseServerClient()
  const price = pricingColumns(input)
  const base = {
    name: input.name,
    description: input.description || null,
  }
  const withPrice = await supabase
    .from('tiers')
    .update({ ...base, ...price })
    .eq('id', id)
  if (!withPrice.error) return
  if (!isMissingColumn(withPrice.error.code)) throw withPrice.error
  const { error } = await supabase.from('tiers').update(base).eq('id', id)
  if (error) throw error
}

export async function deleteTier(id: string): Promise<void> {
  const supabase = createSupabaseServerClient()
  // Memberships cascade (FK on delete cascade); gated courses un-gate
  // (courses.tier_id on delete set null) — both handled in the DB.
  const { error } = await supabase.from('tiers').delete().eq('id', id)
  if (error) throw error
}

function mapMember(r: {
  id: string
  tier_id: string
  client_email: string
  created_at: string
  status?: string | null
  stripe_subscription_id?: string | null
  tiers?: { name: string } | { name: string }[] | null
}): Member {
  // PostgREST returns the embedded parent as an object (or null); be tolerant of an array shape too.
  const tier = Array.isArray(r.tiers) ? r.tiers[0] : r.tiers
  const status: Member['status'] = r.status === 'past_due' ? 'past_due' : r.status === 'canceled' ? 'canceled' : 'active'
  return {
    id: r.id,
    tierId: r.tier_id,
    tierName: tier?.name ?? '—',
    clientEmail: r.client_email,
    createdAt: r.created_at,
    status,
    paid: !!r.stripe_subscription_id,
  }
}

// All of the owner's granted memberships, with the tier name joined in. Reads the 021 status +
// subscription columns; falls back to the base columns (all treated as active/free) pre-021.
export async function listMemberships(): Promise<Member[]> {
  const supabase = createSupabaseServerClient()
  const withStatus = await supabase
    .from('memberships')
    .select('id, tier_id, client_email, created_at, status, stripe_subscription_id, tiers(name)')
    .order('created_at', { ascending: false })
  if (!withStatus.error) {
    return (withStatus.data ?? []).map(r => mapMember(r as Parameters<typeof mapMember>[0]))
  }
  if (!isMissingColumn(withStatus.error.code)) throw withStatus.error
  const { data, error } = await supabase
    .from('memberships')
    .select('id, tier_id, client_email, created_at, tiers(name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(r => mapMember(r as Parameters<typeof mapMember>[0]))
}

// Grant a client (by email) a membership in one of the owner's tiers. owner_id
// is the AUTHED user; the memberships RLS with_check additionally requires the
// tier to belong to the owner, so a foreign tier id is rejected by the DB. A
// duplicate (same tier + email) is swallowed via the unique constraint.
export async function grantMembership(
  ownerId: string,
  tierId: string,
  email: string,
): Promise<void> {
  const supabase = createSupabaseServerClient()
  const clientEmail = email.trim().toLowerCase()
  if (!clientEmail || !tierId) return
  const { error } = await supabase.from('memberships').insert({
    owner_id: ownerId,
    tier_id: tierId,
    client_email: clientEmail,
  })
  // 23505 = unique_violation → already a member of this tier; treat as success.
  if (error && error.code !== '23505') throw error
}

// Revoke a membership. If it's a PAID one (has a Stripe subscription), cancel the subscription
// FIRST so the client isn't billed again after losing access — then remove the row exactly as
// before. RLS scopes the select/delete to the signed-in owner, so a foreign id reads as null and
// no Stripe call is made. Cancelling is best-effort (cancelSubscription is null-safe); a Stripe
// failure does not block the local revoke (the webhook would also flip status on any later cancel).
export async function revokeMembership(id: string): Promise<void> {
  const supabase = createSupabaseServerClient()

  // Read the subscription id (021 column) so we can cancel it. Tolerant of pre-021 schema: if the
  // column doesn't exist there can't be a paid membership, so skip straight to the delete.
  const lookup = await supabase
    .from('memberships')
    .select('id, stripe_subscription_id')
    .eq('id', id)
    .maybeSingle()
  let subscriptionId: string | null = null
  if (!lookup.error) {
    subscriptionId = (lookup.data as { stripe_subscription_id?: string | null } | null)?.stripe_subscription_id ?? null
  } else if (!isMissingColumn(lookup.error.code)) {
    throw lookup.error
  }

  if (subscriptionId) {
    // Stop future billing on the owner's own Stripe account. Best-effort + dormant-safe.
    await cancelSubscription(subscriptionId)
  }

  const { error } = await supabase.from('memberships').delete().eq('id', id)
  if (error) throw error
}
