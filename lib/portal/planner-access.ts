import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { PORTAL_SITE_SLUG } from '@/lib/portal/site'

// The sellable planner is one product, gated like the workbooks. Buying it (redeeming a
// code or being gifted access) creates a workbook_access row for this slug.
export const PLANNER_SLUG = 'aligned'

// May this account use / sync the planner? True when:
//   • they ARE the site owner (Carolina always has her own product), or
//   • they hold a workbook_access row for the planner product (bought / code / gift).
// Uses the service role with the email/id taken from the verified session — never the client.
export async function plannerEntitled(user: { id?: string | null; email?: string | null }): Promise<boolean> {
  const email = String(user?.email ?? '').trim().toLowerCase()
  const admin = getSupabaseAdmin()
  if (!admin) return false
  try {
    const { data: site } = await admin.from('sites').select('owner_id').eq('slug', PORTAL_SITE_SLUG).maybeSingle()
    const ownerId = (site as { owner_id?: string } | null)?.owner_id
    if (!ownerId) return false
    if (user?.id && user.id === ownerId) return true // the owner always holds her own products
    if (!email) return false
    const { data } = await admin
      .from('workbook_access')
      .select('client_email')
      .eq('owner_id', ownerId)
      .eq('slug', PLANNER_SLUG)
      .eq('client_email', email) // stored lowercased on grant/redeem
      .maybeSingle()
    return !!data
  } catch {
    return false
  }
}
