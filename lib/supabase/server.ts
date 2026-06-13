import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Auth-aware Supabase client for Server Components, Route Handlers and Server
// Actions. It reads/writes the session from cookies, so it acts AS the logged-in
// user (subject to Row-Level Security). This is distinct from lib/supabase.ts,
// which is the privileged service-role client used for admin/system work.
export function createSupabaseServerClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // setAll was called from a Server Component, where cookies are
            // read-only. Safe to ignore — the middleware refreshes the session.
          }
        },
      },
    },
  )
}
