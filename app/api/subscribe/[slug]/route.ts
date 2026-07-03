export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { subscribeNewsletter } from '@/lib/newsletter/repo'

// PUBLIC newsletter subscribe endpoint for the full-page-HTML site (whose popup can't call a
// server action). CORS-open so the form on the custom domain (animatemple.com) can reach it on
// the platform host. Honeypot ("company") silently absorbs bots. Owner is resolved from the slug
// inside the SECURITY DEFINER RPC, so a visitor can never target another owner.
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad request' }, { status: 400, headers: CORS })
  }
  if (String(body.company ?? '').trim()) return NextResponse.json({ ok: true }, { headers: CORS }) // honeypot

  const slug = String(body.slug ?? '').trim()
  const email = String(body.email ?? '').trim().slice(0, 200)
  if (!slug || !email.includes('@')) {
    return NextResponse.json({ ok: false, error: 'Please enter a valid email.' }, { status: 400, headers: CORS })
  }
  const ok = await subscribeNewsletter(slug, email)
  return NextResponse.json(ok ? { ok: true } : { ok: false, error: 'Could not subscribe, please try again.' }, {
    status: ok ? 200 : 500,
    headers: CORS,
  })
}
