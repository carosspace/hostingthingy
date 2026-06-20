import { createSupabaseServerClient } from '@/lib/supabase/server'

export interface SiteMessage {
  id: string
  siteSlug: string | null
  name: string | null
  email: string | null
  body: string
  read: boolean
  // Who wrote this line. 'client' for visitor/client sends (the default, and the
  // value for any pre-013 row), 'owner' for the owner's replies.
  sender: 'client' | 'owner'
  createdAt: string
}

// Owner: every message across their sites (RLS limits the rows to the owner).
// Throws if the table isn't migrated yet, so the inbox can show a setup hint.
// GRACEFUL DEGRADE for migration 013: we select('*') and read `r.sender ?? 'client'`
// in JS, so the fetch works even before the `sender` column exists (every row is
// then treated as a client message — no owner bubbles yet, but no crash).
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
    sender: (r.sender === 'owner' ? 'owner' : 'client') as SiteMessage['sender'],
    createdAt: String(r.created_at),
  }))
}

// Owner: reply into a thread. The owner_id is the authed owner and the target email
// comes from the existing thread row (server-side) — never trusted from the client.
// The new row is read=true (the owner has, by definition, read their own reply) and
// sender='owner'. Returns false if the insert is rejected (e.g. migration 013 not
// applied → the `sender` column / owner-insert policy is missing), so the caller can
// fail softly instead of crashing the inbox.
export async function insertOwnerReply(args: {
  ownerId: string
  siteSlug: string | null
  name: string
  email: string
  body: string
}): Promise<boolean> {
  try {
    const supabase = createSupabaseServerClient()
    const { error } = await supabase.from('messages').insert({
      owner_id: args.ownerId,
      site_slug: args.siteSlug,
      name: args.name,
      email: args.email,
      body: args.body,
      read: true,
      sender: 'owner',
    })
    if (error) {
      console.error('[messages] owner reply insert failed (migration 013 applied?):', error.message)
      return false
    }
    return true
  } catch (e) {
    console.error('[messages] owner reply insert threw:', e)
    return false
  }
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

// Owner: mark a whole thread read/unread in one round-trip (RLS limits to the owner's
// rows). Used by the thread-grouped inbox so "Mark read" clears every unread line at
// once and the unread badge (count of read=false) drops by the right amount.
export async function setMessagesRead(ids: string[], read: boolean): Promise<void> {
  if (!ids.length) return
  const supabase = createSupabaseServerClient()
  await supabase.from('messages').update({ read }).in('id', ids)
}

// Owner: delete a whole thread (every message in it) in one round-trip.
export async function deleteMessages(ids: string[]): Promise<void> {
  if (!ids.length) return
  const supabase = createSupabaseServerClient()
  await supabase.from('messages').delete().in('id', ids)
}

// Public: a visitor submits a contact message. The SECURITY DEFINER RPC resolves the
// owner from the site slug server-side, so a visitor can't target anyone else or read.
export async function submitMessage(slug: string, name: string, email: string, body: string): Promise<boolean> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.rpc('submit_message', { p_slug: slug, p_name: name, p_email: email, p_body: body })
  return !error
}
