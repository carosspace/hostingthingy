import { createSupabaseServerClient } from '@/lib/supabase/server'

export interface Subscriber {
  email: string
  createdAt: string
  source: string | null
}

// Owner-side: their newsletter subscribers, newest first. GRACEFUL: [] if the table
// isn't migrated yet (so the portal page can show a friendly "run the migration" note).
export async function listSubscribers(): Promise<Subscriber[]> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .select('email, created_at, source')
      .order('created_at', { ascending: false })
      .limit(5000)
    if (error) throw error
    return (data ?? []).map(r => ({
      email: String(r.email),
      createdAt: String(r.created_at),
      source: (r.source as string | null) ?? null,
    }))
  } catch (e) {
    // Distinguish "not migrated" (surfaced as an error the page handles) from an empty list is
    // hard here; rethrow so the page can show the migration hint on a genuine failure.
    throw e
  }
}

// Public: subscribe by site slug via the SECURITY DEFINER RPC (owner resolved server-side).
// Returns true only on 'ok'. Never throws.
export async function subscribeNewsletter(slug: string, email: string): Promise<boolean> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.rpc('subscribe_newsletter', { p_slug: slug, p_email: email })
    return !error && data === 'ok'
  } catch {
    return false
  }
}
