import { createSupabaseServerClient } from '@/lib/supabase/server'

// Owner-side view of their single workbook: title, which tier gates it, whether
// HTML has been uploaded, and when. GRACEFUL: returns null if the table isn't
// migrated yet (so the admin page shows a clean empty state, not a crash). We
// avoid pulling the (large) html_content by checking its presence with a HEAD
// count instead of selecting the column.
export interface OwnerWorkbook {
  title: string
  tierId: string | null
  updatedAt: string | null
  hasContent: boolean
}

export async function getOwnerWorkbook(ownerId: string): Promise<OwnerWorkbook | null> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase
      .from('workbooks')
      .select('title, tier_id, updated_at')
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
      tierId: (data.tier_id as string | null) ?? null,
      updatedAt: (data.updated_at as string | null) ?? null,
      hasContent: (count ?? 0) > 0,
    }
  } catch {
    return null
  }
}
