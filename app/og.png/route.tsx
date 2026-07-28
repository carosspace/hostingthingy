import { ImageResponse } from 'next/og'

// The share card behind og:image — what WhatsApp, Instagram, Pinterest and Facebook show
// when a link to the site is posted. Generated here rather than stored as a file so it stays
// in step with the brand, and cached for a day. Lives at /og.png because the custom-domain
// middleware treats any path with a file extension as reserved, so it reaches this route.
// ImageResponse renders through satori/resvg, which only runs in the edge runtime here.
export const runtime = 'edge'
export const revalidate = 86400

const BG = '#efe6d9'
const DARK = '#241a12'
const GOLD = '#9a6a3e'
const INK = '#3a281c'

// Cormorant Garamond, fetched at build/first-request. Google serves woff2 to modern clients
// and satori cannot parse woff2, so ask as an old browser to get a truetype file. Any failure
// just falls back to the built-in face — a plainer card, never a broken one.
async function displayFont(): Promise<ArrayBuffer | null> {
  try {
    // The v1 CSS endpoint still serves truetype to an old user-agent; v2 answers woff2,
    // which satori cannot parse ("Unsupported OpenType signature"). Require .ttf/.otf either
    // way, so a format change degrades to the built-in face instead of breaking the card.
    // The static truetype file straight from the Google Fonts repo, first — the CSS endpoints
    // increasingly answer woff2 only.
    try {
      const direct = await fetch(
        'https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/CormorantGaramond-MediumItalic.ttf',
        { signal: AbortSignal.timeout(4000) },
      )
      if (direct.ok) {
        const buf = await direct.arrayBuffer()
        if (buf.byteLength > 10_000) return buf
      }
    } catch { /* fall through to the CSS endpoints */ }

    const endpoints = [
      'https://fonts.googleapis.com/css?family=Cormorant+Garamond:500italic',
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,600&display=swap',
    ]
    for (const ep of endpoints) {
      const css = await fetch(ep, {
        headers: { 'User-Agent': 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)' },
        signal: AbortSignal.timeout(4000),
      }).then(r => r.text())
      const url = css.match(/url\((https:[^)]+\.(?:ttf|otf))\)/i)?.[1]
      if (url) return await fetch(url, { signal: AbortSignal.timeout(4000) }).then(r => r.arrayBuffer())
    }
    return null
  } catch {
    return null
  }
}

export async function GET() {
  let data: ArrayBuffer | null = null
  try { data = await displayFont() } catch { data = null }
  const display = data ? 'Cormorant' : 'serif'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: BG, position: 'relative',
        }}
      >
        {/* a quiet gold frame */}
        <div style={{ position: 'absolute', top: 28, left: 28, right: 28, bottom: 28, border: `1px solid ${GOLD}55`, display: 'flex' }} />
        {/* a small gold diamond — drawn, not typed, since the fallback face has no ✧ glyph */}
        <div
          style={{
            display: 'flex', width: 18, height: 18, marginBottom: 30,
            border: `1px solid ${GOLD}`, transform: 'rotate(45deg)',
          }}
        />
        <div
          style={{
            display: 'flex', fontFamily: display, fontStyle: 'italic', fontSize: 96,
            color: DARK, letterSpacing: -1, lineHeight: 1,
          }}
        >
          Anima Temple
        </div>
        <div style={{ display: 'flex', width: 90, height: 1, background: GOLD, margin: '34px 0' }} />
        <div style={{ display: 'flex', fontSize: 30, color: INK, opacity: 0.85 }}>
          A sanctuary for soulful living
        </div>
        <div
          style={{
            display: 'flex', marginTop: 26, fontSize: 17, color: GOLD,
            textTransform: 'uppercase', letterSpacing: 6,
          }}
        >
          Coaching · Energy Healing · Books
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: data ? [{ name: 'Cormorant', data, style: 'italic', weight: 600 }] : undefined,
    },
  )
}
