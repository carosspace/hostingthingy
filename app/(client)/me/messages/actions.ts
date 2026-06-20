'use server'

import { revalidatePath } from 'next/cache'
import { getPortalSite } from '@/lib/portal/site'
import { sendMyMessage } from '@/lib/portal/messages'

// The signed-in client posts a message into their thread with the portal owner.
// The owner + the client's email are resolved server-side by the send_my_message
// RPC (from the trusted slug + the verified JWT email) — we never trust the caller
// for either. An empty body is ignored. Then refresh the thread.
export async function sendMessage(formData: FormData) {
  const body = String(formData.get('body') ?? '').trim()
  if (body) {
    const { slug } = await getPortalSite()
    await sendMyMessage(slug, body)
  }
  revalidatePath('/me/messages')
}
