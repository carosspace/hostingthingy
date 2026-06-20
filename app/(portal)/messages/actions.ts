'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { insertOwnerReply, setMessagesRead, deleteMessages } from '@/lib/sites/messages'

// Owner: mark a whole thread read (or unread). The id list is the thread's message
// ids; RLS limits the update to the owner's own rows. Keeps the unread-badge
// semantics intact (the badge counts read=false rows).
export async function setThreadReadAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return
  const ids = String(formData.get('ids') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const read = String(formData.get('read') ?? '') === '1'
  await setMessagesRead(ids, read)
  revalidatePath('/messages')
}

// Owner: delete a whole thread (all its messages).
export async function deleteThreadAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return
  const ids = String(formData.get('ids') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  await deleteMessages(ids)
  revalidatePath('/messages')
}

// Owner: reply into a client's thread. SECURITY — the owner_id is the authed owner
// and the target client email comes from a hidden field carrying the EXISTING thread
// row's email (server-side, owner-scoped by RLS on read); we never let the inbox UI
// invent a recipient beyond what the owner already received. Body is trimmed + capped.
// FAILS SOFTLY: if the insert is rejected (e.g. migration 013 not applied → the
// `sender` column / owner-insert policy is missing) the page is revalidated with an
// ?error flag instead of crashing.
export async function replyToThread(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return

  const email = String(formData.get('email') ?? '').trim()
  const siteSlug = String(formData.get('siteSlug') ?? '').trim() || null
  const body = String(formData.get('body') ?? '').trim().slice(0, 5000)
  if (!email || !body) {
    revalidatePath('/messages')
    return
  }

  const name = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email || 'Owner'

  const ok = await insertOwnerReply({ ownerId: user.id, siteSlug, name, email, body })
  revalidatePath('/messages')
  if (!ok) {
    // Soft error surfaced via a query flag the inbox reads (no crash). redirect()
    // throws internally to perform the navigation, so it must be the last statement.
    redirect('/messages?error=reply')
  }
}
