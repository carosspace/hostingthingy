import { createSupabaseServerClient } from '@/lib/supabase/server'

// Owner-side view of their single workbook: title, whether HTML has been uploaded,
// and when. GRACEFUL: returns null if the table isn't migrated yet. We avoid
// pulling the (large) html_content by checking its presence with a HEAD count.
export interface OwnerWorkbook {
  title: string
  updatedAt: string | null
  hasContent: boolean
}

export async function getOwnerWorkbook(ownerId: string): Promise<OwnerWorkbook | null> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase
      .from('workbooks')
      .select('title, updated_at')
      .eq('owner_id', ownerId)
      .maybeSingle()
    if (error || !data) return null
    const { count } = await supabase
      .from('workbooks')
      .select('owner_id', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .not('html_content', 'is', null)
    return {
      title: String(data.title ?? 'Workbook'),
      updatedAt: (data.updated_at as string | null) ?? null,
      hasContent: (count ?? 0) > 0,
    }
  } catch {
    return null
  }
}

// The owner's unlock codes (newest first). GRACEFUL: [] if not migrated.
export interface RedeemCode {
  id: string
  code: string
  redeemedBy: string | null
  redeemedAt: string | null
}

export async function listCodes(ownerId: string): Promise<RedeemCode[]> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase
      .from('redeem_codes')
      .select('id, code, redeemed_by_email, redeemed_at')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error || !data) return []
    return data.map(r => ({
      id: String(r.id),
      code: String(r.code),
      redeemedBy: (r.redeemed_by_email as string | null) ?? null,
      redeemedAt: (r.redeemed_at as string | null) ?? null,
    }))
  } catch {
    return []
  }
}
