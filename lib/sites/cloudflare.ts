// Cloudflare for SaaS (Custom Hostnames) client — gives a customer's OWN domain
// HTTPS at Cloudflare's edge, keyless from the platform's side. Uses a NARROW
// zone-scoped token (SSL+Certificates: Edit, Zone: Read) held server-side only.
//
// Everything is fail-safe: if it's not configured (no token/zone env), or Cloudflare
// is unreachable, the functions no-op and return null — they must never throw into a
// server action or block saving a domain. Stays fully dormant until the env is set.

const API = 'https://api.cloudflare.com/client/v4'

export function cfConfigured(): boolean {
  return !!(process.env.CF_SAAS_API_TOKEN && process.env.CF_SAAS_ZONE_ID)
}

// The proxied hostname in our Cloudflare zone that customers point their domain at
// (CNAME their-domain.com -> this). Configurable; finalised when the fallback origin is set up.
export function cfCnameTarget(): string {
  return process.env.CF_SAAS_CNAME_TARGET || 'cname.animatemple.com'
}

function cfHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${process.env.CF_SAAS_API_TOKEN}`, 'Content-Type': 'application/json' }
}

// The platform's own Cloudflare zone — these are served directly by Traefik and must
// NEVER go through Cloudflare for SaaS. Single source of truth (used by the action + UI).
export function isOwnZone(domain: string): boolean {
  const d = domain.toLowerCase()
  return d === 'animatemple.com' || d.endsWith('.animatemple.com')
}

export interface CfHostname {
  id: string
  hostname: string
  status: string // 'pending' | 'active' | 'pending_deletion' | ...  (hostname/ownership status)
  sslStatus: string // 'pending_validation' | 'active' | 'pending_issuance' | ...
}

function parseHostname(row: unknown): CfHostname | null {
  const r = row as { id?: unknown; hostname?: unknown; status?: unknown; ssl?: { status?: unknown } }
  if (!r || !r.id) return null
  return {
    id: String(r.id),
    hostname: String(r.hostname ?? ''),
    status: String(r.status ?? ''),
    sslStatus: String(r.ssl?.status ?? ''),
  }
}

// Look up a custom hostname by domain. null if none / not configured / unreachable.
export async function cfGetHostname(hostname: string): Promise<CfHostname | null> {
  if (!cfConfigured()) return null
  const zone = process.env.CF_SAAS_ZONE_ID
  try {
    const res = await fetch(`${API}/zones/${zone}/custom_hostnames?hostname=${encodeURIComponent(hostname)}`, {
      headers: cfHeaders(),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const j = (await res.json()) as { result?: unknown[] }
    return parseHostname(Array.isArray(j.result) ? j.result[0] : null)
  } catch {
    return null
  }
}

// Register a custom hostname for HTTPS (HTTP DV). Idempotent: returns the existing one
// if already registered. Cloudflare issues the cert once the customer's CNAME resolves.
export async function cfCreateHostname(hostname: string): Promise<CfHostname | null> {
  if (!cfConfigured()) return null
  const existing = await cfGetHostname(hostname)
  if (existing) return existing
  const zone = process.env.CF_SAAS_ZONE_ID
  try {
    const res = await fetch(`${API}/zones/${zone}/custom_hostnames`, {
      method: 'POST',
      headers: cfHeaders(),
      body: JSON.stringify({ hostname, ssl: { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } } }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      // Surface the failure reason server-side for diagnosis (the token is never logged).
      try {
        console.error('[cf] create custom hostname failed', res.status, (await res.text()).slice(0, 500))
      } catch {
        /* ignore */
      }
      return null
    }
    const j = (await res.json()) as { result?: unknown }
    return parseHostname(j.result)
  } catch {
    return null
  }
}

// Remove a custom hostname (when a site clears or changes its domain).
export async function cfDeleteHostname(hostname: string): Promise<void> {
  if (!cfConfigured()) return
  const zone = process.env.CF_SAAS_ZONE_ID
  try {
    const h = await cfGetHostname(hostname)
    if (!h) return
    await fetch(`${API}/zones/${zone}/custom_hostnames/${h.id}`, {
      method: 'DELETE',
      headers: cfHeaders(),
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    // best-effort cleanup
  }
}
