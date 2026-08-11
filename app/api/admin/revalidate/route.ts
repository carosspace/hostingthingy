export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { PUBLIC_SITE_TAG } from '@/lib/sites/public'

// TEMP (active site build): drop the public-site cache after a direct-to-DB content edit
// (the maintenance scripts write straight to Supabase, so they can't call revalidateTag in
// process). Token-gated, same as /api/admin/set-pages. Remove when the site is finalised.
const TOKEN = 'diag-7h3k9x2p'

export async function POST(req: NextRequest) {
  if (req.headers.get('Authorization') !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  revalidateTag(PUBLIC_SITE_TAG)
  return NextResponse.json({ ok: true, revalidated: PUBLIC_SITE_TAG })
}
