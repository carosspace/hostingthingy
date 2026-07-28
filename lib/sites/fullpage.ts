// Split a pasted full-page HTML design into the pieces needed to render it INLINE in the
// real page (rather than inside an iframe), so search engines can actually read the content.
//
// The iframe gave the design perfect CSS isolation, but everything inside a srcDoc iframe is
// invisible to crawlers — every page scored 0 indexable words. Rendering inline restores that,
// at the cost of having to defend the design from the platform's own global CSS (Tailwind
// preflight + the body utility classes in app/layout.tsx). That defence is what this file is.

export interface ParsedFullPage {
  css: string
  cssLinks: { rel: string; href: string; crossOrigin?: string }[]
  body: string
  scripts: { src?: string; code?: string }[]
}

const tag = (html: string, name: string): string[] => {
  const out: string[] = []
  const re = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) out.push(m[1])
  return out
}

const attr = (t: string, name: string): string | undefined => {
  const m = t.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'))
  return m ? (m[2] ?? m[3]) : undefined
}

// The height-reporter we used to inject for the iframe — meaningless once inline.
const isFrameReporter = (code: string) => code.includes('__fpH')

export function parseFullPage(html: string): ParsedFullPage {
  const css = tag(html, 'style').join('\n')

  const cssLinks: ParsedFullPage['cssLinks'] = []
  const linkRe = /<link\b[^>]*>/gi
  let lm: RegExpExecArray | null
  while ((lm = linkRe.exec(html))) {
    const t = lm[0]
    const rel = (attr(t, 'rel') || '').toLowerCase()
    const href = attr(t, 'href')
    if (!href || !/^https?:\/\//i.test(href)) continue
    if (rel !== 'stylesheet' && rel !== 'preconnect') continue
    cssLinks.push({ rel, href, crossOrigin: /\bcrossorigin\b/i.test(t) ? 'anonymous' : undefined })
  }

  const scripts: ParsedFullPage['scripts'] = []
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  let sm: RegExpExecArray | null
  while ((sm = scriptRe.exec(html))) {
    const src = attr(sm[1], 'src')
    const code = sm[2]
    if (src) scripts.push({ src })
    else if (code.trim() && !isFrameReporter(code)) scripts.push({ code })
  }

  // Body content only — <head> is handled above, and scripts are re-run client-side because
  // markup injected as innerHTML never executes on its own.
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
  let body = bodyMatch ? bodyMatch[1] : html.replace(/[\s\S]*?<\/head>/i, '')
  body = body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<base\b[^>]*>/gi, '')

  return { css, cssLinks, body, scripts }
}

// Remove at-rule blocks (@media, @supports…) so body rules are only read from the top level —
// a body rule inside a mobile media query must not be promoted to an unconditional override.
function stripAtBlocks(css: string): string {
  let out = ''
  for (let i = 0; i < css.length; i++) {
    if (css[i] !== '@') { out += css[i]; continue }
    const brace = css.indexOf('{', i)
    if (brace < 0) break
    let depth = 0
    let j = brace
    for (; j < css.length; j++) {
      if (css[j] === '{') depth++
      else if (css[j] === '}') { depth--; if (depth === 0) break }
    }
    i = j
  }
  return out
}

// The design was authored as a standalone document, so its `body { … }` rules ARE the page.
// Inline, the layout's Tailwind utilities (bg-background / text-parchment / font-body) beat a
// bare element selector, so re-emit the design's own body declarations as !important.
function bodyOverride(css: string): string {
  const decls: string[] = []
  // Flat CSS only (at-blocks already removed), and no `}` anchor — requiring one would
  // consume the separator and silently skip every second rule.
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g
  const flat = stripAtBlocks(css)
  let m: RegExpExecArray | null
  while ((m = ruleRe.exec(flat))) {
    const selectors = m[1].split(',').map((s: string) => s.trim().toLowerCase())
    if (!selectors.some((s: string) => s === 'body' || s === 'html body')) continue
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':')
      if (i < 0) continue
      const prop = d.slice(0, i).trim()
      const val = d.slice(i + 1).replace(/\s*!important\s*$/i, '').trim()
      if (prop && val) decls.push(`${prop}:${val} !important`)
    }
  }
  return decls.length ? `body{${decls.join(';')}}` : ''
}

// Tailwind's preflight zeroes heading sizes, paragraph margins, list styling and link colour.
// The design expects browser defaults for anything it doesn't set itself, so hand those back
// inside the design's own container.
//
// Specificity is the whole game here: `:where(#fp-root)` scopes the rules while contributing
// NOTHING, leaving each at plain element strength — the same as preflight, which this then
// beats on document order (injected after globals.css), while any class the design uses
// (.display-xl, .btn, .prose p …) still wins outright. Scoping with a bare `#fp-root` would
// give these ID strength and flatten the design's own typography.
const scope = (sels: string) => sels.split(',').map(s => `:where(#fp-root) ${s.trim()}`).join(',')
const RESET = [
  `${scope('h1,h2,h3,h4,h5,h6')}{font-size:revert;font-weight:revert;margin:revert}`,
  `${scope('p,blockquote,dl,dd,figure,pre,hr')}{margin:revert}`,
  `${scope('ul,ol')}{list-style:revert;margin:revert;padding:revert}`,
  `${scope('a')}{color:revert;text-decoration:revert}`,
  `${scope('img,svg,video')}{display:revert;vertical-align:revert}`,
  `${scope('button,input,select,textarea')}{font:revert;color:revert;background:revert;border:revert;margin:revert;padding:revert}`,
  `${scope('table')}{border-collapse:revert;text-indent:revert}`,
].join('\n')

// Designs bleed decorative glows and mandalas past the right edge and rely on the page
// clipping them. The iframe did that for free; inline, `body{overflow-x:hidden}` does not
// reliably propagate, leaving phones able to drag the page sideways. `clip` on the design's
// own container clips without becoming a scroll container, so the sticky headers still stick.
const CLIP = '#fp-root{overflow-x:clip}'

export function fullPageCss(parsed: ParsedFullPage): string {
  return `${RESET}\n${CLIP}\n${parsed.css}\n${bodyOverride(parsed.css)}`
}
