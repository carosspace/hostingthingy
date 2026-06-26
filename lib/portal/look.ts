import type { CSSProperties } from 'react'
import { pageBackground, type Gradient } from '@/lib/sites/types'
import { fontVars, fontRoleVars } from '@/lib/sites/fonts'
import { googleStack, isGoogleFamily } from '@/lib/sites/googleFonts'
import type { PortalSite } from './site'

// Resolve a Site Look role-override / element fontFamily to a CSS font value.
// IDENTICAL to CanvasView.tsx's `fontVar` (and PublicPage's lookFontVar) so the
// portal's role fonts resolve byte-for-byte the same as the published site.
export const fontVar = (f?: string): string =>
  f === 'body'
    ? 'var(--font-body)'
    : f === 'label'
      ? 'var(--font-label)'
      : f && f.startsWith('custom:')
        ? `'cvf-${f.slice(7)}', sans-serif`
        : f && f.startsWith('google:')
          ? googleStack(f.slice(7))
          : 'var(--font-display)'

// The brand palette → CSS custom properties (--brand-0, --brand-1, …), exactly
// like CanvasView.tsx builds `paletteVars` from canvas.palette.
function paletteVars(palette: string[] | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  ;(palette ?? []).forEach((c, i) => { out[`--brand-${i}`] = c })
  return out
}

// The look's BASE background colour, used ONLY to derive a legible global text
// colour (the portal paints one text colour over the whole page, unlike the
// per-element site canvas). Solid colour wins; else the gradient's first stop;
// else null (a background image or no background — fall back to the theme text).
function baseBgColor(src: PortalSite['lookSource']): string | null {
  if (!src) return null
  if (src.bgImage) return null
  let raw: string | null = null
  if (src.bg) raw = src.bg
  else {
    const g = src.bgGradient as Gradient | null | undefined
    if (g) {
      if (g.stops && g.stops.length) {
        const first = [...g.stops].sort((p, q) => p.at - q.at)[0]
        if (first?.color) raw = first.color
      }
      if (!raw && g.from) raw = g.from
    }
  }
  if (!raw) return null
  // pageBackground() fades the bg toward WHITE by (100 - bgOpacity)% (a white overlay), so derive
  // legibility from the FADED colour — otherwise a dark base at low opacity (a near-white page)
  // would wrongly pick light text and be invisible. Blend raw → #fff by (100 - bgOpacity)/100.
  const o = typeof src.bgOpacity === 'number' ? src.bgOpacity : 100
  if (o < 100) {
    const rgb = hexToRgb(raw)
    if (rgb) {
      const t = (100 - Math.max(0, Math.min(100, o))) / 100
      return `#${mix(rgb.r, 255, t)}${mix(rgb.g, 255, t)}${mix(rgb.b, 255, t)}`
    }
  }
  return raw
}

// Parse a #rgb / #rrggbb (and #rrggbbaa) hex colour to {r,g,b}, or null if it
// isn't a hex we can reason about (keeps the derivation conservative + crash-safe).
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(h)) {
    return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) }
  }
  if (/^[0-9a-fA-F]{6}$/.test(h) || /^[0-9a-fA-F]{8}$/.test(h)) {
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
  }
  return null
}

// Two channels as a 2-digit hex, mixed t of the way from a→b (0..1).
const mix = (a: number, b: number, t: number) =>
  Math.round(a + (b - a) * t).toString(16).padStart(2, '0')

// A readable text colour (near-black or near-white) for a given background hex,
// chosen by relative luminance so the portal chrome stays legible on ANY custom
// bg. Returns null when the colour can't be parsed (caller falls back to theme).
function readableText(hex: string): string | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  // Perceived luminance (sRGB-weighted). >0.55 → light bg → dark text; else light text.
  const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return lum > 0.55 ? '#1a1612' : '#faf7f2'
}

// The resolved global text + muted colours for the portal: legible on the look's
// real background when we can parse it, otherwise the theme's own text/muted.
// Muted is a SOLID 6-digit hex (the readable text blended ~35% toward the base
// bg) so it stays softer-but-legible AND can still take the `${muted}<alpha>`
// suffixes the portal pages append (an alpha-channel muted would break those).
export function portalTextColors(portal: PortalSite): { text: string; muted: string } {
  const base = baseBgColor(portal.lookSource)
  const text = base ? readableText(base) : null
  const baseRgb = base ? hexToRgb(base) : null
  if (!text || !baseRgb) return { text: portal.theme.text, muted: portal.theme.muted }
  const t = hexToRgb(text)!
  const muted = `#${mix(t.r, baseRgb.r, 0.35)}${mix(t.g, baseRgb.g, 0.35)}${mix(t.b, baseRgb.b, 0.35)}`
  return { text, muted }
}

// The portal root style — mirrors CanvasView's merge ORDER exactly so the portal
// wears the site's real look: theme bg/text as the legibility fallback BASE, then
// brand palette vars, then the font-system vars, then per-role font overrides
// (after fontVars so they win), then the real page background LAST (so a custom
// bg colour/gradient/image always wins over the theme bg). Crash-safe: every
// source can be null → it degrades to the plain theme palette + font system.
export function portalRootStyle(portal: PortalSite): CSSProperties {
  const { text } = portalTextColors(portal)
  const base: CSSProperties = { color: text, background: portal.theme.bg }
  return {
    ...base,
    ...paletteVars(portal.palette),
    ...fontVars(portal.fontSystem),
    ...fontRoleVars(portal.fontRoles ?? undefined, fontVar),
    ...pageBackground(portal.lookSource ?? {}),
  } as CSSProperties
}

// Every whitelisted Google family the portal's ROLE fonts reference (display /
// body / label). Reuses the same `google:`-prefix + whitelist parsing as
// usedGoogleFamilies, so the layout emits the right <link> for them. [] if none.
export function portalGoogleFamilies(portal: PortalSite): string[] {
  const roles = portal.fontRoles
  if (!roles) return []
  const out = new Set<string>()
  for (const ff of [roles.display, roles.body, roles.label]) {
    if (typeof ff === 'string' && ff.startsWith('google:')) {
      const name = ff.slice(7)
      if (isGoogleFamily(name)) out.add(name)
    }
  }
  return Array.from(out)
}
