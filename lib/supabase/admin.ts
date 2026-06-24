import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// SERVER-ONLY. The privileged service-role client for the PLATFORM Supabase project. It
// bypasses Row-Level Security, so it must NEVER be imported into a client component and the
// key must never reach the browser (SUPABASE_SERVICE_ROLE_KEY is not NEXT_PUBLIC).
//
// Used by system paths that act outside any user session — chiefly the Stripe Connect webhook
// (it writes `sales` rows + flips a site's stripe_charges_enabled with no signed-in user). Stays
// inert (returns null) until both the platform URL and the service-role key are configured, so
// nothing throws when payments are dormant.
//
// Distinct from lib/supabase/server.ts (the cookie-bound, RLS-respecting per-user client) and
// from lib/portal/blueprint.ts (the SEPARATE Divine Blueprint project's service-role client).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// True only when both the URL and the service-role key are present.
export function supabaseAdminConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY)
}

// Lazily build (and reuse) the service-role client. Constructed only once configured, so the
// module stays inert when the env is absent. Stateless — no session persistence.
let cached: SupabaseClient | null = null
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!supabaseAdminConfigured()) return null
  if (!cached) {
    cached = createClient(SUPABASE_URL as string, SERVICE_ROLE_KEY as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return cached
}
