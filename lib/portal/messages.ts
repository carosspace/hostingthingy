import { createSupabaseServerClient } from '@/lib/supabase/server'

// A single line in the signed-in client's thread with the portal owner.
// `sender` says who wrote it: 'client' (this person) or 'owner' (the brand).
export interface MyMessage {
  id: string
  sender: 'client' | 'owner'
  name: string
  body: string
  createdAt: string
}

// The signed-in client's full thread with the portal's owner (both directions),
// oldest first. Scoping to THIS client is enforced server-side by get_my_messages,
// which matches on the verified auth email from the JWT — we NEVER pass an email.
// GRACEFUL DEGRADE: if the RPC errors (e.g. migration 013 not applied), return []
// and log, so the portal page renders an empty thread instead of crashing.
export async function getMyMessages(slug: string): Promise<MyMessage[]> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.rpc('get_my_messages', { p_site_slug: slug })
    if (error) {
      console.error('[client-portal] get_my_messages failed (migration 013 applied?):', error.message)
      return []
    }
    return (data ?? []).map(
      (r: { id: string; sender: string | null; name: string | null; body: string | null; created_at: string }) => ({
        id: r.id,
        sender: (r.sender === 'owner' ? 'owner' : 'client') as MyMessage['sender'],
        name: r.name ?? '',
        body: r.body ?? '',
        createdAt: r.created_at,
      }),
    )
  } catch (e) {
    console.error('[client-portal] get_my_messages threw:', e)
    return []
  }
}

// The signed-in client posts a message into their thread with the owner. The RPC
// reads the verified email from the JWT and resolves the owner from the slug — we
// NEVER pass a client-supplied email. Returns 'ok' | 'error' (graceful, never throws).
export async function sendMyMessage(slug: string, body: string): Promise<'ok' | 'error'> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.rpc('send_my_message', { p_site_slug: slug, p_body: body })
    if (error) {
      console.error('[client-portal] send_my_message failed (migration 013 applied?):', error.message)
      return 'error'
    }
    return data === 'ok' ? 'ok' : 'error'
  } catch (e) {
    console.error('[client-portal] send_my_message threw:', e)
    return 'error'
  }
}
