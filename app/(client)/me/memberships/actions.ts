'use server'

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getPortalSite } from '@/lib/portal/site'
import { getMyMembershipCustomer } from '@/lib/portal/memberships'
import { createBillingPortalSession } from '@/lib/stripe'
import { siteBaseUrl } from '@/lib/sites/baseurl'

// Open Stripe's hosted BILLING PORTAL so the signed-in client can update their card or CANCEL their
// paid membership. Auth is enforced twice over: the caller must be signed in, AND the customer id is
// fetched via a SECURITY-DEFINER RPC matched by their VERIFIED JWT email + the trusted portal slug —
// so a forged tierId resolves to no row (or someone else's row is never returned) and no portal opens.
// Dormant-safe: with payments unconfigured / no customer id, createBillingPortalSession returns null
// and we just send the client back to their memberships page.
export async function openBillingPortal(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) redirect('/me')

  const tierId = String(formData.get('tierId') ?? '').trim()
  if (!tierId) redirect('/me/memberships')

  const { slug } = await getPortalSite()
  // Ownership check: this returns the customer id ONLY for the caller's own membership in this tier.
  const found = await getMyMembershipCustomer(slug, tierId)
  const customerId = found?.customerId
  if (!customerId) redirect('/me/memberships')

  const returnUrl = `${siteBaseUrl()}/me/memberships`
  const url = await createBillingPortalSession(customerId, returnUrl)
  if (!url) redirect('/me/memberships')
  redirect(url)
}
