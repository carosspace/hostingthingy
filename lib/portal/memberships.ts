import { createSupabaseServerClient } from '@/lib/supabase/server'

// A tier the signed-in client holds with the portal's owner (from
// get_my_memberships). This is the read-only client view of a membership.
export interface MyMembership {
  tierId: string
  name: string
  description: string | null
}

// The signed-in client's tiers with the portal owner (what they're a member of).
// The owner is resolved server-side from the trusted slug by the
// get_my_memberships RPC — we never pass an owner id, and the RPC matches the
// client by their verified JWT email.
// GRACEFUL DEGRADE: any error (e.g. migration 015 not applied) returns [] + logs,
// so the page renders an empty list instead of crashing.
export async function getMyMemberships(slug: string): Promise<MyMembership[]> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.rpc('get_my_memberships', { p_site_slug: slug })
    if (error) {
      console.error('[client-portal] get_my_memberships failed (migration 015 applied?):', error.message)
      return []
    }
    return (data ?? []).map(
      (r: { tier_id: string; name: string; description: string | null }) => ({
        tierId: r.tier_id,
        name: r.name,
        description: r.description ?? null,
      }),
    )
  } catch (e) {
    console.error('[client-portal] get_my_memberships threw:', e)
    return []
  }
}
