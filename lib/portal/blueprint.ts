import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// SERVER-ONLY. This module reads the SEPARATE Divine Blueprint Supabase project
// (its own DB) via the service-role key, so it can NEVER be imported into a
// client component — there is no 'use client' here and the env vars are NOT
// NEXT_PUBLIC. The service-role key must never reach the browser.

// One blueprint the signed-in client owns, as the portal page renders it.
export interface MyBlueprint {
  id: string
  name: string | null
  generatedAt: string | null
}

// The three NEW env vars (set in Coolify). They may be absent right now — every
// reader below degrades gracefully rather than crashing the portal.
const BLUEPRINT_SUPABASE_URL = process.env.BLUEPRINT_SUPABASE_URL
const BLUEPRINT_SUPABASE_SERVICE_ROLE_KEY = process.env.BLUEPRINT_SUPABASE_SERVICE_ROLE_KEY
const BLUEPRINT_APP_URL = process.env.BLUEPRINT_APP_URL

// The module is "configured" only when BOTH the blueprint DB url and its
// service-role key are present. Without them we can't (and don't) query.
export function blueprintConfigured(): boolean {
  return Boolean(BLUEPRINT_SUPABASE_URL && BLUEPRINT_SUPABASE_SERVICE_ROLE_KEY)
}

// The public reader URL for one blueprint, or null if BLUEPRINT_APP_URL is unset
// (the page then shows the card without a working link).
export function blueprintViewUrl(id: string): string | null {
  if (!BLUEPRINT_APP_URL) return null
  // Trim a trailing slash so we don't produce a double-slash in the path.
  const base = BLUEPRINT_APP_URL.replace(/\/+$/, '')
  return `${base}/blueprint/${id}`
}

// Lazily build (and reuse) the service-role client for the blueprint project. We
// only construct it once configured, so the module stays inert when the envs are
// absent. No session persistence — this is a stateless server-side reader.
let cachedClient: SupabaseClient | null = null
function getClient(): SupabaseClient | null {
  if (!blueprintConfigured()) return null
  if (!cachedClient) {
    cachedClient = createClient(
      BLUEPRINT_SUPABASE_URL as string,
      BLUEPRINT_SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
  }
  return cachedClient
}

// Shapes of the rows we read from the blueprint DB.
interface OrderRow {
  id: string
  email: string | null
  name: string | null
}
interface BlueprintRow {
  id: string
  order_id: string
  generated_at: string | null
}

// All blueprints belonging to ONE verified email, newest first.
//
// SECURITY: `email` is the ONLY input to the query and it comes from the page,
// which supplies the AUTHENTICATED client's verified user.email. The lib never
// accepts an email from a query string or any client-supplied source, so a
// client can only ever see blueprints for their own verified email.
//
// Matching is CASE-INSENSITIVE: the portal login email and the checkout email
// may differ in case, so we normalize both sides to lowercase. We use ilike on
// orders.email (with the term escaped) and additionally re-filter in JS so a
// stray case mismatch can never leak another person's reading.
//
// GRACEFUL DEGRADE: not configured, empty email, an unreachable DB, or any
// thrown/returned error → []. This never throws; a misconfigured or down
// blueprint DB must not crash the portal.
export async function getMyBlueprints(email: string): Promise<MyBlueprint[]> {
  const normalized = (email || '').trim().toLowerCase()
  if (!normalized) return []

  const supabase = getClient()
  if (!supabase) return []

  try {
    // Escape ilike wildcards so an email containing %, _ or * is matched literally
    // (the JS exact-equality re-filter below is the real boundary regardless).
    const escaped = normalized.replace(/[\\%_*]/g, ch => `\\${ch}`)
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, email, name')
      .ilike('email', escaped)

    if (ordersError) {
      console.error('[client-portal] blueprint orders query failed:', ordersError.message)
      return []
    }

    // Belt-and-braces: keep only the orders whose lowercased email matches
    // exactly, regardless of what ilike returned.
    const myOrders = ((orders ?? []) as OrderRow[]).filter(
      o => (o.email ?? '').trim().toLowerCase() === normalized,
    )
    if (myOrders.length === 0) return []

    const ordersById = new Map(myOrders.map(o => [o.id, o]))
    const orderIds = myOrders.map(o => o.id)

    // Fetch the blueprints for those orders, newest first. An order without a
    // blueprint row simply won't appear here, so only ready readings surface.
    const { data: blueprints, error: bpError } = await supabase
      .from('blueprints')
      .select('id, order_id, generated_at')
      .in('order_id', orderIds)
      .order('generated_at', { ascending: false })

    if (bpError) {
      console.error('[client-portal] blueprint rows query failed:', bpError.message)
      return []
    }

    return ((blueprints ?? []) as BlueprintRow[])
      .filter(bp => ordersById.has(bp.order_id))
      .map(bp => ({
        id: bp.id,
        name: ordersById.get(bp.order_id)?.name ?? null,
        generatedAt: bp.generated_at ?? null,
      }))
  } catch (e) {
    console.error('[client-portal] getMyBlueprints threw:', e)
    return []
  }
}
