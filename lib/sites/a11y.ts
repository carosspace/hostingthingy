// Small, dependency-free WCAG contrast helpers. Used by the editor to gently
// warn when text may be hard to read. All math is client-safe (no services).

export interface RGB {
  r: number
  g: number
  b: number
}

// Parse #rgb or #rrggbb to RGB. Returns null for anything else (e.g. a CSS var).
export function parseHex(hex?: string): RGB | null {
  if (!hex) return null
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
}

// Resolve a stored canvas colour (hex OR var(--brand-N)) to a concrete hex.
export function resolveColor(c: string | undefined, palette: string[]): string | null {
  if (!c) return null
  const m = /^var\(--brand-([0-5])\)$/.exec(c.trim())
  if (m) return palette[Number(m[1])] ?? null
  return parseHex(c) ? c : null
}

function channel(v: number): number {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

export function relLuminance(rgb: RGB): number {
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}

// WCAG contrast ratio (1..21) between two hex colours, or null if either can't be parsed.
export function contrastRatio(fg?: string, bg?: string): number | null {
  const a = parseHex(fg)
  const b = parseHex(bg)
  if (!a || !b) return null
  const la = relLuminance(a)
  const lb = relLuminance(b)
  const ratio = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
  return Math.round(ratio * 100) / 100
}

export interface ContrastVerdict {
  ratio: number
  level: 'AAA' | 'AA' | 'low'
  ok: boolean
  label: string
}

// WCAG 2.1: large text (>=24px, or >=18.66px bold) passes AA at 3:1, AAA at 4.5:1;
// normal text needs 4.5:1 (AA) / 7:1 (AAA).
export function contrastVerdict(ratio: number, large: boolean): ContrastVerdict {
  const aa = large ? 3 : 4.5
  const aaa = large ? 4.5 : 7
  if (ratio >= aaa) return { ratio, level: 'AAA', ok: true, label: `Great contrast · ${ratio.toFixed(1)}:1` }
  if (ratio >= aa) return { ratio, level: 'AA', ok: true, label: `Readable · ${ratio.toFixed(1)}:1` }
  return { ratio, level: 'low', ok: false, label: `Low contrast · ${ratio.toFixed(1)}:1` }
}
