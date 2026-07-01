import { createSupabaseServerClient } from '@/lib/supabase/server'

// The signed-in client's view of the portal workbook: its title, whether content
// exists, and whether THEY are entitled to open it. The owner is resolved
// server-side from the trusted slug by the RPC; the caller is matched by their
// verified JWT email. GRACEFUL: any error (e.g. migration 023 not applied) returns
// null so the page renders a gentle message instead of crashing.
export interface MyWorkbook {
  title: string
  hasContent: boolean
  entitled: boolean
}

export async function getMyWorkbook(slug: string): Promise<MyWorkbook | null> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.rpc('get_my_workbook', { p_site_slug: slug })
    if (error) {
      console.error('[workbook] get_my_workbook failed (migration 023 applied?):', error.message)
      return null
    }
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return null
    return {
      title: String(row.title ?? 'Workbook'),
      hasContent: !!row.has_content,
      entitled: !!row.entitled,
    }
  } catch (e) {
    console.error('[workbook] get_my_workbook threw:', e)
    return null
  }
}

// The gated HTML for the workbook — returned by the RPC ONLY when the caller is
// entitled, else null. Used by the /api/client/workbook route to stream the page.
export async function getMyWorkbookHtml(slug: string): Promise<string | null> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.rpc('get_my_workbook_html', { p_site_slug: slug })
    if (error) {
      console.error('[workbook] get_my_workbook_html failed:', error.message)
      return null
    }
    return typeof data === 'string' && data.length > 0 ? data : null
  } catch (e) {
    console.error('[workbook] get_my_workbook_html threw:', e)
    return null
  }
}
