import { createSupabaseServerClient } from '@/lib/supabase/server'

// A resource the signed-in client is entitled to (from get_my_resources). NOTE: there is NO
// file_path here — the storage path stays server-side; downloads go through getResourceDownloadUrl.
export interface MyResource {
  id: string
  title: string
  description: string | null
  fileName: string | null
  fileSize: number | null
  mime: string | null
  // null = free; a tier id = the client holds that tier (the RPC only returns entitled rows).
  tierId: string | null
}

// The portal owner's resources the signed-in client is ENTITLED to (free ones + any members-only
// ones whose tier they actively hold). The owner is resolved server-side from the trusted slug by
// the get_my_resources RPC — we never pass an owner id, and the RPC matches the client by their
// verified JWT email. The RPC OMITS file_path, so the path is never exposed here.
// GRACEFUL DEGRADE: any error (e.g. migration 022 not applied) returns [] + logs, so the page
// renders an empty list instead of crashing.
export async function getMyResources(slug: string): Promise<MyResource[]> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.rpc('get_my_resources', { p_site_slug: slug })
    if (error) {
      console.error('[client-portal] get_my_resources failed (migration 022 applied?):', error.message)
      return []
    }
    return (data ?? []).map(
      (r: {
        id: string
        title: string
        description: string | null
        file_name: string | null
        file_size: number | string | null
        mime: string | null
        tier_id: string | null
      }) => ({
        id: r.id,
        title: r.title,
        description: r.description ?? null,
        fileName: r.file_name ?? null,
        // file_size is bigint → may arrive as a string; coerce to a number (or null).
        fileSize: r.file_size == null ? null : Number(r.file_size) || 0,
        mime: r.mime ?? null,
        tierId: r.tier_id ?? null,
      }),
    )
  } catch (e) {
    console.error('[client-portal] get_my_resources threw:', e)
    return []
  }
}

// THE DOWNLOAD ENTITLEMENT GATE. Returns the storage path for ONE resource via the SECURITY DEFINER
// get_my_resource_path RPC, which re-checks entitlement (free OR an active member of its tier, AND
// the resource belongs to the slug's owner) against the caller's verified JWT email. A non-entitled
// client (or a forged/foreign resource id) resolves to NO row → null here → no signed URL is minted.
// Returns null on any error / no row / migration 022 not applied.
export async function getMyResourcePath(slug: string, resourceId: string): Promise<string | null> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.rpc('get_my_resource_path', {
      p_site_slug: slug,
      p_resource_id: resourceId,
    })
    if (error) {
      console.error('[client-portal] get_my_resource_path failed:', error.message)
      return null
    }
    const row = Array.isArray(data) ? data[0] : data
    return (row?.file_path as string | null) ?? null
  } catch (e) {
    console.error('[client-portal] get_my_resource_path threw:', e)
    return null
  }
}
