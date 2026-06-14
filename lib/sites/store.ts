import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Site, SiteStatus } from './types'

// Persistence for sites, backed by Supabase Postgres with Row-Level Security
// (a user only ever sees their own sites). Throws if Supabase isn't configured
// yet — callers degrade gracefully to a "connect your database" message.

interface SiteRow {
  id: string
  owner_id: string
  name: string
  slug: string
  template: string
  status: SiteStatus
  url: string | null
  created_at: string
  updated_at: string
}

function rowToSite(r: SiteRow): Site {
  return {
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    slug: r.slug,
    template: r.template,
    status: r.status,
    url: r.url,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export async function listSites(): Promise<Site[]> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as SiteRow[]).map(rowToSite)
}

export async function getSite(id: string): Promise<Site | null> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.from('sites').select('*').eq('id', id).single()
  if (error || !data) return null
  return rowToSite(data as SiteRow)
}

export async function createSiteRecord(
  ownerId: string,
  input: { name: string; slug: string; template: string; status: SiteStatus },
): Promise<Site> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('sites')
    .insert({
      owner_id: ownerId,
      name: input.name,
      slug: input.slug,
      template: input.template,
      status: input.status,
      url: null,
    })
    .select()
    .single()
  if (error) throw error
  return rowToSite(data as SiteRow)
}

export async function updateSiteStatus(
  id: string,
  status: SiteStatus,
  url: string | null,
): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('sites')
    .update({ status, url, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function renameSiteRecord(id: string, name: string, slug: string): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('sites')
    .update({ name, slug, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteSiteRecord(id: string): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('sites').delete().eq('id', id)
  if (error) throw error
}
