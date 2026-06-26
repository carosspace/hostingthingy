import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { MembershipInterval } from './repo'

// SERVER-ONLY. The public read path for paid membership tiers, via the service-role admin client (no
// user session) — the public site RPC deliberately exposes none of this. Used by the join page (list
// an owner's paid tiers) and the subscribe API (load one tier's SERVER-AUTHORITATIVE price). Dormant-
// safe: with the admin client unconfigured these return [] / null and nothing throws.

// A paid tier the public can subscribe to (price_cents not null).
export interface PublicTier {
  id: string
  name: string
  description: string | null
  priceCents: number
  currency: string
  interval: MembershipInterval
}

function toInterval(v: unknown): MembershipInterval {
  return v === 'year' ? 'year' : 'month'
}

// All of an owner's PAID tiers (price_cents not null), in display order. Returns [] if payments are
// dormant, the owner has none, or the pricing columns aren't migrated yet (the price filter errors
// pre-021 → caught → []).
export async function listPaidTiersForOwner(ownerId: string): Promise<PublicTier[]> {
  const admin = getSupabaseAdmin()
  if (!admin || !ownerId) return []
  const { data, error } = await admin
    .from('tiers')
    .select('id, name, description, sort, price_cents, currency, bill_interval')
    .eq('owner_id', ownerId)
    .not('price_cents', 'is', null)
    .order('sort', { ascending: true })
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data
    .filter(r => typeof (r as { price_cents?: number | null }).price_cents === 'number')
    .map(r => {
      const row = r as { id: string; name: string; description: string | null; price_cents: number; currency: string | null; bill_interval: string | null }
      return {
        id: String(row.id),
        name: row.name,
        description: row.description ?? null,
        priceCents: row.price_cents,
        currency: (row.currency || 'eur').toLowerCase(),
        interval: toInterval(row.bill_interval),
      }
    })
}

// Load ONE paid tier and confirm it belongs to `ownerId` AND has a price. Returns null if the tier
// doesn't exist, belongs to another owner, has no price (free/manual), or pricing isn't migrated. The
// price/currency/interval here are the SERVER-AUTHORITATIVE values the subscribe route charges on.
export async function getPaidTierForOwner(tierId: string, ownerId: string): Promise<PublicTier | null> {
  const admin = getSupabaseAdmin()
  if (!admin || !tierId || !ownerId) return null
  const { data, error } = await admin
    .from('tiers')
    .select('id, name, description, owner_id, price_cents, currency, bill_interval')
    .eq('id', tierId)
    .maybeSingle()
  if (error || !data) return null
  const row = data as {
    id: string
    name: string
    description: string | null
    owner_id: string
    price_cents: number | null
    currency: string | null
    bill_interval: string | null
  }
  // Defense-in-depth: the tier MUST belong to this site's owner, and MUST be priced.
  if (String(row.owner_id) !== ownerId) return null
  if (typeof row.price_cents !== 'number') return null
  return {
    id: String(row.id),
    name: row.name,
    description: row.description ?? null,
    priceCents: row.price_cents,
    currency: (row.currency || 'eur').toLowerCase(),
    interval: toInterval(row.bill_interval),
  }
}
