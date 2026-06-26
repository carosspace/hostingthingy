// Shared member-portal copy + token helpers. Used by BOTH the real portal home
// (app/(client)/me/page.tsx) and the in-editor live preview, so the two never drift.

export type ModuleKey = 'blueprint' | 'bookings' | 'messages' | 'courses' | 'memberships' | 'resources'

// The five "owned" tiles, in display order, with their built-in icon + copy.
// (Messages is a small always-there icon, not a big tile — handled separately.)
export const PORTAL_TILE_DEFAULTS: Record<
  'blueprint' | 'bookings' | 'courses' | 'memberships' | 'resources',
  { icon: string; title: string; desc: string }
> = {
  blueprint: { icon: '✦', title: 'Your Divine Blueprint', desc: 'Your reading, kept safe in one place.' },
  bookings: { icon: '◷', title: 'Bookings', desc: 'Your sessions — past and upcoming.' },
  courses: { icon: '❖', title: 'Courses', desc: 'Lessons and journeys to walk through.' },
  memberships: { icon: '♢', title: 'Memberships', desc: 'Your circle and what it unlocks.' },
  resources: { icon: '⤓', title: 'Resources', desc: 'Downloads to keep, from {brand}.' },
}

export const TILE_ORDER = ['blueprint', 'bookings', 'courses', 'memberships', 'resources'] as const

export const DEFAULT_WELCOME =
  "I'm so glad you found your way here. This is your sacred space — everything you've received from {brand}, kept gently in one place. Take your time. ✦"

export const DEFAULT_EMPTY =
  "Your space is ready. When you receive a reading, book a session, or join something from {brand}, it'll appear here for you."

// Fill {name}/{brand} tokens. When there's no name, drop "{name}" *and* a leading
// comma/space so a template like "Welcome, {name}." never reads "Welcome, .".
export function fillTokens(tpl: string, name: string, brand: string): string {
  let s = name ? tpl.replace(/\{name\}/g, name) : tpl.replace(/,?\s*\{name\}/g, '')
  s = s.replace(/\{brand\}/g, brand)
  return s.trim()
}
