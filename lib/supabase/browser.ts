import { createBrowserClient } from '@supabase/ssr'

// Client used in the browser (Client Components) for auth flows like sending a
// magic link. Uses the public anon key — never the service-role key.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
