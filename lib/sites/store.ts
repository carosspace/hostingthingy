import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Site, SiteStatus, SiteContent } from './types'

// Persistence for sites, backed by Supabase Postgres with Row-Level Security
// (a user only ever sees their own sites). Throws if Supabase isn't configured
// yet — callers degrade gracefully to a "connect your database" message.

interface SiteRow {
  id: string
  owner_id: string
  name: string
  slug: string
  template: string
  status: SiteStatus
  url: string | null
  domain: string | null
  content: SiteContent | null
  stripe_account_id: string | null
  stripe_charges_enabled: boolean | null
  created_at: string
  updated_at: string
}

function rowToSite(r: SiteRow): Site {
  return {
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    slug: r.slug,
    template: r.template,
    status: r.status,
    url: r.url,
    domain: r.domain ?? null,
    content: (r.content ?? null) as SiteContent | null,
    // Optional-chained so a site read before migration 017 ran still maps cleanly.
    stripeAccountId: r.stripe_account_id ?? null,
    stripeChargesEnabled: !!r.stripe_charges_enabled,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export async function listSites(): Promise<Site[]> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as SiteRow[]).map(rowToSite)
}

export async function getSite(id: string): Promise<Site | null> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.from('sites').select('*').eq('id', id).single()
  if (error || !data) return null
  return rowToSite(data as SiteRow)
}

export async function createSiteRecord(
  ownerId: string,
  input: { name: string; slug: string; template: string; status: SiteStatus },
): Promise<Site> {
  const supabase = createSupabaseServerClient()
  // Slug is the public routing key, so it must be globally unique (see migration 010). If a
  // unique-violation comes back, retry with a numeric suffix so a duplicate site name still
  // creates a site. Without the unique index this loop runs once with the base slug (no-op).
  const base = input.slug || 'site'
  for (let n = 0; n < 50; n++) {
    const slug = n === 0 ? base : `${base}-${n + 1}`
    const { data, error } = await supabase
      .from('sites')
      .insert({ owner_id: ownerId, name: input.name, slug, template: input.template, status: input.status, url: null })
      .select()
      .single()
    if (!error) return rowToSite(data as SiteRow)
    if (error.code !== '23505') throw error // only a duplicate-slug collision is retryable
  }
  throw new Error('Could not find an available address for this site — try a different name.')
}

export async function updateSiteStatus(
  id: string,
  status: SiteStatus,
  url: string | null,
): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('sites')
    .update({ status, url, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function renameSiteRecord(id: string, name: string, slug: string): Promise<void> {
  const supabase = createSupabaseServerClient()
  // Same unique-slug retry as createSiteRecord (updating a row to its own slug never collides).
  const base = slug || 'site'
  for (let n = 0; n < 50; n++) {
    const s = n === 0 ? base : `${base}-${n + 1}`
    const { error } = await supabase
      .from('sites')
      .update({ name, slug: s, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) return
    if (error.code !== '23505') throw error
  }
  throw new Error('Could not find an available address for this site — try a different name.')
}

export async function setSiteDomain(id: string, domain: string | null): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('sites')
    .update({ domain, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function saveSiteContent(id: string, content: SiteContent): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('sites')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteSiteRecord(id: string): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('sites').delete().eq('id', id)
  if (error) throw error
}

// --- Stripe Connect (top-level sites columns, NOT the content jsonb) --------------
// Each write touches ONLY the stripe_* columns (+ updated_at), so it can never clobber
// content/domain/etc. RLS-scoped: the "owner updates own sites" policy means a non-owner
// update affects zero rows. All run as the signed-in owner.

// Save the owner's connected Stripe account id on their site.
export async function setSiteStripeAccount(id: string, accountId: string): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('sites')
    .update({ stripe_account_id: accountId, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// Cache whether the connected account can take charges (mirrors Stripe's charges_enabled).
export async function setSiteStripeCharges(id: string, enabled: boolean): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('sites')
    .update({ stripe_charges_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// Disconnect: clear the account link locally (does NOT delete the Stripe account itself).
export async function clearSiteStripe(id: string): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('sites')
    .update({ stripe_account_id: null, stripe_charges_enabled: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
