'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { PORTAL_SITE_SLUG } from '@/lib/portal/site'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type RedeemResult = 'ok' | 'already' | 'invalid' | 'error'

// Redeem an unlock code for the signed-in member. The RPC matches them by their
// verified JWT email + grants workbook access; returns a plain status string.
export async function redeemCodeAction(code: string): Promise<RedeemResult> {
  const user = await getCurrentUser()
  if (!user) return 'error'
  const trimmed = String(code ?? '').trim()
  if (!trimmed) return 'invalid'
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.rpc('redeem_code', {
      p_site_slug: PORTAL_SITE_SLUG,
      p_code: trimmed,
    })
    if (error) {
      console.error('[workbook] redeem_code failed (migration 023 applied?):', error.message)
      return 'error'
    }
    const result = (Array.isArray(data) ? data[0] : data) as string
    if (result === 'ok') {
      revalidatePath('/me/workbook')
      revalidatePath('/me')
    }
    return (['ok', 'already', 'invalid', 'error'].includes(result) ? result : 'error') as RedeemResult
  } catch (e) {
    console.error('[workbook] redeem_code threw:', e)
    return 'error'
  }
}
