import { type CSSProperties, type ReactNode } from 'react'
import { CANVAS_W, MOBILE_W, gradientCss, filterCss, shadowCss, shapePath, type PageCanvas, type CanvasElement } from './types'
import CanvasMotion from './CanvasMotion'
import CanvasLightbox from './CanvasLightbox'
import Carousel from './Carousel'

// Wrap an element's content so it can reveal on scroll and react to hover. Reveal
// sits on the outer wrapper, hover on an inner one, so their transforms never fight
// (and neither fights the positioned element's own rotate/blend).
function withMotion(el: CanvasElement, child: ReactNode): ReactNode {
  if (child == null) return child
  let node = child
  if (el.hover) node = <div className={`canvas-hover canvas-hover-${el.hover}`} style={{ width: '100%', height: '100%' }}>{node}</div>
  if (el.reveal) node = <div data-reveal={el.reveal} data-reveal-delay={el.revealDelay || undefined} style={{ width: '100%', height: '100%' }}>{node}</div>
  if (el.parallax) node = <div data-parallax={el.parallax} style={{ width: '100%', height: '100%', willChange: 'transform' }}>{node}</div>
  return node
}

const fontVar = (f?: string) => (f === 'body' ? 'var(--font-body)' : f === 'label' ? 'var(--font-label)' : 'var(--font-display)')
// A design-pixel value as a container-query-width unit (scales the canvas with the viewport).
const cq = (px: number) => `${(px / CANVAS_W) * 100}cqw`
const cqm = (px: number) => `${(px / MOBILE_W) * 100}cqw`
// Shrink-to-phone ratio for elements that have no explicit phone coords yet
// (must match CanvasEditor's MR so the editor and the published page agree).
const MR = MOBILE_W / CANVAS_W

type ViewProps = {
  canvas: PageCanvas
  accent: string
  siteSlug: string
  contactEmail: string
  safeHref: (h: string) => string | null
  navPages: { slug: string; label: string }[]
}

// Read-only renderer for a free-canvas page. Desktop: a faithful absolutely-positioned
// canvas that scales with the viewport. Phones: a hand-arranged phone artboard when the
// page opted into a custom mobile layout, otherwise the elements stack top-to-bottom.
export function CanvasView({ canvas, accent, siteSlug, contactEmail, safeHref, navPages }: ViewProps) {
  const pageHref = (slug: string) => (slug === '' ? `/s/${siteSlug}` : `/s/${siteSlug}/${slug}`)
  const ctaHref = (el: CanvasElement): string => {
    if (el.ctaType === 'booking') return `/book/${siteSlug}`
    if (el.ctaType === 'email') return contactEmail ? `mailto:${contactEmail}` : ''
    return safeHref((el.href ?? '').trim()) ?? ''
  }
  const paletteVars: CSSProperties = {}
  ;(canvas.palette ?? []).forEach((c, i) => { (paletteVars as Record<string, string>)[`--brand-${i}`] = c })
  const bg: CSSProperties = {
    ...paletteVars,
    background: canvas.bgImage ? undefined : gradientCss(canvas.bgGradient) || canvas.bg || undefined,
    backgroundImage: canvas.bgImage ? `url('${canvas.bgImage}')` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }

  // The absolute renderer for one element, parameterised by the cq scale (desktop vs phone artboard).
  const inner = (el: CanvasElement, cqf: (px: number) => string) => {
    if (el.type === 'image')
      return el.src ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={el.src} alt="" loading="lazy" decoding="async" data-lightbox={el.lightbox ? el.src : undefined} style={{ width: '100%', height: '100%', objectFit: el.fit || 'cover', borderRadius: cqf(el.radius || 0), display: 'block', filter: filterCss(el.adjust), boxShadow: shadowCss(el.shadow), cursor: el.lightbox ? 'zoom-in' : undefined }} />
      ) : null
    if (el.type === 'carousel')
      return el.slides && el.slides.length ? <Carousel slides={el.slides} fit={el.fit} radiusCss={cqf(el.radius || 0)} interval={el.interval} /> : null
    if (el.type === 'shape')
      return (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
          <path d={shapePath(el.shape)} style={{ fill: el.fill || accent }} />
        </svg>
      )
    if (el.type === 'box')
      return <div style={{ width: '100%', height: '100%', background: gradientCss(el.gradient) || el.fill || 'transparent', borderRadius: cqf(el.radius || 0), border: el.borderColor && el.borderWidth ? `${cqf(el.borderWidth)} solid ${el.borderColor}` : undefined, boxShadow: shadowCss(el.shadow) }} />
    if (el.type === 'menu')
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: cqf(26), justifyContent: el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start', overflow: 'hidden' }}>
          {navPages.map(p => (
            <a key={p.slug} href={pageHref(p.slug)} style={{ fontFamily: fontVar(el.fontFamily || 'label'), fontSize: cqf(el.fontSize || 18), color: el.color || accent, textTransform: 'uppercase', letterSpacing: cqf(2) }}>{p.label}</a>
          ))}
        </div>
      )
    const isBtn = el.type === 'button'
    const content = (
      <div
        className={el.dropCap && !isBtn ? 'dbp-dropcap' : undefined}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isBtn ? 'center' : el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start',
          fontFamily: fontVar(el.fontFamily),
          fontSize: cqf(el.fontSize || 24),
          color: isBtn ? '#ffffff' : el.color || '#1a1612',
          background: isBtn ? gradientCss(el.gradient) || el.fill || accent : undefined,
          borderRadius: isBtn ? cqf(el.radius ?? 6) : undefined,
          boxShadow: isBtn ? shadowCss(el.shadow) : undefined,
          fontWeight: el.bold ? 700 : 400,
          fontStyle: el.italic ? 'italic' : undefined,
          letterSpacing: el.letterSpacing ? cqf(el.letterSpacing) : undefined,
          textAlign: el.align || (isBtn ? 'center' : 'left'),
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
          padding: isBtn ? `0 ${cqf(18)}` : undefined,
          lineHeight: el.lineHeight ?? 1.25,
        }}
      >
        {el.text}
      </div>
    )
    const h = el.anchorTo ? `#cv-${el.anchorTo}` : el.ctaType && el.ctaType !== 'none' ? ctaHref(el) : ''
    return h ? (
      <a href={h} data-jump={el.anchorTo || undefined} style={{ display: 'block', width: '100%', height: '100%' }}>
        {content}
      </a>
    ) : content
  }

  const desktopEls = canvas.elements.filter(e => !e.hidden).sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
  const phoneEls = canvas.elements.filter(e => !e.hidden && !e.mHidden).sort((a, b) => (a.z ?? 0) - (b.z ?? 0))

  return (
    <div className={canvas.width === 'contained' ? 'max-w-5xl mx-auto' : ''}>
      {/* Desktop / tablet: the full canvas */}
      <div className="hidden md:block" style={{ ...bg, position: 'relative', width: '100%', aspectRatio: `${CANVAS_W} / ${Math.max(200, canvas.h)}`, containerType: 'inline-size', overflow: 'hidden' } as CSSProperties}>
        {canvas.bgVideo && <video src={canvas.bgVideo} autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
        {desktopEls.map(el => (
          <div key={el.id} data-cv={el.id} style={{ position: 'absolute', left: cq(el.x), top: cq(el.y), width: cq(el.w), height: cq(el.h), opacity: (el.opacity ?? 100) / 100, transform: el.rotate ? `rotate(${el.rotate}deg)` : undefined, mixBlendMode: el.blend }}>
            {withMotion(el, inner(el, cq))}
          </div>
        ))}
      </div>

      {/* Phones */}
      <div className="md:hidden">
        {canvas.mobileCustom ? (
          <div style={{ ...bg, position: 'relative', width: '100%', aspectRatio: `${MOBILE_W} / ${Math.max(200, canvas.mobileH || canvas.h)}`, containerType: 'inline-size', overflow: 'hidden' } as CSSProperties}>
            {canvas.bgVideo && <video src={canvas.bgVideo} autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
            {phoneEls.map(el => (
              <div key={el.id} data-cv={el.id} style={{ position: 'absolute', left: cqm(el.mx ?? Math.round(el.x * MR)), top: cqm(el.my ?? Math.round(el.y * MR)), width: cqm(el.mw ?? Math.round(el.w * MR)), height: cqm(el.mh ?? Math.round(el.h * MR)), opacity: (el.opacity ?? 100) / 100, transform: el.rotate ? `rotate(${el.rotate}deg)` : undefined, mixBlendMode: el.blend }}>
                {withMotion(el, inner(el, cqm))}
              </div>
            ))}
          </div>
        ) : (
          <MobileStack canvas={canvas} accent={accent} siteSlug={siteSlug} contactEmail={contactEmail} safeHref={safeHref} navPages={navPages} />
        )}
      </div>
      <CanvasMotion />
      <CanvasLightbox />
    </div>
  )
}

// The automatic phone layout: elements stacked top-to-bottom. Shared by the public
// renderer and the editor's "Automatic" phone preview. Not gated by a breakpoint, so
// it renders the stack wherever it is placed.
export function MobileStack({ canvas, accent, siteSlug, contactEmail, safeHref, navPages }: ViewProps) {
  const pageHref = (slug: string) => (slug === '' ? `/s/${siteSlug}` : `/s/${siteSlug}/${slug}`)
  const ctaHref = (el: CanvasElement): string => {
    if (el.ctaType === 'booking') return `/book/${siteSlug}`
    if (el.ctaType === 'email') return contactEmail ? `mailto:${contactEmail}` : ''
    return safeHref((el.href ?? '').trim()) ?? ''
  }
  const paletteVars: CSSProperties = {}
  ;(canvas.palette ?? []).forEach((c, i) => { (paletteVars as Record<string, string>)[`--brand-${i}`] = c })
  const bg: CSSProperties = {
    ...paletteVars,
    background: canvas.bgImage ? undefined : gradientCss(canvas.bgGradient) || canvas.bg || undefined,
    backgroundImage: canvas.bgImage ? `url('${canvas.bgImage}')` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }
  const els = canvas.elements.filter(e => !e.hidden).sort((a, b) => (a.z ?? 0) - (b.z ?? 0))

  return (
    <div style={{ ...bg, padding: '28px 18px', display: 'flex', flexDirection: 'column', gap: 18, overflowX: 'hidden' }}>
      {els.map(el => {
        const o = (el.opacity ?? 100) / 100
        let node: ReactNode = null
        if (el.type === 'image') {
          node = el.src ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={el.src} alt="" loading="lazy" decoding="async" data-lightbox={el.lightbox ? el.src : undefined} style={{ width: '100%', borderRadius: el.radius || 0, objectFit: el.fit || 'cover', display: 'block', opacity: o, filter: filterCss(el.adjust), boxShadow: shadowCss(el.shadow), cursor: el.lightbox ? 'zoom-in' : undefined }} />
          ) : null
        } else if (el.type === 'carousel') {
          node = el.slides && el.slides.length ? <div style={{ width: '100%', aspectRatio: `${el.w} / ${el.h}`, opacity: o }}><Carousel slides={el.slides} fit={el.fit} radiusCss={`${el.radius || 0}px`} interval={el.interval} /></div> : null
        } else if (el.type === 'shape') {
          node = <div style={{ width: '100%', aspectRatio: `${el.w} / ${el.h}`, opacity: o }}><svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}><path d={shapePath(el.shape)} style={{ fill: el.fill || accent }} /></svg></div>
        } else if (el.type === 'box') {
          node = el.fill || el.gradient || el.borderColor ? <div style={{ background: gradientCss(el.gradient) || el.fill, borderRadius: el.radius || 0, minHeight: 28, border: el.borderColor && el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor}` : undefined, opacity: o, boxShadow: shadowCss(el.shadow) }} /> : null
        } else if (el.type === 'button') {
          const h = el.anchorTo ? `#cv-${el.anchorTo}` : ctaHref(el)
          const btn = (
            <span style={{ display: 'inline-block', background: gradientCss(el.gradient) || el.fill || accent, color: '#fff', padding: '11px 24px', borderRadius: el.radius ?? 6, fontFamily: fontVar(el.fontFamily), fontSize: Math.min(el.fontSize || 18, 20), opacity: o, boxShadow: shadowCss(el.shadow) }}>{el.text}</span>
          )
          node = <div style={{ textAlign: el.align || 'left' }}>{h ? <a href={h} data-jump={el.anchorTo || undefined}>{btn}</a> : btn}</div>
        } else if (el.type === 'menu') {
          node = (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start', opacity: o }}>
              {navPages.map(p => (
                <a key={p.slug} href={pageHref(p.slug)} style={{ fontFamily: fontVar(el.fontFamily || 'label'), fontSize: Math.min(el.fontSize || 16, 18), color: el.color || accent, textTransform: 'uppercase', letterSpacing: 1.5 }}>{p.label}</a>
              ))}
            </div>
          )
        } else {
          const txt = (
            <div className={el.dropCap ? 'dbp-dropcap' : undefined} style={{ fontFamily: fontVar(el.fontFamily), fontSize: Math.min(el.fontSize || 24, 44), color: el.color || '#1a1612', fontWeight: el.bold ? 700 : 400, fontStyle: el.italic ? 'italic' : undefined, letterSpacing: el.letterSpacing || undefined, textAlign: el.align || 'left', whiteSpace: 'pre-wrap', lineHeight: el.lineHeight ?? 1.3, opacity: o }}>
              {el.text}
            </div>
          )
          const th = el.anchorTo ? `#cv-${el.anchorTo}` : el.ctaType && el.ctaType !== 'none' ? ctaHref(el) : ''
          node = <div>{th ? <a href={th} data-jump={el.anchorTo || undefined}>{txt}</a> : txt}</div>
        }
        return node == null ? null : <div key={el.id} data-cv={el.id}>{withMotion(el, node)}</div>
      })}
    </div>
  )
}
