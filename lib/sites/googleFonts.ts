// On-demand Google Fonts. The owner can pick ANY family from this curated list for a
// text element / role / text style. Nothing here is bundled: the published page emits a
// single <link> for ONLY the families it uses, and the editor lazily injects a per-family
// stylesheet when a picker row scrolls into view or a google: font is actually applied.
//
// A fontFamily of the form `google:<Family>` references one of these names. The save gate
// whitelists the family against GOOGLE_FONT_NAMES, so no arbitrary string ever reaches the
// Google Fonts URL — only a known family does.
import type { PageCanvas, CanvasElement } from './types'

export type GoogleFontCat = 'serif' | 'sans' | 'display' | 'handwriting' | 'mono'

export interface GoogleFont {
  name: string
  cat: GoogleFontCat
}

// ~230 popular Google families across the five categories. Kept clean: each list is sorted
// by name; the whole array is grouped serif → sans → display → handwriting → mono.
const SERIF: string[] = [
  'Alegreya', 'Alegreya SC', 'Aleo', 'Arvo', 'Bitter', 'Bodoni Moda', 'Cardo', 'Caudex', 'Cinzel Decorative',
  'Cormorant', 'Cormorant Garamond', 'Cormorant Infant', 'Crimson Pro', 'Crimson Text', 'DM Serif Display',
  'DM Serif Text', 'Domine', 'EB Garamond', 'Eczar', 'Frank Ruhl Libre', 'Fraunces', 'Gelasio', 'Halant',
  'IBM Plex Serif', 'Inknut Antiqua', 'Instrument Serif', 'Libre Baskerville', 'Libre Caslon Text', 'Literata',
  'Lora', 'Marcellus', 'Marcellus SC', 'Merriweather', 'Neuton', 'Newsreader', 'Noto Serif', 'Old Standard TT',
  'Petrona', 'Playfair Display', 'PT Serif', 'Roboto Serif', 'Rosario', 'Sorts Mill Goudy', 'Source Serif 4',
  'Spectral', 'Tenor Sans', 'Tinos', 'Vollkorn', 'Yrsa', 'Zilla Slab', 'Gentium Book Plus', 'Brygada 1918',
  'Besley', 'Lustria',
]

const SANS: string[] = [
  'Albert Sans', 'Alata', 'Archivo', 'Archivo Narrow', 'Assistant', 'Barlow', 'Barlow Condensed',
  'Be Vietnam Pro', 'Cabin', 'Chivo', 'Commissioner', 'DM Sans', 'Dosis', 'Encode Sans', 'Epilogue',
  'Exo 2', 'Figtree', 'Fira Sans', 'Gantari', 'Geist', 'Hanken Grotesk', 'Heebo', 'IBM Plex Sans', 'Inter',
  'Inter Tight', 'Jost', 'Josefin Sans', 'Kanit', 'Karla', 'Kumbh Sans', 'Lato', 'Lexend', 'Lexend Deca',
  'Libre Franklin', 'Manrope', 'Maven Pro', 'Montserrat', 'Montserrat Alternates', 'Mukta', 'Mulish',
  'Nunito', 'Nunito Sans', 'Onest', 'Open Sans', 'Outfit', 'Overpass', 'Oxygen', 'Plus Jakarta Sans',
  'Poppins', 'Prompt', 'PT Sans', 'Public Sans', 'Quicksand', 'Raleway', 'Readex Pro', 'Red Hat Display',
  'Roboto', 'Roboto Condensed', 'Roboto Flex', 'Rubik', 'Schibsted Grotesk', 'Signika', 'Sora',
  'Source Sans 3', 'Space Grotesk', 'Spline Sans', 'Titillium Web', 'Ubuntu', 'Urbanist', 'Varela Round',
  'Work Sans', 'Saira', 'Sarabun', 'Yantramanav', 'Hind',
]

const DISPLAY: string[] = [
  'Abril Fatface', 'Alfa Slab One', 'Anton', 'Archivo Black', 'Bebas Neue', 'Big Shoulders Display',
  'Bricolage Grotesque', 'Bungee', 'Calistoga', 'Chango', 'Cinzel', 'Comfortaa', 'Cormorant SC',
  'Cormorant Upright', 'Della Respira', 'DM Serif Display SC', 'Faustina', 'Fjalla One', 'Forum',
  'Fredoka', 'Gilda Display', 'Italiana', 'Khand', 'Lobster', 'Lobster Two', 'Monoton', 'Oswald',
  'Pathway Gothic One', 'Paytone One', 'Philosopher', 'Playfair Display SC', 'Poiret One', 'Prata',
  'Rampart One', 'Righteous', 'Rozha One', 'Sancreek', 'Secular One', 'Staatliches', 'Syne', 'Teko',
  'Titan One', 'Ultra', 'Unbounded', 'Yeseva One',
]

const HANDWRITING: string[] = [
  'Allura', 'Amatic SC', 'Bad Script', 'Berkshire Swash', 'Caveat', 'Cedarville Cursive', 'Cookie',
  'Courgette', 'Damion', 'Dancing Script', 'Gloria Hallelujah', 'Great Vibes', 'Homemade Apple',
  'Indie Flower', 'Kalam', 'Kaushan Script', 'La Belle Aurore', 'Marck Script', 'Mr Dafoe',
  'Nanum Pen Script', 'Pacifico', 'Parisienne', 'Permanent Marker', 'Petit Formal Script', 'Pinyon Script',
  'Sacramento', 'Satisfy', 'Shadows Into Light', 'Tangerine', 'Yellowtail',
]

const MONO: string[] = [
  'Azeret Mono', 'Cousine', 'DM Mono', 'Fira Code', 'Fira Mono', 'Geist Mono', 'IBM Plex Mono',
  'Inconsolata', 'JetBrains Mono', 'Martian Mono', 'Nova Mono', 'Overpass Mono', 'PT Mono', 'Red Hat Mono',
  'Roboto Mono', 'Source Code Pro', 'Space Mono', 'Spline Sans Mono', 'Ubuntu Mono', 'Victor Mono',
]

const build = (names: string[], cat: GoogleFontCat): GoogleFont[] => names.map(name => ({ name, cat }))

// De-dupe across categories (a couple of names — e.g. Sacramento — legitimately appear in two
// curated lists); first wins, so the category stays the more useful one.
export const GOOGLE_FONTS: GoogleFont[] = (() => {
  const all = [
    ...build(SERIF, 'serif'),
    ...build(SANS, 'sans'),
    ...build(DISPLAY, 'display'),
    ...build(HANDWRITING, 'handwriting'),
    ...build(MONO, 'mono'),
  ]
  const seen = new Set<string>()
  return all.filter(f => (seen.has(f.name) ? false : (seen.add(f.name), true)))
})()

// O(1) validation set + lookup map (name → category).
export const GOOGLE_FONT_NAMES: Set<string> = new Set(GOOGLE_FONTS.map(f => f.name))
const CAT_BY_NAME: Map<string, GoogleFontCat> = new Map(GOOGLE_FONTS.map(f => [f.name, f.cat]))

export function isGoogleFamily(name: string): boolean {
  return GOOGLE_FONT_NAMES.has(name)
}

// The CSS generic that backstops each category while the web font loads / if it fails.
function genericFor(cat: GoogleFontCat | undefined): string {
  switch (cat) {
    case 'serif': return 'serif'
    case 'mono': return 'monospace'
    case 'handwriting': return 'cursive'
    case 'display': return 'sans-serif'
    default: return 'sans-serif'
  }
}

// A font-family stack for a (whitelisted) Google family: the quoted name + its category generic.
export function googleStack(name: string): string {
  return `'${name}', ${genericFor(CAT_BY_NAME.get(name))}`
}

// Encode a family for a CSS2 `family=` segment: spaces → '+', dropping anything that isn't a
// letter/number/+ so a name can never inject extra URL syntax (the names are already whitelisted,
// this is belt-and-braces).
function familyParam(name: string): string {
  return name.trim().replace(/\s+/g, '+').replace(/[^A-Za-z0-9+]/g, '')
}

// Build a Google Fonts CSS2 URL for a set of families. A couple of weights + italics each, with
// font-display:swap. Families are de-duped + sorted so the URL is stable (good for caching).
// Returns '' for an empty list (so callers can skip rendering a <link> entirely).
export function googleHref(families: string[]): string {
  const uniq = Array.from(new Set(families.filter(Boolean))).sort()
  if (!uniq.length) return ''
  const axes = ':ital,wght@0,400;0,600;0,700;1,400'
  const qs = uniq.map(n => `family=${familyParam(n)}${axes}`).join('&')
  return `https://fonts.googleapis.com/css2?${qs}&display=swap`
}

// Pull a `google:` prefix off a fontFamily value and return the family iff it's whitelisted.
function googleNameOf(ff: unknown): string | null {
  if (typeof ff !== 'string' || !ff.startsWith('google:')) return null
  const name = ff.slice(7)
  return isGoogleFamily(name) ? name : null
}

// Every whitelisted Google family a canvas actually uses: across element fontFamily (text /
// button / menu / form / link all carry it on the element) and the page's text styles.
// De-duped. Used to emit the published page's single <link> and to warm the editor preview.
export function usedGoogleFamilies(canvas: PageCanvas): string[] {
  const out = new Set<string>()
  const scan = (ff: unknown) => { const n = googleNameOf(ff); if (n) out.add(n) }
  const scanEls = (els: CanvasElement[] | undefined) => (els || []).forEach(e => scan(e.fontFamily))
  scanEls(canvas.elements)
  ;(canvas.components || []).forEach(c => scanEls(c.elements))
  if (canvas.textStyles) for (const k of Object.keys(canvas.textStyles)) scan(canvas.textStyles[k]?.fontFamily)
  // Site Look: the per-role override fonts + the default button/link fonts must load too,
  // or the published page won't match the look the owner chose.
  if (canvas.fontRoles) { scan(canvas.fontRoles.display); scan(canvas.fontRoles.body); scan(canvas.fontRoles.label) }
  scan(canvas.buttonStyle?.fontFamily)
  scan(canvas.linkStyle?.fontFamily)
  return Array.from(out)
}
