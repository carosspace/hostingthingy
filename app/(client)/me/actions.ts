'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Sign a CLIENT out and return them to the portal login (/me), NOT the owner
// /login. Mirrors app/auth/signout's signOut() call but keeps clients in their
// own area.
export async function signOutClient() {
  const supabase = createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/me')
}
