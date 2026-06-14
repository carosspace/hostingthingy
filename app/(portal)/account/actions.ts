'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Saves a display name onto the logged-in user (stored in Supabase Auth's user
// metadata — no extra table needed).
export async function updateNameAction(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim()
  const supabase = createSupabaseServerClient()
  await supabase.auth.updateUser({ data: { full_name: name } })
  revalidatePath('/account')
  revalidatePath('/dashboard')
}
