import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

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

// ── Spam defence ──────────────────────────────────────────────────────────────
// The contact form is public and bots POST straight to the endpoint, skipping the
// on-page honeypot — so the real filtering has to live here, at the one insert path.
// Both guards below "absorb" a rejected message (pretend success, store nothing) so a
// bot can't tell it was blocked and keep probing.

// Heuristics tuned to the gibberish blasts actually seen (random 40–55-char tokens as
// name + body), with rules narrow enough that a real human message never matches.
export function looksLikeSpam(name: string, _email: string, body: string): boolean {
  const b = (body || '').trim()
  if (!b) return false
  const words = b.split(/\s+/).filter(Boolean)
  const longest = words.reduce((m, w) => Math.max(m, w.length), 0)

  // Random-token body: long, essentially no spaces, no sentence punctuation. A real
  // 20+ char message has more than two words and some punctuation; this does not.
  if (b.length >= 20 && words.length <= 2 && longest >= 20 && !/[.!?,;:'"]/.test(b)) return true

  // Any absurdly long unbroken token — no real word runs 40 characters.
  if (longest >= 40) return true

  // Link flood — genuine enquiries rarely carry three or more links; spam does.
  if (((b.match(/https?:\/\/|www\.|\[url|<a\s/gi) || []).length) >= 3) return true

  // A random-looking sender handle (mixed-case run like "IRddHMqThJ", or letters+digits)
  // paired with a short or tokenish body.
  const nameTok = (name || '').replace(/\s+/g, '')
  let caseFlips = 0
  for (let i = 1; i < nameTok.length; i++) {
    const p = nameTok[i - 1], c = nameTok[i]
    if (/[a-zA-Z]/.test(p) && /[a-zA-Z]/.test(c) && (p === p.toLowerCase()) !== (c === c.toLowerCase())) caseFlips++
  }
  const nameRandom = nameTok.length >= 8 && /^[A-Za-z0-9]+$/.test(nameTok) &&
    (caseFlips >= 4 || (/\d/.test(nameTok) && /[a-z]/i.test(nameTok)))
  if (nameRandom && (words.length <= 4 || longest >= 15)) return true

  return false
}

// Volume cap: at most a handful of visitor messages per site per hour. Catches a
// blast even from a bot clever enough to write real-looking words. Fails open (never
// blocks a genuine message) if the count can't be read.
const MAX_MESSAGES_PER_SITE_PER_HOUR = 5
async function overRateLimit(slug: string): Promise<boolean> {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) return false
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count, error } = await admin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('site_slug', slug)
      .neq('sender', 'owner')
      .gte('created_at', since)
    if (error) return false
    return (count ?? 0) >= MAX_MESSAGES_PER_SITE_PER_HOUR
  } catch {
    return false
  }
}

// Public: a visitor submits a contact message. The SECURITY DEFINER RPC resolves the
// owner from the site slug server-side, so a visitor can't target anyone else or read.
export async function submitMessage(slug: string, name: string, email: string, body: string): Promise<boolean> {
  // Silently absorb spam + floods: report success, insert nothing, so bots don't learn.
  if (looksLikeSpam(name, email, body)) return true
  if (await overRateLimit(slug)) return true

  const supabase = createSupabaseServerClient()
  const { error } = await supabase.rpc('submit_message', { p_slug: slug, p_name: name, p_email: email, p_body: body })
  return !error
}
