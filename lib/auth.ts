import { createSupabaseServerClient } from '@/lib/supabase/server'

// Returns the currently authenticated user, or null. Use this in the portal to
// guard pages and look up the signed-in person's data.
export async function getCurrentUser() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
