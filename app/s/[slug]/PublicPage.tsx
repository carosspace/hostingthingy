import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { THEMES, DEFAULT_THEME, type SiteContent, type SitePage, type SiteTheme, type CtaType, type Social, type SectionItem } from '@/lib/sites/types'
import { fontVars } from '@/lib/sites/fonts'
import Reveal from './Reveal'

// Only allow safe link schemes (or a same-origin relative path) — blocks javascript:, data:, etc.
function safeHref(href: string): string | null {
  const v = (href || '').trim()
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v
  if (/^\/(?!\/)/.test(v)) return v // same-origin relative path, but not //evil.com
  return null
}

// Turn a pasted media link into a safe iframe src — only known providers, rebuilt from
// a fixed host, never the raw pasted string.
function embedSrc(url: string): string | null {
  const u = (url || '').trim()
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`
  try {
    const parsed = new URL(u)
    if (parsed.protocol === 'https:' && /^((www|maps)\.)?google\.[a-z.]+$/.test(parsed.hostname) && parsed.pathname.startsWith('/maps')) {
      return parsed.href.includes('output=embed') ? parsed.href : parsed.href + (parsed.search ? '&' : '?') + 'output=embed'
    }
  } catch {
    // not a valid absolute URL
  }
  return null
}

const SOCIAL_LABEL: Record<Social['kind'], string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  email: 'Email',
  website: 'Website',
}
function socialHref(s: Social): string {
  if (s.kind === 'email') return s.url.startsWith('mailto:') ? s.url : `mailto:${s.url}`
  return /^https?:\/\//.test(s.url) ? s.url : `https://${s.url}`
}

export default function PublicPage({
  siteSlug,
  siteName,
  content,
  page,
  pages,
  currentSlug,
}: {
  siteSlug: string
  siteName: string
  content: SiteContent | null
  page: SitePage
  pages: SitePage[]
  currentSlug: string
}) {
  const theme = THEMES[(content?.theme as SiteTheme) ?? DEFAULT_THEME] ?? THEMES[DEFAULT_THEME]
  const accent = content?.accentColor || theme.accent
  const brand = content?.brand || siteName
  const contactEmail = content?.contactEmail ?? ''
  const footerText = content?.footer || brand
  const sections = page.sections ?? []
  const heroImage = page.heroImage
  const hasContent = Boolean(page.headline || page.subheadline || sections.length || heroImage)
  const hrefFor = (p: SitePage) => (p.slug === '' ? `/s/${siteSlug}` : `/s/${siteSlug}/${p.slug}`)

  const logo = content?.logoImage
  const visiblePages = pages.filter(p => !p.hidden)
  const navLinks = content?.navLinks ?? []
  const showNav = visiblePages.length > 1 || navLinks.length > 0

  const layout = content?.layout ?? 'contained'
  const bodyMax = layout === 'full' ? 'max-w-6xl' : 'max-w-2xl'

  // Resolve any call-to-action button (used by the hero and by each section).
  function makeCta(label?: string, type?: CtaType, href?: string) {
    const l = (label ?? '').trim()
    const ty = type ?? 'none'
    const h =
      ty === 'booking'
        ? `/book/${siteSlug}`
        : ty === 'email'
          ? contactEmail
            ? `mailto:${contactEmail}`
            : ''
          : ty === 'link'
            ? (safeHref((href ?? '').trim()) ?? '')
            : ''
    if (!l || !h) return null
    return (
      <a
        href={h}
        className="inline-block font-label"
        style={{ background: accent, color: theme.bg, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', padding: '13px 30px', borderRadius: 3 }}
      >
        {l}
      </a>
    )
  }
  const ctaButton = makeCta(page.ctaLabel, page.ctaType, page.ctaHref)

  // Render one block of a hand-composed header/footer bar (logo / text / link / line).
  const renderBarBlock = (it: SectionItem, key: number | string): ReactNode => {
    let el: ReactNode = null
    if (it.block === 'image') {
      const h = it.imgH && it.imgH > 0 ? it.imgH : 42
      el = it.image ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={it.image} alt="" style={{ height: h, maxWidth: 360, objectFit: 'contain', display: 'block' }} />
      ) : null
    } else if (it.block === 'heading' || it.block === 'subheading') {
      el = it.title ? (
        <span className="font-display italic" style={{ fontSize: it.block === 'subheading' ? 15 : 20, color: it.block === 'subheading' ? theme.text : accent }}>{it.title}</span>
      ) : null
    } else if (it.block === 'button') {
      el = makeCta(it.title, it.ctaType, it.href)
    } else if (it.block === 'divider') {
      el = <span aria-hidden style={{ display: 'inline-block', width: 1, height: 18, background: accent, opacity: 0.4 }} />
    } else {
      // text (the default block)
      const txt = it.body || it.title
      el = txt ? <span className="font-body whitespace-pre-wrap" style={{ fontSize: 13, color: theme.muted }}>{txt}</span> : null
    }
    if (!el) return null
    return <span key={key} className="inline-flex items-center">{el}</span>
  }
  // Pre-render a header/footer bar into three zones (left / centre / right) by each
  // block's col (0/1/2). Keep only blocks that actually produce something, so a bar
  // whose blocks all resolve to nothing falls back to the default header/footer.
  const barZones = (items: SectionItem[] | undefined) => {
    const arr = items ?? []
    const zones = [0, 1, 2].map(z =>
      arr
        .filter(it => (it.col === 1 || it.col === 2 ? it.col : 0) === z)
        .map((it, i) => renderBarBlock(it, `${z}-${i}`))
        .filter(Boolean),
    )
    return { zones, has: zones.some(z => z.length > 0) }
  }
  const headerBar = barZones(content?.headerItems)
  const footerBar = barZones(content?.footerItems)

  // Wrap a section in a scroll-reveal when the owner enabled it.
  const wrapSec = (key: number, reveal: boolean | undefined, el: ReactNode) =>
    reveal ? <Reveal key={key}>{el}</Reveal> : <Fragment key={key}>{el}</Fragment>

  // Menu position: a normal top bar, a sticky scrolling bar, or a left side column.
  const menuPos = content?.menuPosition ?? 'top'
  const headerCls =
    menuPos === 'scroll'
      ? 'sticky top-0 z-30 px-6 py-4 flex flex-col items-center gap-3'
      : menuPos === 'side'
        ? 'px-6 py-5 flex flex-col items-center gap-4 border-b md:border-b-0 md:border-r md:fixed md:left-0 md:top-0 md:h-screen md:w-52 md:items-start md:justify-center'
        : 'px-6 py-5 flex flex-col items-center gap-3'
  const headerStyle: CSSProperties =
    menuPos === 'scroll'
      ? { borderBottom: `1px solid ${accent}2e`, background: `${theme.bg}e6`, backdropFilter: 'blur(6px)' }
      : menuPos === 'side'
        ? { borderColor: `${accent}2e`, background: theme.bg } // bottom on mobile, right on desktop (see headerCls)
        : { borderBottom: `1px solid ${accent}2e` }
  const contentPad = menuPos === 'side' ? 'md:pl-52' : ''
  const navCls = `flex flex-wrap items-center justify-center gap-5 ${menuPos === 'side' ? 'md:flex-col md:items-start' : ''}`

  const rootStyle = { background: content?.pageBg || theme.bg, color: theme.text, ...fontVars(content?.fontSystem) } as unknown as CSSProperties

  return (
    <div className="min-h-screen flex flex-col" style={rootStyle}>
      <header className={headerCls} style={headerStyle}>
        {headerBar.has ? (
          menuPos === 'side' ? (
            <div className="flex flex-col gap-3 items-center md:items-start">{headerBar.zones.flat()}</div>
          ) : headerBar.zones[1].length > 0 || headerBar.zones[2].length > 0 ? (
            <div className="flex items-center w-full gap-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 flex-1 justify-start">{headerBar.zones[0]}</div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 flex-1 justify-center">{headerBar.zones[1]}</div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 flex-1 justify-end">{headerBar.zones[2]}</div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">{headerBar.zones.flat()}</div>
          )
        ) : (
          <a href={`/s/${siteSlug}`} className="inline-block">
            {logo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logo} alt={brand} style={{ height: 46, maxWidth: 220, objectFit: 'contain' }} />
            ) : (
              <span className="font-label" style={{ fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', color: accent }}>
                {brand}
              </span>
            )}
          </a>
        )}
        {showNav && (
          <nav className={navCls}>
            {visiblePages.map(p => (
              <a
                key={p.id}
                href={hrefFor(p)}
                className="font-label"
                style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: p.slug === currentSlug ? accent : theme.muted }}
              >
                {p.navLabel || p.title}
              </a>
            ))}
            {navLinks.map((l, i) => {
              const href = safeHref(l.href)
              return href ? (
                <a
                  key={`nl-${i}`}
                  href={href}
                  target={l.newTab ? '_blank' : undefined}
                  rel={l.newTab ? 'noreferrer' : undefined}
                  className="font-label"
                  style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: theme.muted }}
                >
                  {l.label}
                </a>
              ) : null
            })}
          </nav>
        )}
      </header>

      {hasContent ? (
        <main className={`flex-1 ${contentPad}`}>
          {heroImage ? (
            <section className="relative" style={{ height: '60vh', minHeight: 360 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${(typeof content?.heroOverlay === 'number' ? content.heroOverlay : 42) / 100})` }} />
              <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
                <h1 className="font-display text-5xl md:text-7xl italic" style={{ color: '#ffffff' }}>
                  {page.headline || page.title || siteName}
                </h1>
                {page.subheadline && (
                  <p className="font-body text-lg md:text-2xl mt-5" style={{ color: 'rgba(255,255,255,0.92)' }}>
                    {page.subheadline}
                  </p>
                )}
                {ctaButton && <div className="mt-8">{ctaButton}</div>}
              </div>
            </section>
          ) : (
            <section className="px-6 pt-24 pb-12 text-center max-w-3xl mx-auto">
              <h1 className="font-display text-5xl md:text-6xl italic" style={{ color: theme.text }}>
                {page.headline || page.title || siteName}
              </h1>
              {page.subheadline && (
                <p className="font-body text-lg md:text-xl mt-6" style={{ color: theme.muted }}>
                  {page.subheadline}
                </p>
              )}
              {ctaButton && <div className="mt-8">{ctaButton}</div>}
              <div className="mx-auto mt-10 h-px w-16" style={{ background: accent, opacity: 0.7 }} />
            </section>
          )}

          {sections.length > 0 && (
            <div className="pt-16 pb-16 space-y-16">
              {sections.map((sec, i) => {
                const secCta = makeCta(sec.ctaLabel, sec.ctaType, sec.ctaHref)
                if (sec.bgImage && (sec.kind ?? 'prose') === 'prose') {
                  return wrapSec(i, sec.reveal, (
                    <section className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sec.bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${(typeof sec.overlay === 'number' ? sec.overlay : 50) / 100})` }} />
                      <div className={`relative ${bodyMax} mx-auto px-6 py-20`} style={{ textAlign: sec.align || 'center' }}>
                        {sec.heading && (
                          <h2 className="font-display text-3xl md:text-4xl italic mb-3" style={{ color: '#ffffff' }}>
                            {sec.heading}
                          </h2>
                        )}
                        {sec.body && (
                          <p className="font-body leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.92)' }}>
                            {sec.body}
                          </p>
                        )}
                        {secCta && <div className="mt-6">{secCta}</div>}
                      </div>
                    </section>
                  ))
                }
                const headScale = sec.textScale === 'sm' ? 'text-2xl' : sec.textScale === 'lg' ? 'text-4xl md:text-5xl' : 'text-3xl'
                const bodyScale = sec.textScale === 'sm' ? 'text-sm' : sec.textScale === 'lg' ? 'text-lg md:text-xl' : 'text-base'
                const headingEl = sec.heading ? (
                  <h2 className={`font-display ${headScale} italic mb-3`} style={{ color: sec.textColor || accent }}>{sec.heading}</h2>
                ) : null
                const bodyEl = sec.body ? (
                  <p className={`font-body ${bodyScale} leading-relaxed whitespace-pre-wrap`} style={{ color: sec.textColor || theme.text, opacity: sec.textColor ? 1 : 0.85 }}>{sec.body}</p>
                ) : null
                const imageEl = sec.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={sec.image} alt="" className="w-full rounded-sm" style={{ maxHeight: sec.imageFit === 'contain' ? undefined : 420, objectFit: sec.imageFit || 'cover', display: 'block' }} />
                ) : null
                const ctaEl = secCta ? <div className="mt-6">{secCta}</div> : null
                const items = sec.items ?? []
                let inner
                if (sec.kind === 'layout') {
                  const cols = sec.columns || 1
                  const renderBlock = (it: (typeof items)[number], j: number) => {
                    let el: ReactNode = null
                    if (it.block === 'heading') el = it.title ? <h2 className="font-display text-2xl md:text-3xl italic" style={{ color: accent }}>{it.title}</h2> : null
                    else if (it.block === 'subheading') el = it.title ? <h3 className="font-display text-lg md:text-xl italic" style={{ color: theme.text }}>{it.title}</h3> : null
                    else if (it.block === 'image') el = it.image ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={it.image} alt="" className="w-full rounded-sm" style={{ objectFit: 'cover' }} />) : null
                    else if (it.block === 'button') el = makeCta(it.title, it.ctaType, it.href)
                    else if (it.block === 'divider') el = <div style={{ height: 1, background: accent, opacity: 0.35 }} />
                    else if (it.block === 'spacer') el = <div style={{ height: 32 }} />
                    else if (it.block === 'banner') el = (
                      <div className="relative rounded-sm overflow-hidden" style={{ minHeight: 200 }}>
                        {it.image && (/* eslint-disable-next-line @next/next/no-img-element */ <img src={it.image} alt="" className="absolute inset-0 w-full h-full object-cover" />)}
                        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} />
                        <div className="relative px-6 py-12 text-center">
                          {it.title && <h2 className="font-display text-3xl italic" style={{ color: '#ffffff' }}>{it.title}</h2>}
                          {it.body && <p className="font-body mt-2 whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.92)' }}>{it.body}</p>}
                        </div>
                      </div>
                    )
                    else el = it.body ? <p className="font-body leading-relaxed whitespace-pre-wrap" style={{ color: theme.text, opacity: 0.85 }}>{it.body}</p> : null
                    if (!el) return null
                    const boxed = it.boxColor || it.outline
                    return (
                      <div key={j} style={boxed ? { background: it.outline ? 'transparent' : it.boxColor, border: it.outline ? `1px solid ${accent}55` : undefined, borderRadius: 6, padding: 16 } : undefined}>
                        {el}
                      </div>
                    )
                  }
                  inner = (
                    <>
                      <div className={`flex flex-col gap-6 ${cols >= 2 ? 'md:flex-row md:items-start' : ''}`}>
                        {Array.from({ length: cols }).map((_, c) => (
                          <div key={c} className="flex-1 min-w-0 space-y-4">
                            {items.filter(it => Math.min(it.col ?? 0, cols - 1) === c).map((it, j) => renderBlock(it, j))}
                          </div>
                        ))}
                      </div>
                      {ctaEl}
                    </>
                  )
                } else if (sec.kind === 'cards') {
                  inner = (
                    <>
                      {headingEl}
                      {bodyEl}
                      {items.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
                          {items.map((it, j) => (
                            <div key={j} style={{ border: `1px solid ${accent}33`, borderRadius: 4, padding: 18 }}>
                              {it.image && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={it.image} alt="" className="w-full rounded-sm mb-3" style={{ height: 150, objectFit: 'cover' }} />
                              )}
                              {it.title && <h3 className="font-display text-xl italic mb-2" style={{ color: accent }}>{it.title}</h3>}
                              {it.body && <p className="font-body text-sm leading-relaxed whitespace-pre-wrap" style={{ color: theme.text, opacity: 0.8 }}>{it.body}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                      {ctaEl}
                    </>
                  )
                } else if (sec.kind === 'faq') {
                  const faqItems = items.filter(it => it.title)
                  inner = (
                    <>
                      {headingEl}
                      {bodyEl}
                      {faqItems.length > 0 && (
                        <div className="mt-8 space-y-3">
                          {faqItems.map((it, j) => (
                            <details key={j} style={{ borderBottom: `1px solid ${accent}22`, paddingBottom: 12 }}>
                              <summary className="font-display text-lg italic cursor-pointer" style={{ color: accent }}>{it.title}</summary>
                              {it.body && <p className="font-body text-sm leading-relaxed whitespace-pre-wrap mt-2" style={{ color: theme.text, opacity: 0.8 }}>{it.body}</p>}
                            </details>
                          ))}
                        </div>
                      )}
                      {ctaEl}
                    </>
                  )
                } else if (sec.kind === 'gallery') {
                  const photos = items.filter(it => it.image)
                  inner = (
                    <>
                      {headingEl}
                      {bodyEl}
                      {photos.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-8">
                          {photos.map((it, j) => (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img key={j} src={it.image} alt="" className="w-full rounded-sm" style={{ aspectRatio: '1 / 1', objectFit: 'cover' }} />
                          ))}
                        </div>
                      )}
                      {ctaEl}
                    </>
                  )
                } else if (sec.kind === 'embed') {
                  const src = sec.embedUrl ? embedSrc(sec.embedUrl) : null
                  inner = (
                    <>
                      {headingEl}
                      {bodyEl}
                      {src ? (
                        <div className="mt-6" style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 4 }}>
                          <iframe
                            src={src}
                            title="Embedded media"
                            loading="lazy"
                            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                            allow="fullscreen; encrypted-media; picture-in-picture"
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                          />
                        </div>
                      ) : safeHref(sec.embedUrl ?? '') ? (
                        <p className="mt-4"><a href={safeHref(sec.embedUrl ?? '') as string} target="_blank" rel="noreferrer" style={{ color: accent, textDecoration: 'underline' }}>{sec.embedUrl}</a></p>
                      ) : null}
                      {ctaEl}
                    </>
                  )
                } else if (imageEl && (sec.imageLayout === 'imageLeft' || sec.imageLayout === 'imageRight')) {
                  inner = (
                    <div className={`flex flex-col gap-8 md:items-center ${sec.imageLayout === 'imageRight' ? 'md:flex-row-reverse' : 'md:flex-row'}`}>
                      <div className="md:w-1/2 w-full">{imageEl}</div>
                      <div className="md:w-1/2 w-full">
                        {headingEl}
                        {bodyEl}
                        {ctaEl}
                      </div>
                    </div>
                  )
                } else {
                  const sizeCls = sec.imageSize === 'sm' ? 'max-w-xs' : sec.imageSize === 'md' ? 'max-w-md' : ''
                  const sizeAlign = sec.imageSize && sec.imageSize !== 'full' ? (sec.align === 'right' ? 'ml-auto' : sec.align === 'center' ? 'mx-auto' : '') : ''
                  inner = (
                    <>
                      {imageEl && <div className={`mb-5 ${sizeCls} ${sizeAlign}`}>{imageEl}</div>}
                      {headingEl}
                      {bodyEl}
                      {ctaEl}
                    </>
                  )
                }
                {
                  const boxed = Boolean(sec.bgColor) || Boolean(sec.borderColor && sec.borderWidth)
                  return wrapSec(i, sec.reveal, (
                    <section className={`${bodyMax} mx-auto px-6`}>
                      <div
                        className={boxed ? 'px-6 py-12 md:px-10 rounded-lg' : ''}
                        style={{
                          textAlign: sec.align || 'left',
                          background: sec.bgColor || undefined,
                          border: sec.borderColor && sec.borderWidth ? `${sec.borderWidth}px solid ${sec.borderColor}` : undefined,
                        }}
                      >
                        {inner}
                      </div>
                    </section>
                  ))
                }
              })}
            </div>
          )}

        </main>
      ) : (
        <main className={`flex-1 flex flex-col items-center justify-center px-6 text-center ${contentPad}`}>
          <h1 className="font-display text-5xl md:text-6xl italic" style={{ color: theme.text }}>
            {page.title || siteName}
          </h1>
          <p className="font-body text-lg mt-6" style={{ color: theme.muted }}>
            This page is taking shape.
          </p>
        </main>
      )}

      <footer className={`text-center py-10 ${contentPad}`} style={{ borderTop: `1px solid ${accent}1f` }}>
        {footerBar.has && (
          footerBar.zones[1].length > 0 || footerBar.zones[2].length > 0 ? (
            <div className="flex items-center w-full gap-3 px-6 mb-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 flex-1 justify-start">{footerBar.zones[0]}</div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 flex-1 justify-center">{footerBar.zones[1]}</div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 flex-1 justify-end">{footerBar.zones[2]}</div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mb-4 px-6">{footerBar.zones.flat()}</div>
          )
        )}
        {content?.socials && content.socials.length > 0 && (
          <nav className="flex flex-wrap items-center justify-center gap-5 mb-4">
            {content.socials.map((s, i) => {
              const href = safeHref(socialHref(s))
              return href ? (
                <a
                  key={i}
                  href={href}
                  target={s.kind === 'email' ? undefined : '_blank'}
                  rel="noreferrer"
                  className="font-label"
                  style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: accent }}
                >
                  {SOCIAL_LABEL[s.kind]}
                </a>
              ) : null
            })}
          </nav>
        )}
        {!footerBar.has && (
          <p className="font-body" style={{ fontSize: 13, color: theme.muted }}>
            {footerText}
          </p>
        )}
      </footer>
    </div>
  )
}
