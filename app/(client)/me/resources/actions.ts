'use server'

import { getCurrentUser } from '@/lib/auth'
import { getPortalSite } from '@/lib/portal/site'
import { getMyResourcePath } from '@/lib/portal/resources'
import { getMyDownload, getMyWorkbookCompanion } from '@/lib/portal/workbook'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const RESOURCES_BUCKET = 'site-resources'

// Mint a short-lived SIGNED DOWNLOAD URL for ONE resource — the ONLY way a client gets at a file.
// Security, layered:
//   1) the caller MUST be signed in (getCurrentUser);
//   2) the storage path comes ONLY from get_my_resource_path, a SECURITY-DEFINER RPC that re-checks
//      entitlement (free OR an ACTIVE member of the resource's tier) against the caller's VERIFIED
//      JWT email + the trusted portal slug — so a members-only file resolves to NO path for a
//      non-member (and a forged/foreign resourceId resolves to nothing too);
//   3) only THEN do we mint a service-role signed URL, valid for 60s.
// The bucket is PRIVATE, so the path alone is useless; the path + bucket are never returned to the
// client. Dormant-safe: with Storage / the service role unconfigured, or no entitlement, we return
// an {error} the UI surfaces gently — nothing throws.
export async function getResourceDownloadUrl(
  slug: string,
  resourceId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'Please sign in again.' }

  // Trust the server-resolved portal slug, not the passed one, for the entitlement check.
  const { slug: portalSlug } = await getPortalSite()
  const id = String(resourceId ?? '').trim()
  if (!id) return { ok: false, error: 'That resource is unavailable.' }

  // ENTITLEMENT GATE: a path comes back ONLY if the caller is entitled to this resource.
  const filePath = await getMyResourcePath(portalSlug, id)
  if (!filePath) return { ok: false, error: 'You don’t have access to that resource.' }

  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Downloads aren’t available right now.' }
  try {
    // Short-lived (60s) signed URL from the PRIVATE bucket — generated server-side only after the
    // entitlement check above passed.
    const { data, error } = await admin.storage.from(RESOURCES_BUCKET).createSignedUrl(filePath, 60)
    if (error || !data?.signedUrl) return { ok: false, error: 'Couldn’t prepare that download. Try again.' }
    return { ok: true, url: data.signedUrl }
  } catch {
    return { ok: false, error: 'Couldn’t prepare that download. Try again.' }
  }
}

// Mint a short-lived signed URL for a PRODUCT that is a downloadable file (ebook / PDF /
// meditation). Same layered gate as above, but entitlement comes from get_my_download_path
// (free / active member of its tier / bought). The path is returned ONLY when entitled.
export async function getProductDownloadUrl(
  productSlug: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'Please sign in again.' }
  const { slug: portalSlug } = await getPortalSite()
  const ps = String(productSlug ?? '').toLowerCase().trim()
  if (!/^[a-z0-9-]{1,60}$/.test(ps)) return { ok: false, error: 'That download is unavailable.' }

  const d = await getMyDownload(portalSlug, ps)
  if (!d) return { ok: false, error: 'You don’t have access to that download yet.' }

  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Downloads aren’t available right now.' }
  try {
    const { data, error } = await admin.storage.from(RESOURCES_BUCKET).createSignedUrl(d.filePath, 60, { download: d.fileName || true })
    if (error || !data?.signedUrl) return { ok: false, error: 'Couldn’t prepare that download. Try again.' }
    return { ok: true, url: data.signedUrl }
  } catch {
    return { ok: false, error: 'Couldn’t prepare that download. Try again.' }
  }
}

// Mint a short-lived signed URL for an interactive workbook's COMPANION file (the printable
// PDF a buyer also gets). Same layered gate: entitlement comes from get_my_workbook_companion,
// which returns a path ONLY when the caller owns the workbook. Never exposes bucket/path.
export async function getWorkbookCompanionUrl(
  workbookSlug: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'Please sign in again.' }
  const { slug: portalSlug } = await getPortalSite()
  const ws = String(workbookSlug ?? '').toLowerCase().trim()
  if (!/^[a-z0-9-]{1,60}$/.test(ws)) return { ok: false, error: 'That download is unavailable.' }

  const d = await getMyWorkbookCompanion(portalSlug, ws)
  if (!d) return { ok: false, error: 'You don’t have access to that download yet.' }

  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Downloads aren’t available right now.' }
  try {
    const { data, error } = await admin.storage.from(RESOURCES_BUCKET).createSignedUrl(d.filePath, 60, { download: d.fileName || true })
    if (error || !data?.signedUrl) return { ok: false, error: 'Couldn’t prepare that download. Try again.' }
    return { ok: true, url: data.signedUrl }
  } catch {
    return { ok: false, error: 'Couldn’t prepare that download. Try again.' }
  }
}
