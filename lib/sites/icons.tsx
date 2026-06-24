import type { ReactNode } from 'react'

// Inline line/fill icons drawn with currentColor, so a canvas "icon" element takes on
// the colour you choose. Each value is the INNER svg markup; canvasIcon() wraps it in
// a 100%-sized <svg> so it scales with the element box. The social icons are the same
// shapes used by the published footer (lib/sites/socialIcons.tsx).
//
// Convention for every entry: drawn on a 0 0 24 24 viewBox, fill:none, stroke=currentColor,
// round caps/joins (the wrapper sets these). Use explicit JSX children (<path>/<circle>/
// <line>/<rect>) — never dangerouslySetInnerHTML. Feather/Lucide line-icon weight.
const ICON_INNER: Record<string, ReactNode> = {
  // — Social —
  instagram: (<><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.4" cy="6.6" r="0.6" fill="currentColor" stroke="none" /></>),
  facebook: (<path d="M15 3h-3a4 4 0 0 0-4 4v3H5v4h3v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />),
  youtube: (<><rect x="2.5" y="5" width="19" height="14" rx="4" /><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none" /></>),
  tiktok: (<><path d="M14 4v9.5a3.5 3.5 0 1 1-3-3.46" /><path d="M14 4a5 5 0 0 0 5 5" /></>),
  whatsapp: (<><path d="M3 21l1.6-4.2A8 8 0 1 1 8 19.4z" /><path d="M8.8 9.2c0 3 2.4 5.4 5.4 5.4l1-1.3-2.1-1-.8.8a4.2 4.2 0 0 1-2-2l.8-.8-1-2.1z" fill="currentColor" stroke="none" /></>),
  linkedin: (<><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M7 10v7M7 7v.01M11 17v-4a2 2 0 0 1 4 0v4M11 17v-7" /></>),
  twitter: (<path d="M4 4l7 9.2M4 20l6.3-6.8M20 4l-7 7.6M20 20l-6.7-8.4M4 4h2.6L20 20h-2.6L4 4z" fill="currentColor" stroke="none" />),
  pinterest: (<><circle cx="12" cy="12" r="9" /><path d="M9.5 20l2-7.5M9.5 9.5a2.5 2.5 0 1 1 4.6 1.3c-.6 1.4-2.3 2.2-3.4 1.3" /></>),
  threads: (<><circle cx="12" cy="12" r="9" /><path d="M9 9.5a3 3 0 0 1 5.4-.3c.6 1 .6 2.5.6 3.3 0 2-1.4 3.5-3.2 3.5-1.3 0-2.3-.8-2.3-1.9 0-1 .9-1.7 2.1-1.7 1.9 0 3.1 1.4 3.1 3.3" /></>),
  email: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 7l8.5 6 8.5-6" /></>),
  website: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>),
  send: (<path d="M21 3L10.5 13.5M21 3l-6.5 18-4-8-8-4z" />),
  'message-circle': (<path d="M21 11.5a8 8 0 0 1-11.5 7.2L4 20.5l1.8-5.3A8 8 0 1 1 21 11.5z" />),
  globe: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>),

  // — General / UI —
  heart: (<path d="M12 20S3.5 14.5 3.5 8.9A4.4 4.4 0 0 1 12 6.6a4.4 4.4 0 0 1 8.5 2.3C20.5 14.5 12 20 12 20z" fill="currentColor" stroke="none" />),
  'hand-heart': (<><path d="M11.5 7.5a2.3 2.3 0 0 1 3.6 2.7C14.4 11.7 11.5 13.5 11.5 13.5S8.6 11.7 7.9 10.2a2.3 2.3 0 0 1 3.6-2.7z" /><path d="M3 13l3-1 4 3.5h3a1.3 1.3 0 0 0 0-2.6H9M3 13v6h3l1.5 1H15l5-4-1.3-1.3" /></>),
  star: (<path d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="currentColor" stroke="none" />),
  sparkle: (<path d="M12 3l1.7 5.1 5.1 1.7-5.1 1.7L12 16.6l-1.7-5.1L5.2 9.8l5.1-1.7z" fill="currentColor" stroke="none" />),
  check: (<path d="M5 12.5l4.5 4.5L19 7.5" />),
  'check-circle': (<><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></>),
  plus: (<path d="M12 5v14M5 12h14" />),
  'plus-circle': (<><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>),
  close: (<path d="M6 6l12 12M18 6L6 18" />),
  'x-circle': (<><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></>),
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.01" /></>),
  'alert-circle': (<><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16v.01" /></>),
  arrow: (<path d="M5 12h13M13 6l6 6-6 6" />),
  'chevron-up': (<path d="M6 15l6-6 6 6" />),
  'chevron-down': (<path d="M6 9l6 6 6-6" />),
  'chevron-left': (<path d="M15 6l-6 6 6 6" />),
  'chevron-right': (<path d="M9 6l6 6-6 6" />),
  menu: (<path d="M4 7h16M4 12h16M4 17h16" />),
  grid: (<><rect x="3.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.2" /></>),
  layers: (<path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 16.5l9 5 9-5" />),
  home: (<><path d="M4 11l8-7 8 7" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></>),
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" /></>),
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5" /></>),
  bell: (<><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" /><path d="M10 20a2 2 0 0 0 4 0" /></>),
  eye: (<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>),
  lock: (<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  unlock: (<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 7.7-2" /></>),
  shield: (<><path d="M12 3l7 3v5c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></>),
  download: (<path d="M12 4v11M7 11l5 5 5-5M5 20h14" />),
  upload: (<path d="M12 20V9M7 13l5-5 5 5M5 4h14" />),
  flag: (<path d="M5 21V4M5 4h11l-2 3.5L16 11H5" />),
  bookmark: (<path d="M7 4h10v16l-5-3.5L7 20z" />),
  link: (<path d="M9.5 14.5l5-5M8 12l-1.8 1.8a3.2 3.2 0 0 0 4.5 4.5L12.5 16M15.5 12l1.8-1.8a3.2 3.2 0 0 0-4.5-4.5L11 7.5" />),
  quote: (<path d="M9 7H6.5A1.5 1.5 0 0 0 5 8.5V11a1.5 1.5 0 0 0 1.5 1.5H8V14a2 2 0 0 1-2 2m11.5-9H15a1.5 1.5 0 0 0-1.5 1.5V11a1.5 1.5 0 0 0 1.5 1.5h1.5V14a2 2 0 0 1-2 2" />),
  infinity: (<path d="M7 9a3 3 0 1 0 0 6c2 0 3-1.5 5-3s3-3 5-3a3 3 0 1 1 0 6c-2 0-3-1.5-5-3s-3-3-5-3z" />),
  users: (<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1M17 14.4a5.5 5.5 0 0 1 3.5 5.1" /></>),
  award: (<><circle cx="12" cy="9" r="5" /><path d="M9 13.5L7.5 21l4.5-2.5L16.5 21 15 13.5" /></>),
  target: (<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></>),
  compass: (<><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>),
  anchor: (<><circle cx="12" cy="5.5" r="2" /><path d="M12 7.5V21M5 13a7 7 0 0 0 14 0M5 13H3M19 13h2M9 11H7M17 11h-2" /></>),
  gift: (<><rect x="4" y="9" width="16" height="11" rx="1.5" /><path d="M4 13h16M12 9v11M8.5 9a2.5 2.5 0 1 1 2.5-2.5C11 8 12 9 12 9s1-1 1-2.5A2.5 2.5 0 1 1 15.5 9" /></>),
  tag: (<><path d="M4 4h7l9 9-7 7-9-9z" /><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" /></>),
  'shopping-bag': (<><path d="M5 8h14l-1 12H6z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>),
  'credit-card': (<><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3 9.5h18M7 14.5h3" /></>),
  book: (<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19a2 2 0 0 1 2-2h13" />),
  pen: (<path d="M16 3.5l4.5 4.5L8 20.5 3.5 21 4 16.5z" />),
  scissors: (<><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="6.5" cy="17.5" r="2.5" /><path d="M8.7 8.2L20 18M8.7 15.8L20 6M11 12l3 2.3" /></>),
  palette: (<><path d="M12 3a9 9 0 0 0 0 18c1.4 0 2-1 2-2 0-1.4 1-2 2-2h1.5A3.5 3.5 0 0 0 21 11.5C21 6.8 17 3 12 3z" /><circle cx="8" cy="11" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="11" r="1" fill="currentColor" stroke="none" /></>),
  brush: (<path d="M16 3.5l4.5 4.5-7 7-3-3zM9.5 12L7 14.5a3.5 3.5 0 0 0-2 3.5c-.1 1.4-1 1.8-1.5 2 1 .9 2.4 1.2 3.7.8A3.5 3.5 0 0 0 9.5 17z" />),
  wand: (<path d="M5 19l9-9M16 5l.6 1.7L18.3 7l-1.7.6L16 9.3l-.6-1.7L13.7 7l1.7-.4zM19 11l.4 1.1 1.1.4-1.1.4L19 14l-.4-1.1L17.5 12.5l1.1-.4z" />),

  // — Nature / Wellness —
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.1 5.1l1.8 1.8M17.1 17.1l1.8 1.8M18.9 5.1l-1.8 1.8M6.9 17.1l-1.8 1.8" /></>),
  sunrise: (<><path d="M12 3v5M5.6 8.6l1.4 1.4M17 10l1.4-1.4M3 14h3M18 14h3M8 14a4 4 0 0 1 8 0M9 8.5L12 5.5l3 3M2 18h20M5 21h14" /></>),
  moon: (<path d="M21 12.8A8.4 8.4 0 1 1 11.2 3 6.6 6.6 0 0 0 21 12.8z" fill="currentColor" stroke="none" />),
  cloud: (<path d="M7 18a4 4 0 0 1-.5-8 5 5 0 0 1 9.6-1A3.5 3.5 0 0 1 17.5 18z" />),
  wind: (<path d="M3 9h11a2.5 2.5 0 1 0-2.5-2.5M3 14h14a2.5 2.5 0 1 1-2.5 2.5M3 19h7a2 2 0 1 0-2-2" />),
  snowflake: (<path d="M12 3v18M3 12h18M5.5 5.5l13 13M18.5 5.5l-13 13M12 6l-2.2-2M12 6l2.2-2M12 18l-2.2 2M12 18l2.2 2M6 12l-2 2M6 12l-2-2M18 12l2 2M18 12l2-2" />),
  droplet: (<path d="M12 3.5C8 8 5.5 11 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 11 16 8 12 3.5z" />),
  waves: (<path d="M2 7c2 0 2 1.6 4 1.6S8 7 10 7s2 1.6 4 1.6S16 7 18 7s2 1.6 4 1.6M2 12.5c2 0 2 1.6 4 1.6s2-1.6 4-1.6 2 1.6 4 1.6 2-1.6 4-1.6 2 1.6 4 1.6M2 18c2 0 2 1.6 4 1.6s2-1.6 4-1.6 2 1.6 4 1.6 2-1.6 4-1.6 2 1.6 4 1.6" />),
  mountain: (<path d="M3 19l6-10 3.5 5.5L15 11l6 8zM9 9l1-1.5" />),
  flame: (<path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c1 1.5 2 2.7 2 4.5A4.5 4.5 0 0 1 7.5 14.5C7.5 9.5 12 8 12 3z" />),
  leaf: (<><path d="M4.5 19.5s1.8-9 8.5-11.6c3.8-1.5 6.5-1 6.5-1s.5 2.7-1 6.5C16 19.5 7 21 4.5 19.5z" /><path d="M8.5 15.5c3-3 5-4 8.5-5" /></>),
  feather: (<path d="M20 4a7 7 0 0 0-9.9 0l-6 6L4 20l4-2 6-6a7 7 0 0 0 0-8zM4 20l7-7M9 9l6 6" />),
  flower: (<><circle cx="12" cy="12" r="2.6" /><path d="M12 9.4C12 6 13.5 4 13.5 4S15 6 15 8.6a3 3 0 0 1-3 3M14.6 12c3.4 0 5.4-1.5 5.4-1.5S18 9 15.4 9M12 14.6c0 3.4 1.5 5.4 1.5 5.4S15 18 15 15.4M9.4 12C6 12 4 13.5 4 13.5S6 15 8.6 15M12 9.4C12 6 10.5 4 10.5 4S9 6 9 8.6M9.4 12c-3.4 0-5.4-1.5-5.4-1.5" /></>),
  mic: (<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" /></>),
  activity: (<path d="M3 12h4l2.5-7 5 14L17 12h4" />),
  'trending-up': (<path d="M3 16l5-5 4 4 7-7M16 8h5v5" />),
  zap: (<path d="M13 3L5 13h5l-1 8 8-10h-5z" />),
  coffee: (<><path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" /><path d="M17 9h2a2.5 2.5 0 0 1 0 5h-2M7 3.5c.6 1-.6 1.6 0 2.5M11 3.5c.6 1-.6 1.6 0 2.5M4 21h13" /></>),
  smile: (<><circle cx="12" cy="12" r="9" /><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5v.01M15 9.5v.01" /></>),

  // — Media / contact —
  music: (<><path d="M9 17V5l9-1.8V14" /><circle cx="6.5" cy="17" r="2.6" /><circle cx="15.5" cy="15" r="2.6" /></>),
  headphones: (<><path d="M4 13a8 8 0 0 1 16 0" /><rect x="3" y="13" width="4" height="7" rx="1.6" /><rect x="17" y="13" width="4" height="7" rx="1.6" /></>),
  film: (<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" /></>),
  camera: (<><rect x="3" y="7" width="18" height="13" rx="2.5" /><circle cx="12" cy="13.5" r="3.5" /><path d="M8.5 7l1.3-2h4.4l1.3 2" /></>),
  play: (<><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5.5 3.5L10 15.5z" fill="currentColor" stroke="none" /></>),
  phone: (<path d="M5 4h3.2l1.4 4-2 1.4a11 11 0 0 0 5 5l1.4-2 4 1.4V19a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" fill="currentColor" stroke="none" />),
  pin: (<><path d="M12 21s7-5.6 7-11a7 7 0 0 0-14 0c0 5.4 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>),
  map: (<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14" />),
  navigation: (<path d="M12 3l8 18-8-4-8 4z" />),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>),
  calendar: (<><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>),
}

export const ICON_KINDS = Object.keys(ICON_INNER)

// Grouped for the picker. Every ICON_KIND appears in exactly one group below — a small
// dev guard at the end keeps that true so nothing becomes unreachable in the gallery.
export const ICON_GROUPS: { label: string; keys: string[] }[] = [
  { label: 'Social', keys: ['instagram', 'facebook', 'tiktok', 'youtube', 'whatsapp', 'linkedin', 'twitter', 'pinterest', 'threads', 'email', 'website', 'send', 'message-circle', 'globe'] },
  { label: 'Wellness', keys: ['heart', 'hand-heart', 'flower', 'leaf', 'feather', 'flame', 'droplet', 'smile', 'coffee', 'mic', 'activity', 'trending-up', 'zap', 'award', 'sparkle', 'infinity'] },
  { label: 'Nature', keys: ['sun', 'sunrise', 'moon', 'cloud', 'wind', 'snowflake', 'waves', 'mountain', 'star'] },
  { label: 'UI', keys: ['check', 'check-circle', 'plus', 'plus-circle', 'close', 'x-circle', 'info', 'alert-circle', 'menu', 'grid', 'layers', 'home', 'settings', 'search', 'bell', 'eye', 'lock', 'unlock', 'shield', 'download', 'upload', 'flag', 'bookmark', 'link', 'quote', 'users', 'target', 'compass', 'anchor'] },
  { label: 'Arrows', keys: ['arrow', 'chevron-up', 'chevron-down', 'chevron-left', 'chevron-right', 'navigation'] },
  { label: 'Commerce', keys: ['gift', 'tag', 'shopping-bag', 'credit-card', 'book', 'pen', 'scissors', 'palette', 'brush', 'wand'] },
  { label: 'Media', keys: ['music', 'headphones', 'film', 'camera', 'play', 'phone', 'pin', 'map', 'clock', 'calendar'] },
]

// Dev-only guard: every icon must be reachable in some group (and no group lists a
// missing/duplicate key). Throws loudly in development so a new icon can't silently
// drop out of the gallery; stripped from production builds.
if (process.env.NODE_ENV !== 'production') {
  const grouped = ICON_GROUPS.flatMap(g => g.keys)
  const seen = new Set<string>()
  for (const k of grouped) {
    if (!ICON_INNER[k]) throw new Error(`ICON_GROUPS references unknown icon: ${k}`)
    if (seen.has(k)) throw new Error(`ICON_GROUPS lists a duplicate icon: ${k}`)
    seen.add(k)
  }
  for (const k of ICON_KINDS) {
    if (!seen.has(k)) throw new Error(`Icon "${k}" is not in any ICON_GROUPS group`)
  }
}

// Render an icon by key, sized to fill its box (so it scales with the canvas). An
// optional strokeW overrides the default line weight (1.8) — used by the icon element's
// "Line weight" control; absent ⇒ unchanged from before.
export function canvasIcon(kind?: string, strokeW?: number): ReactNode {
  const inner = kind ? ICON_INNER[kind] : undefined
  if (!inner) return null
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" fill="none" stroke="currentColor" strokeWidth={strokeW ?? 1.8} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      {inner}
    </svg>
  )
}
