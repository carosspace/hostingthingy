// Turn a pasted media link into a SAFE iframe src — only known providers (YouTube,
// Vimeo, Google Maps), always rebuilt from a fixed host, never the raw pasted string.
// Shared by the block editor and the free-canvas 'embed' element.
export function embedSrc(url: string): string | null {
  const u = (url || '').trim()
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`
  try {
    const parsed = new URL(u)
    // Exact host allowlist — a regex like google.[a-z.]+ would also match
    // google.evil.com (a subdomain can't be distinguished from a country TLD).
    const MAPS_HOSTS = new Set(['google.com', 'www.google.com', 'maps.google.com'])
    if (parsed.protocol === 'https:' && MAPS_HOSTS.has(parsed.hostname.toLowerCase()) && parsed.pathname.startsWith('/maps')) {
      return parsed.href.includes('output=embed') ? parsed.href : parsed.href + (parsed.search ? '&' : '?') + 'output=embed'
    }
  } catch {
    // not a valid absolute URL
  }
  return null
}
