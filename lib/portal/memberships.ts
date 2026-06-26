import { createSupabaseServerClient } from '@/lib/supabase/server'

// A tier the signed-in client holds with the portal's owner (from get_my_memberships). This is the
// read-only client view of a membership — now including the lifecycle status, renewal date and the
// tier's price (so a PAID membership reads as paid + can show a "manage / cancel" button).
export interface MyMembership {
  tierId: string
  name: string
  description: string | null
  status: 'active' | 'past_due' | 'canceled'
  currentPeriodEnd: string | null
  priceCents: number | null
  currency: string
  interval: 'month' | 'year'
  // True for a paid membership (has a Stripe subscription) — gates the billing-portal button.
  hasSubscription: boolean
}

// The signed-in client's tiers with the portal owner (what they're a member of). The owner is
// resolved server-side from the trusted slug by the get_my_memberships RPC — we never pass an owner
// id, and the RPC matches the client by their verified JWT email.
// GRACEFUL DEGRADE: any error (e.g. migration 015/021 not applied) returns [] + logs, so the page
// renders an empty list instead of crashing. Pre-021 the RPC returns only the base columns, so the
// extra fields fall back to safe defaults (status 'active', no price, no subscription).
export async function getMyMemberships(slug: string): Promise<MyMembership[]> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.rpc('get_my_memberships', { p_site_slug: slug })
    if (error) {
      console.error('[client-portal] get_my_memberships failed (migration 015/021 applied?):', error.message)
      return []
    }
    return (data ?? []).map((row: Record<string, unknown>) => {
      const statusRaw = String(row.status ?? 'active')
      const status: MyMembership['status'] = statusRaw === 'past_due' ? 'past_due' : statusRaw === 'canceled' ? 'canceled' : 'active'
      const interval: MyMembership['interval'] = row.bill_interval === 'year' ? 'year' : 'month'
      return {
        tierId: String(row.tier_id),
        name: String(row.name ?? ''),
        description: (row.description as string | null) ?? null,
        status,
        currentPeriodEnd: (row.current_period_end as string | null) ?? null,
        priceCents: typeof row.price_cents === 'number' ? (row.price_cents as number) : null,
        currency: String(row.currency ?? 'eur').toLowerCase(),
        interval,
        hasSubscription: !!row.has_subscription,
      }
    })
  } catch (e) {
    console.error('[client-portal] get_my_memberships threw:', e)
    return []
  }
}

// The Stripe customer id (+ status) for the signed-in client's OWN membership in a tier, via a
// SECURITY DEFINER RPC matched by their verified JWT email. Used by the billing-portal action to
// open Stripe for ONLY the caller's own subscription. Returns null on any error / no row / pre-021.
export async function getMyMembershipCustomer(
  slug: string,
  tierId: string,
): Promise<{ customerId: string | null; subscriptionId: string | null } | null> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.rpc('get_my_membership_customer', { p_site_slug: slug, p_tier_id: tierId })
    if (error) {
      console.error('[client-portal] get_my_membership_customer failed:', error.message)
      return null
    }
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return null
    return {
      customerId: (row.stripe_customer_id as string | null) ?? null,
      subscriptionId: (row.stripe_subscription_id as string | null) ?? null,
    }
  } catch (e) {
    console.error('[client-portal] get_my_membership_customer threw:', e)
    return null
  }
}
