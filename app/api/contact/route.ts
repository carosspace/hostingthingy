export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { submitMessage } from '@/lib/sites/messages'

// PUBLIC contact endpoint for full-page-HTML site pages (which can't call a server action).
// A visitor's form POSTs { slug, name, email, message } here; we forward to the same
// SECURITY DEFINER submit_message RPC the canvas contact form uses (owner resolved from the
// slug server-side). CORS-open so a form on the custom domain (animatemple.com) can reach it
// on the platform host. Honeypot ("company") silently absorbs bots.
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
  // Honeypot: real people leave it empty; bots fill it. Pretend success, insert nothing.
  if (String(body.company ?? '').trim()) return NextResponse.json({ ok: true }, { headers: CORS })

  const slug = String(body.slug ?? '').trim()
  const name = String(body.name ?? '').trim().slice(0, 120) || '(no name)'
  const email = String(body.email ?? '').trim().slice(0, 200)
  const message = String(body.message ?? body.body ?? '').trim().slice(0, 5000)
  if (!slug || !email.includes('@') || !message) {
    return NextResponse.json({ ok: false, error: 'Please add your email and a message.' }, { status: 400, headers: CORS })
  }
  const ok = await submitMessage(slug, name, email, message)
  return NextResponse.json(ok ? { ok: true } : { ok: false, error: 'Could not send — please try again.' }, {
    status: ok ? 200 : 500,
    headers: CORS,
  })
}
