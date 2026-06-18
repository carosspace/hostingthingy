import type { ReactNode } from 'react'

// Inline line/fill icons drawn with currentColor, so a canvas "icon" element takes on
// the colour you choose. Each value is the INNER svg markup; canvasIcon() wraps it in
// a 100%-sized <svg> so it scales with the element box. The social icons are the same
// shapes used by the published footer (lib/sites/socialIcons.tsx).
const ICON_INNER: Record<string, ReactNode> = {
  // — Social —
  instagram: (<><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.4" cy="6.6" r="0.6" fill="currentColor" stroke="none" /></>),
  facebook: (<path d="M15 3h-3a4 4 0 0 0-4 4v3H5v4h3v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />),
  youtube: (<><rect x="2.5" y="5" width="19" height="14" rx="4" /><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none" /></>),
  tiktok: (<><path d="M14 4v9.5a3.5 3.5 0 1 1-3-3.46" /><path d="M14 4a5 5 0 0 0 5 5" /></>),
  whatsapp: (<><path d="M3 21l1.6-4.2A8 8 0 1 1 8 19.4z" /><path d="M8.8 9.2c0 3 2.4 5.4 5.4 5.4l1-1.3-2.1-1-.8.8a4.2 4.2 0 0 1-2-2l.8-.8-1-2.1z" fill="currentColor" stroke="none" /></>),
  email: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 7l8.5 6 8.5-6" /></>),
  website: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>),
  // — General —
  heart: (<path d="M12 20S3.5 14.5 3.5 8.9A4.4 4.4 0 0 1 12 6.6a4.4 4.4 0 0 1 8.5 2.3C20.5 14.5 12 20 12 20z" fill="currentColor" stroke="none" />),
  star: (<path d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="currentColor" stroke="none" />),
  sparkle: (<path d="M12 3l1.7 5.1 5.1 1.7-5.1 1.7L12 16.6l-1.7-5.1L5.2 9.8l5.1-1.7z" fill="currentColor" stroke="none" />),
  check: (<path d="M5 12.5l4.5 4.5L19 7.5" />),
  plus: (<path d="M12 5v14M5 12h14" />),
  arrow: (<path d="M5 12h13M13 6l6 6-6 6" />),
  close: (<path d="M6 6l12 12M18 6L6 18" />),
  phone: (<path d="M5 4h3.2l1.4 4-2 1.4a11 11 0 0 0 5 5l1.4-2 4 1.4V19a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" fill="currentColor" stroke="none" />),
  pin: (<><path d="M12 21s7-5.6 7-11a7 7 0 0 0-14 0c0 5.4 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>),
  calendar: (<><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>),
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5" /></>),
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.1 5.1l1.8 1.8M17.1 17.1l1.8 1.8M18.9 5.1l-1.8 1.8M6.9 17.1l-1.8 1.8" /></>),
  moon: (<path d="M21 12.8A8.4 8.4 0 1 1 11.2 3 6.6 6.6 0 0 0 21 12.8z" fill="currentColor" stroke="none" />),
  leaf: (<><path d="M4.5 19.5s1.8-9 8.5-11.6c3.8-1.5 6.5-1 6.5-1s.5 2.7-1 6.5C16 19.5 7 21 4.5 19.5z" /><path d="M8.5 15.5c3-3 5-4 8.5-5" /></>),
  music: (<><path d="M9 17V5l9-1.8V14" /><circle cx="6.5" cy="17" r="2.6" /><circle cx="15.5" cy="15" r="2.6" /></>),
  camera: (<><rect x="3" y="7" width="18" height="13" rx="2.5" /><circle cx="12" cy="13.5" r="3.5" /><path d="M8.5 7l1.3-2h4.4l1.3 2" /></>),
  play: (<><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5.5 3.5L10 15.5z" fill="currentColor" stroke="none" /></>),
  link: (<path d="M9.5 14.5l5-5M8 12l-1.8 1.8a3.2 3.2 0 0 0 4.5 4.5L12.5 16M15.5 12l1.8-1.8a3.2 3.2 0 0 0-4.5-4.5L11 7.5" />),
  quote: (<path d="M9 7H6.5A1.5 1.5 0 0 0 5 8.5V11a1.5 1.5 0 0 0 1.5 1.5H8V14a2 2 0 0 1-2 2m11.5-9H15a1.5 1.5 0 0 0-1.5 1.5V11a1.5 1.5 0 0 0 1.5 1.5h1.5V14a2 2 0 0 1-2 2" />),
}

export const ICON_KINDS = Object.keys(ICON_INNER)

// Grouped for the picker.
export const ICON_GROUPS: { label: string; keys: string[] }[] = [
  { label: 'Social', keys: ['instagram', 'facebook', 'tiktok', 'youtube', 'whatsapp', 'email', 'website'] },
  { label: 'Icons', keys: ['heart', 'star', 'sparkle', 'check', 'plus', 'arrow', 'close', 'phone', 'pin', 'clock', 'calendar', 'search', 'sun', 'moon', 'leaf', 'music', 'camera', 'play', 'link', 'quote'] },
]

// Render an icon by key, sized to fill its box (so it scales with the canvas).
export function canvasIcon(kind?: string): ReactNode {
  const inner = kind ? ICON_INNER[kind] : undefined
  if (!inner) return null
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      {inner}
    </svg>
  )
}
