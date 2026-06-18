// Per-site typography. Each system maps the three roles (display headings, body
// text, small labels) to font-family stacks built on the fonts loaded in the root
// layout. Applied by setting --font-display / --font-body / --font-label on the
// site wrapper, so existing font-display/font-body/font-label classes pick them up.
export interface FontSystem {
  key: string
  name: string
  display: string
  body: string
  label: string
}

export const FONT_SYSTEMS: FontSystem[] = [
  {
    key: 'serif',
    name: 'Timeless serif',
    display: 'var(--font-cormorant), Georgia, serif',
    body: 'var(--font-eb-garamond), Georgia, serif',
    label: 'var(--font-cinzel), serif',
  },
  {
    key: 'editorial',
    name: 'Elegant editorial',
    display: 'var(--font-playfair), Georgia, serif',
    body: 'var(--font-lora), Georgia, serif',
    label: 'var(--font-playfair), serif',
  },
  {
    key: 'modern',
    name: 'Modern clean',
    display: 'var(--font-inter), system-ui, sans-serif',
    body: 'var(--font-inter), system-ui, sans-serif',
    label: 'var(--font-inter), sans-serif',
  },
  {
    key: 'friendly',
    name: 'Friendly human',
    display: 'var(--font-fraunces), Georgia, serif',
    body: 'var(--font-inter), system-ui, sans-serif',
    label: 'var(--font-inter), sans-serif',
  },
  {
    key: 'creative',
    name: 'Creative contemporary',
    display: 'var(--font-montserrat), system-ui, sans-serif',
    body: 'var(--font-inter), system-ui, sans-serif',
    label: 'var(--font-montserrat), sans-serif',
  },
  {
    key: 'contrast',
    name: 'Classic contrast',
    display: 'var(--font-playfair), Georgia, serif',
    body: 'var(--font-eb-garamond), Georgia, serif',
    label: 'var(--font-cinzel), serif',
  },
  {
    key: 'soft',
    name: 'Soft & warm',
    display: 'var(--font-fraunces), Georgia, serif',
    body: 'var(--font-lora), Georgia, serif',
    label: 'var(--font-montserrat), sans-serif',
  },
  {
    key: 'grand',
    name: 'Grand & stately',
    display: 'var(--font-cinzel), serif',
    body: 'var(--font-cormorant), Georgia, serif',
    label: 'var(--font-cinzel), serif',
  },
  {
    key: 'fresh',
    name: 'Fresh & airy',
    display: 'var(--font-montserrat), system-ui, sans-serif',
    body: 'var(--font-lora), Georgia, serif',
    label: 'var(--font-montserrat), sans-serif',
  },
  {
    key: 'bold',
    name: 'Bold & expressive',
    display: 'var(--font-fraunces), Georgia, serif',
    body: 'var(--font-montserrat), system-ui, sans-serif',
    label: 'var(--font-montserrat), sans-serif',
  },
]

// All system keys (for validation / pickers).
export const FONT_SYSTEM_KEYS = FONT_SYSTEMS.map(f => f.key)

export const DEFAULT_FONT_SYSTEM = 'serif'

export function getFontSystem(key?: string | null): FontSystem {
  return FONT_SYSTEMS.find(f => f.key === key) ?? FONT_SYSTEMS[0]
}

// The CSS custom properties to drop on a site wrapper for a chosen system.
export function fontVars(key?: string | null): Record<string, string> {
  const f = getFontSystem(key)
  return { '--font-display': f.display, '--font-body': f.body, '--font-label': f.label }
}
