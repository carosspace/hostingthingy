import { createSupabaseServerClient } from '@/lib/supabase/server'

// ---- Types -------------------------------------------------------------

// A membership tier the owner creates (e.g. "Inner Circle"). Courses can be
// gated to a tier; clients granted that tier unlock those courses.
export interface Tier {
  id: string
  name: string
  description: string | null
  sort: number
}

// A granted membership: a client (by email) holds a tier.
export interface Member {
  id: string
  tierId: string
  tierName: string
  clientEmail: string
  createdAt: string
}

// ---- Owner side (RLS: owner_id = auth.uid()) ---------------------------
// Every read/write below runs through the auth-aware server client, so RLS
// scopes every row to the signed-in owner. Inserts set owner_id from the
// AUTHED user (passed in), never from posted form data. grantMembership relies
// additionally on the memberships RLS with_check, which requires the target
// tier to belong to the owner — so an owner can't grant into a foreign tier.

function mapTier(r: { id: string; name: string; description: string | null; sort: number }): Tier {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    sort: r.sort,
  }
}

// All of the owner's tiers, in display order.
export async function listTiers(): Promise<Tier[]> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('tiers')
    .select('id, name, description, sort')
    .order('sort', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapTier)
}

export async function createTier(
  ownerId: string,
  input: { name: string; description: string },
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
  // owner_id is the AUTHED user — never a posted field.
  const { error } = await supabase.from('tiers').insert({
    owner_id: ownerId,
    name: input.name,
    description: input.description || null,
    sort: nextSort,
  })
  if (error) throw error
}

export async function updateTier(
  id: string,
  input: { name: string; description: string },
): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('tiers')
    .update({
      name: input.name,
      description: input.description || null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteTier(id: string): Promise<void> {
  const supabase = createSupabaseServerClient()
  // Memberships cascade (FK on delete cascade); gated courses un-gate
  // (courses.tier_id on delete set null) — both handled in the DB.
  const { error } = await supabase.from('tiers').delete().eq('id', id)
  if (error) throw error
}

// All of the owner's granted memberships, with the tier name joined in.
export async function listMemberships(): Promise<Member[]> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('memberships')
    .select('id, tier_id, client_email, created_at, tiers(name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(r => {
    const row = r as {
      id: string
      tier_id: string
      client_email: string
      created_at: string
      tiers?: { name: string } | { name: string }[] | null
    }
    // PostgREST returns the embedded parent as an object (or null); be tolerant
    // of an array shape too.
    const tier = Array.isArray(row.tiers) ? row.tiers[0] : row.tiers
    return {
      id: row.id,
      tierId: row.tier_id,
      tierName: tier?.name ?? '—',
      clientEmail: row.client_email,
      createdAt: row.created_at,
    }
  })
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

export async function revokeMembership(id: string): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('memberships').delete().eq('id', id)
  if (error) throw error
}
