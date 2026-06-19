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

export interface PublicSiteIndex {
  slug: string
  updatedAt: string | null
  pageSlugs: string[]
}

// Lists every live site + its page slugs (via the list_public_pages RPC, migration
// 008) for the sitemap. Returns [] if the function isn't migrated yet.
export async function listPublicPages(): Promise<PublicSiteIndex[]> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.rpc('list_public_pages')
  if (error || !data) return []
  return (data as Record<string, unknown>[]).map(r => ({
    slug: String(r.slug ?? ''),
    updatedAt: (r.updated_at as string) ?? null,
    pageSlugs: Array.isArray(r.page_slugs) ? (r.page_slugs as unknown[]).map(s => (s == null ? '' : String(s))) : [''],
  }))
}
