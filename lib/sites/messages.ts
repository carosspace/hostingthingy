import { createSupabaseServerClient } from '@/lib/supabase/server'

export interface SiteMessage {
  id: string
  siteSlug: string | null
  name: string | null
  email: string | null
  body: string
  read: boolean
  createdAt: string
}

// Owner: every message across their sites (RLS limits the rows to the owner).
// Throws if the table isn't migrated yet, so the inbox can show a setup hint.
export async function listMessages(): Promise<SiteMessage[]> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    siteSlug: (r.site_slug as string) ?? null,
    name: (r.name as string) ?? null,
    email: (r.email as string) ?? null,
    body: String(r.body ?? ''),
    read: !!r.read,
    createdAt: String(r.created_at),
  }))
}

export async function unreadMessageCount(): Promise<number> {
  const supabase = createSupabaseServerClient()
  const { count, error } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('read', false)
  return error ? 0 : count ?? 0
}

export async function setMessageRead(id: string, read: boolean): Promise<void> {
  const supabase = createSupabaseServerClient()
  await supabase.from('messages').update({ read }).eq('id', id)
}

export async function deleteMessageRecord(id: string): Promise<void> {
  const supabase = createSupabaseServerClient()
  await supabase.from('messages').delete().eq('id', id)
}

// Public: a visitor submits a contact message. The SECURITY DEFINER RPC resolves the
// owner from the site slug server-side, so a visitor can't target anyone else or read.
export async function submitMessage(slug: string, name: string, email: string, body: string): Promise<boolean> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.rpc('submit_message', { p_slug: slug, p_name: name, p_email: email, p_body: body })
  return !error
}
