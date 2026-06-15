import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { SiteContent } from './types'

export interface PublicSite {
  name: string
  slug: string
  template: string
  content: SiteContent | null
}

// Fetches the public, safe view of a LIVE site by slug (via a SECURITY DEFINER
// RPC — see migration 003). Returns null if the site isn't live or doesn't exist.
export async function getPublicSite(slug: string): Promise<PublicSite | null> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_public_site', { p_slug: slug })
  if (error) return null
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return {
    name: row.name,
    slug: row.slug,
    template: row.template,
    content: (row.content ?? null) as SiteContent | null,
  }
}
