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

// Which live site (slug) currently owns a domain, if any — used to stop one site
// from claiming a domain another site already uses. Returns null if unclaimed.
export async function siteSlugForDomain(domain: string): Promise<string | null> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_site_by_domain', { p_host: domain })
  if (error || !data) return null
  const row = Array.isArray(data) ? data[0] : data
  return row?.slug ? String(row.slug) : null
}

// Like siteSlugForDomain but only resolves a domain on a LIVE site — what the middleware
// actually serves. Used by the TLS-check so we never authorize a certificate for (or leak the
// existence of) a claimed-but-unpublished domain that won't be routed.
export async function liveSiteSlugForDomain(domain: string): Promise<string | null> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_site_by_domain', { p_host: domain })
  if (error || !data) return null
  const row = Array.isArray(data) ? data[0] : data
  return row?.slug && row?.status === 'live' ? String(row.slug) : null
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
