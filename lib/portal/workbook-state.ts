import { createSupabaseServerClient } from '@/lib/supabase/server'

// What a member has written inside an interactive workbook, stored per (member, workbook).
// Shape is a flat map of the localStorage keys the workbook itself writes — we never
// interpret it, we just carry it between their devices.
export type WorkbookState = Record<string, string>

// GRACEFUL: null on any error (e.g. migration 029 not applied) so the workbook still opens
// and keeps working from local storage — never a crash, never a blank page.
export async function getWorkbookState(userId: string, slug: string): Promise<WorkbookState | null> {
  try {
    const sb = createSupabaseServerClient()
    const { data, error } = await sb
      .from('workbook_state')
      .select('data')
      .eq('user_id', userId)
      .eq('slug', slug)
      .maybeSingle()
    if (error) {
      const c = (error as { code?: string }).code
      if (c !== '42P01' && c !== 'PGRST205') console.error('[workbook-state] read failed:', error.message)
      return null
    }
    const d = (data as { data?: unknown } | null)?.data
    if (!d || typeof d !== 'object' || Array.isArray(d)) return null
    // Keep only string→string pairs (that's all localStorage can hold anyway).
    const out: WorkbookState = {}
    for (const [k, v] of Object.entries(d as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v
    }
    return out
  } catch (e) {
    console.error('[workbook-state] read threw:', e)
    return null
  }
}
