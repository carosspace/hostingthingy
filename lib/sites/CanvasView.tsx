import { type CSSProperties, type ReactNode } from 'react'
import { CANVAS_W, MOBILE_W, canvasLayout, gradientCss, pageBackground, filterCss, shadowCss, shapePath, fontFaceCss, flowContainerStyle, flowItemStyle, flowChildren, type PageCanvas, type CanvasElement, type SiteComponent } from './types'
import CanvasMotion from './CanvasMotion'
import CanvasLightbox from './CanvasLightbox'
import Carousel from './Carousel'
import { canvasIcon } from './icons'
import { ContactForm } from './ContactForm'
import { embedSrc } from './embed'
import { Banner } from './Banner'
import { Popup } from './Popup'
import { googleStack, usedGoogleFamilies, googleHref } from './googleFonts'

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

const fontVar = (f?: string) => (f === 'body' ? 'var(--font-body)' : f === 'label' ? 'var(--font-label)' : f && f.startsWith('custom:') ? `'cvf-${f.slice(7)}', sans-serif` : f && f.startsWith('google:') ? googleStack(f.slice(7)) : 'var(--font-display)')
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

export type RenderCtx = {
  accent: string
  siteSlug: string
  navPages: { slug: string; label: string }[]
  pageHref: (slug: string) => string
  ctaHref: (el: CanvasElement) => string
  components?: SiteComponent[]
  elements?: CanvasElement[] // the full element list, so a 'group' can find its flow children
}

// The absolute renderer for one element (shared by the page canvas + component
// instances + the auto-stack). A 'component' renders its master's elements in a
// nested container; the master's elements are never themselves components, so the
// recursion is bounded to one level.
export function renderInner(el: CanvasElement, cqf: (px: number) => string, ctx: RenderCtx, mobile = false): ReactNode {
  const fontSize = (mobile && el.mFontSize) || el.fontSize || 24
  if (el.type === 'image')
    return el.src ? (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={el.src} alt={el.alt || ''} loading="lazy" decoding="async" data-lightbox={el.lightbox ? el.src : undefined} style={{ width: '100%', height: '100%', objectFit: el.fit || 'cover', borderRadius: cqf(el.radius || 0), display: 'block', filter: filterCss(el.adjust), boxShadow: shadowCss(el.shadow), cursor: el.lightbox ? 'zoom-in' : undefined }} />
    ) : null
  if (el.type === 'carousel')
    return el.slides && el.slides.length ? <Carousel slides={el.slides} fit={el.fit} radiusCss={cqf(el.radius || 0)} interval={el.interval} /> : null
  if (el.type === 'draw')
    return (
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible', pointerEvents: 'none' }}>
        {(el.paths ?? []).map((d, i) => <path key={i} d={d} style={{ fill: 'none', stroke: el.color || '#111111', strokeWidth: el.strokeW || 6, strokeLinecap: 'round', strokeLinejoin: 'round', vectorEffect: 'non-scaling-stroke' }} />)}
      </svg>
    )
  if (el.type === 'group') {
    const flow = el.flow || { dir: 'row' as const, gap: 16, padX: 0, padY: 0, align: 'start' as const, justify: 'start' as const }
    const kids = flowChildren(el, ctx.elements || [])
    return (
      <div style={{ ...flowContainerStyle(flow, cqf), background: el.fill || undefined, borderRadius: cqf(el.radius || 0) }}>
        {kids.map(k => (
          <div key={k.id} style={flowItemStyle(k, flow, cqf)}>{withMotion(k, renderInner(k, cqf, ctx, mobile))}</div>
        ))}
      </div>
    )
  }
  if (el.type === 'shape')
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
        <path d={shapePath(el.shape)} style={{ fill: el.fill || ctx.accent }} />
      </svg>
    )
  if (el.type === 'icon') {
    const node = <div style={{ width: '100%', height: '100%', color: el.color || ctx.accent }}>{canvasIcon(el.icon)}</div>
    const ih = el.anchorTo ? `#cv-${el.anchorTo}` : el.ctaType && el.ctaType !== 'none' ? ctx.ctaHref(el) : ''
    return ih ? <a href={ih} data-jump={el.anchorTo || undefined} target={el.newTab ? '_blank' : undefined} rel={el.newTab ? 'noopener noreferrer' : undefined} style={{ display: 'block', width: '100%', height: '100%' }}>{node}</a> : node
  }
  if (el.type === 'embed') {
    const src = el.embedUrl ? embedSrc(el.embedUrl) : null
    return src ? (
      <iframe
        src={src}
        title="Embedded media"
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        allow="fullscreen; encrypted-media; picture-in-picture"
        style={{ width: '100%', height: '100%', border: 0, borderRadius: cqf(el.radius || 0), display: 'block' }}
      />
    ) : null
  }
  if (el.type === 'form')
    return (
      <ContactForm
        slug={ctx.siteSlug}
        accent={el.fill || ctx.accent}
        label={el.text || 'Send message'}
        radius={el.radius ?? 10}
        fontFamily={el.fontFamily ? fontVar(el.fontFamily) : undefined}
        textColor={el.color || '#1a1612'}
        fields={el.fields}
      />
    )
  if (el.type === 'component') {
    const comp = (ctx.components ?? []).find(c => c.id === el.componentId)
    if (!comp || !comp.elements.length) return null
    const ccqf = (px: number) => `${(px / Math.max(1, comp.w)) * 100}cqw`
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', containerType: 'inline-size' } as CSSProperties}>
        {[...comp.elements].filter(ce => !ce.hidden).sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).map(ce => (
          <div key={ce.id} style={{ position: 'absolute', left: ccqf(ce.x), top: ccqf(ce.y), width: ccqf(ce.w), height: ccqf(ce.h), opacity: (ce.opacity ?? 100) / 100, transform: ce.rotate ? `rotate(${ce.rotate}deg)` : undefined, mixBlendMode: ce.blend }}>
            {renderInner(ce, ccqf, ctx)}
          </div>
        ))}
      </div>
    )
  }
  if (el.type === 'box')
    return <div style={{ width: '100%', height: '100%', background: gradientCss(el.gradient) || el.fill || 'transparent', borderRadius: cqf(el.radius || 0), border: el.borderColor && el.borderWidth ? `${cqf(el.borderWidth)} solid ${el.borderColor}` : undefined, boxShadow: shadowCss(el.shadow) }} />
  if (el.type === 'menu') {
    const ms = el.menuStyle || 'plain'
    const col = el.color || ctx.accent
    const stacked = ms === 'stacked'
    const justify = el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start'
    const linkBase: CSSProperties = { fontFamily: fontVar(el.fontFamily || 'label'), fontSize: cqf(el.fontSize || 18), color: col, textTransform: 'uppercase', letterSpacing: cqf(2), textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-block' }
    const extra: CSSProperties = ms === 'pills' ? { padding: `${cqf(7)} ${cqf(18)}`, border: `1px solid ${col}`, borderRadius: cqf(999) }
      : ms === 'boxed' ? { padding: `${cqf(7)} ${cqf(16)}`, border: `1px solid ${col}` }
      : ms === 'underline' ? { paddingBottom: cqf(4), borderBottom: `2px solid ${col}` } : {}
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: stacked ? 'column' : 'row', flexWrap: stacked ? 'nowrap' : 'wrap', alignItems: stacked ? justify : 'center', justifyContent: stacked ? 'flex-start' : justify, gap: cqf(stacked ? 12 : 22), overflow: 'hidden' }}>
        {ctx.navPages.map(p => (
          <a key={p.slug} href={ctx.pageHref(p.slug)} style={{ ...linkBase, ...extra }}>{p.label}</a>
        ))}
      </div>
    )
  }
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
        fontSize: cqf(fontSize),
        color: isBtn ? '#ffffff' : !isBtn && el.gradient ? 'transparent' : el.color || '#1a1612',
        background: isBtn ? gradientCss(el.gradient) || el.fill || ctx.accent : undefined,
        backgroundImage: !isBtn && el.gradient ? gradientCss(el.gradient) : undefined,
        WebkitBackgroundClip: !isBtn && el.gradient ? 'text' : undefined,
        backgroundClip: !isBtn && el.gradient ? 'text' : undefined,
        borderRadius: isBtn ? cqf(el.radius ?? 6) : undefined,
        boxShadow: isBtn ? shadowCss(el.shadow) : undefined,
        fontWeight: el.weight ?? (el.bold ? 700 : 400),
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
  const h = el.anchorTo ? `#cv-${el.anchorTo}` : el.ctaType && el.ctaType !== 'none' ? ctx.ctaHref(el) : ''
  return h ? (
    <a href={h} data-jump={el.anchorTo || undefined} target={el.newTab ? '_blank' : undefined} rel={el.newTab ? 'noopener noreferrer' : undefined} style={{ display: 'block', width: '100%', height: '100%' }}>
      {content}
    </a>
  ) : content
}

// The absolutely-positioned canvas surface: a fixed-aspect box (containerType:inline-size)
// with each element placed via container-query units, so the WHOLE layout scales with the
// box's width. Shared by the desktop branch AND the "scale" phone branch — rendering the
// same desktop elements inside the narrower phone box reproduces the desktop arrangement,
// just smaller. `topOf` resolves footer-pinned y; `bgVideo` paints behind the elements.
function AbsoluteCanvas({ els, cqf, topOf, designW, designH, bg, bgVideo, inner }: {
  els: CanvasElement[]
  cqf: (px: number) => string
  topOf: (el: CanvasElement) => number
  designW: number
  designH: number
  bg: CSSProperties
  bgVideo?: string
  inner: (el: CanvasElement, cqf: (px: number) => string, mobile?: boolean) => ReactNode
}) {
  return (
    <div style={{ ...bg, position: 'relative', width: '100%', aspectRatio: `${designW} / ${designH}`, containerType: 'inline-size', overflow: 'hidden' } as CSSProperties}>
      {bgVideo && <video src={bgVideo} autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
      {els.map(el => (
        <div key={el.id} data-cv={el.id} style={{ position: 'absolute', left: cqf(el.x), top: cqf(topOf(el)), width: cqf(el.w), height: cqf(el.h), opacity: (el.opacity ?? 100) / 100, transform: el.rotate ? `rotate(${el.rotate}deg)` : undefined, mixBlendMode: el.blend, cursor: el.cursor }}>
          {withMotion(el, inner(el, cqf))}
        </div>
      ))}
    </div>
  )
}

// Read-only renderer for a free-canvas page. Desktop: a faithful absolutely-positioned
// canvas that scales with the viewport. Phones: a hand-arranged phone artboard when the
// page opted into a custom mobile layout ('Custom'); otherwise the desktop layout scaled
// to phone width ('scale', the default) or the auto top-to-bottom stack ('stack').
export function CanvasView({ canvas, accent, siteSlug, contactEmail, safeHref, navPages }: ViewProps) {
  const pageHref = (slug: string) => (slug === '' ? `/s/${siteSlug}` : `/s/${siteSlug}/${slug}`)
  const ctaHref = (el: CanvasElement): string => {
    if (el.ctaType === 'booking') return `/book/${siteSlug}`
    if (el.ctaType === 'email') return contactEmail ? `mailto:${contactEmail}` : ''
    return safeHref((el.href ?? '').trim()) ?? ''
  }
  const paletteVars: CSSProperties = {}
  ;(canvas.palette ?? []).forEach((c, i) => { (paletteVars as Record<string, string>)[`--brand-${i}`] = c })
  const bg: CSSProperties = { ...paletteVars, ...pageBackground(canvas) }

  const ctx: RenderCtx = { accent, siteSlug, navPages, pageHref, ctaHref, components: canvas.components, elements: canvas.elements }
  const inner = (el: CanvasElement, cqf: (px: number) => string, mobile = false) => renderInner(el, cqf, ctx, mobile)

  // Flow-group children (parentId set) are rendered BY their group, not at the top level.
  const desktopEls = canvas.elements.filter(e => !e.hidden && !e.parentId).sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
  const phoneEls = canvas.elements.filter(e => !e.hidden && !e.mHidden && !e.parentId).sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
  // Footer-pinned elements anchor below the body content, so the footer always sits
  // at the very bottom however much the body grows (identical maths to the editor).
  const layout = canvasLayout(canvas.elements)
  const desktopTop = (el: CanvasElement) => (el.pin === 'footer' ? layout.bodyBottom + el.y : el.y)
  const desktopH = Math.max(200, layout.totalH, canvas.h)

  return (
    <>
      {canvas.banner?.text && <Banner banner={canvas.banner} safeHref={safeHref} />}
    <div className={canvas.width === 'contained' ? 'max-w-5xl mx-auto' : ''}>
      {canvas.fonts && canvas.fonts.length > 0 && <style dangerouslySetInnerHTML={{ __html: fontFaceCss(canvas.fonts) }} />}
      {/* On-demand Google Fonts: one stylesheet for ONLY the families this page actually uses. */}
      {(() => {
        const gf = usedGoogleFamilies(canvas)
        if (!gf.length) return null
        return (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link rel="stylesheet" href={googleHref(gf)} />
          </>
        )
      })()}
      {/* Desktop / tablet: the full canvas */}
      <div className="hidden md:block">
        <AbsoluteCanvas els={desktopEls} cqf={cq} topOf={desktopTop} designW={CANVAS_W} designH={desktopH} bg={bg} bgVideo={canvas.bgVideo} inner={inner} />
      </div>

      {/* Phones */}
      <div className="md:hidden">
        {canvas.mobileCustom ? (
          <div style={{ ...bg, position: 'relative', width: '100%', aspectRatio: `${MOBILE_W} / ${Math.max(200, canvas.mobileH || canvas.h)}`, containerType: 'inline-size', overflow: 'hidden' } as CSSProperties}>
            {canvas.bgVideo && <video src={canvas.bgVideo} autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
            {phoneEls.map(el => (
              <div key={el.id} data-cv={el.id} style={{ position: 'absolute', left: cqm(el.mx ?? Math.round(el.x * MR)), top: cqm(el.my ?? Math.round((el.pin === 'footer' ? layout.bodyBottom + el.y : el.y) * MR)), width: cqm(el.mw ?? Math.round(el.w * MR)), height: cqm(el.mh ?? Math.round(el.h * MR)), opacity: (el.opacity ?? 100) / 100, transform: el.rotate ? `rotate(${el.rotate}deg)` : undefined, mixBlendMode: el.blend, cursor: el.cursor }}>
                {withMotion(el, inner(el, cqm, true))}
              </div>
            ))}
          </div>
        ) : canvas.mobileMode === 'stack' ? (
          <MobileStack canvas={canvas} accent={accent} siteSlug={siteSlug} contactEmail={contactEmail} safeHref={safeHref} navPages={navPages} />
        ) : (
          // 'scale' (the default when mobileMode is undefined): render the SAME desktop absolute
          // layout inside the phone-width box. The container-query units scale it down faithfully —
          // same arrangement, smaller — so it's pixel-faithful to desktop.
          <AbsoluteCanvas els={desktopEls} cqf={cq} topOf={desktopTop} designW={CANVAS_W} designH={desktopH} bg={bg} bgVideo={canvas.bgVideo} inner={inner} />
        )}
      </div>
      <CanvasMotion />
      <CanvasLightbox />
    </div>
    {canvas.popup?.text && <Popup popup={canvas.popup} safeHref={safeHref} paletteVars={paletteVars} />}
    </>
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
  const bg: CSSProperties = { ...paletteVars, ...pageBackground(canvas) }
  const ctx: RenderCtx = { accent, siteSlug, navPages, pageHref, ctaHref, components: canvas.components, elements: canvas.elements }
  const ordered = canvas.elements.filter(e => !e.hidden && !e.parentId).sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
  // Footer-pinned elements always stack at the very bottom on phones.
  const els = [...ordered.filter(e => e.pin !== 'footer'), ...ordered.filter(e => e.pin === 'footer')]

  return (
    <div style={{ ...bg, padding: '28px 18px', display: 'flex', flexDirection: 'column', gap: 18, overflowX: 'hidden' }}>
      {els.map(el => {
        const o = (el.opacity ?? 100) / 100
        let node: ReactNode = null
        if (el.type === 'image') {
          node = el.src ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={el.src} alt={el.alt || ''} loading="lazy" decoding="async" data-lightbox={el.lightbox ? el.src : undefined} style={{ width: '100%', borderRadius: el.radius || 0, objectFit: el.fit || 'cover', display: 'block', opacity: o, filter: filterCss(el.adjust), boxShadow: shadowCss(el.shadow), cursor: el.lightbox ? 'zoom-in' : undefined }} />
          ) : null
        } else if (el.type === 'carousel') {
          node = el.slides && el.slides.length ? <div style={{ width: '100%', aspectRatio: `${el.w} / ${el.h}`, opacity: o }}><Carousel slides={el.slides} fit={el.fit} radiusCss={`${el.radius || 0}px`} interval={el.interval} /></div> : null
        } else if (el.type === 'shape') {
          node = <div style={{ width: '100%', aspectRatio: `${el.w} / ${el.h}`, opacity: o }}><svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}><path d={shapePath(el.shape)} style={{ fill: el.fill || accent }} /></svg></div>
        } else if (el.type === 'draw') {
          node = <div style={{ width: '100%', aspectRatio: `${el.w} / ${el.h}`, opacity: o }}><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}>{(el.paths ?? []).map((d, i) => <path key={i} d={d} style={{ fill: 'none', stroke: el.color || '#111111', strokeWidth: el.strokeW || 6, strokeLinecap: 'round', strokeLinejoin: 'round', vectorEffect: 'non-scaling-stroke' }} />)}</svg></div>
        } else if (el.type === 'group') {
          const flow = el.flow || { dir: 'row' as const, gap: 16, padX: 0, padY: 0, align: 'start' as const, justify: 'start' as const }
          const kids = flowChildren(el, canvas.elements)
          // Render the group as its own container-query context at the phone width, so the
          // children's units resolve relative to the GROUP (same proportions as desktop) and the
          // row wraps to fit; height is content-driven so wrapping grows the group, never clips it.
          const gcqf = (px: number) => `${(px / Math.max(1, el.w)) * 100}cqw`
          node = (
            <div style={{ width: '100%', containerType: 'inline-size', opacity: o }}>
              <div style={{ ...flowContainerStyle({ ...flow, wrap: true }, gcqf), height: 'auto', background: el.fill || undefined, borderRadius: el.radius || 0 }}>
                {kids.map(k => <div key={k.id} style={flowItemStyle(k, flow, gcqf)}>{withMotion(k, renderInner(k, gcqf, ctx, true))}</div>)}
              </div>
            </div>
          )
        } else if (el.type === 'icon') {
          const ic = <div style={{ width: `${Math.min(el.w, 120)}px`, aspectRatio: `${el.w} / ${Math.max(1, el.h)}`, color: el.color || accent, opacity: o }}>{canvasIcon(el.icon)}</div>
          const ih = el.anchorTo ? `#cv-${el.anchorTo}` : ctaHref(el)
          node = ih ? <a href={ih} data-jump={el.anchorTo || undefined} target={el.newTab ? '_blank' : undefined} rel={el.newTab ? 'noopener noreferrer' : undefined} style={{ display: 'inline-block' }}>{ic}</a> : ic
        } else if (el.type === 'component') {
          node = <div style={{ width: '100%', aspectRatio: `${el.w} / ${Math.max(1, el.h)}`, opacity: o }}>{renderInner(el, p => `${p}px`, ctx)}</div>
        } else if (el.type === 'box') {
          node = el.fill || el.gradient || el.borderColor ? <div style={{ background: gradientCss(el.gradient) || el.fill, borderRadius: el.radius || 0, minHeight: 28, border: el.borderColor && el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor}` : undefined, opacity: o, boxShadow: shadowCss(el.shadow) }} /> : null
        } else if (el.type === 'button') {
          const h = el.anchorTo ? `#cv-${el.anchorTo}` : ctaHref(el)
          const btn = (
            <span style={{ display: 'inline-block', background: gradientCss(el.gradient) || el.fill || accent, color: '#fff', padding: '11px 24px', borderRadius: el.radius ?? 6, fontFamily: fontVar(el.fontFamily), fontSize: Math.min(el.mFontSize || el.fontSize || 18, 22), fontWeight: el.weight ?? (el.bold ? 700 : 400), opacity: o, boxShadow: shadowCss(el.shadow) }}>{el.text}</span>
          )
          node = <div style={{ textAlign: el.align || 'left' }}>{h ? <a href={h} data-jump={el.anchorTo || undefined} target={el.newTab ? '_blank' : undefined} rel={el.newTab ? 'noopener noreferrer' : undefined}>{btn}</a> : btn}</div>
        } else if (el.type === 'form') {
          node = (
            <div style={{ width: '100%', aspectRatio: `${el.w} / ${Math.max(1, el.h)}`, minHeight: 260, opacity: o }}>
              <ContactForm slug={siteSlug} accent={el.fill || accent} label={el.text || 'Send message'} radius={el.radius ?? 10} fontFamily={el.fontFamily ? fontVar(el.fontFamily) : undefined} textColor={el.color || '#1a1612'} fields={el.fields} />
            </div>
          )
        } else if (el.type === 'embed') {
          const src = el.embedUrl ? embedSrc(el.embedUrl) : null
          node = src ? (
            <div style={{ width: '100%', aspectRatio: `${el.w} / ${Math.max(1, el.h)}`, opacity: o }}>
              <iframe src={src} title="Embedded media" loading="lazy" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" allow="fullscreen; encrypted-media; picture-in-picture" style={{ width: '100%', height: '100%', border: 0, borderRadius: el.radius || 0, display: 'block' }} />
            </div>
          ) : null
        } else if (el.type === 'menu') {
          const ms = el.menuStyle || 'plain'
          const mcol = el.color || accent
          const mStacked = ms === 'stacked'
          const mJustify = el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start'
          const mExtra: CSSProperties = ms === 'pills' ? { padding: '7px 16px', border: `1px solid ${mcol}`, borderRadius: 999 }
            : ms === 'boxed' ? { padding: '7px 14px', border: `1px solid ${mcol}` }
            : ms === 'underline' ? { paddingBottom: 3, borderBottom: `2px solid ${mcol}` } : {}
          node = (
            <div style={{ display: 'flex', flexDirection: mStacked ? 'column' : 'row', flexWrap: mStacked ? 'nowrap' : 'wrap', alignItems: mStacked ? mJustify : 'center', gap: mStacked ? 10 : 16, justifyContent: mStacked ? 'flex-start' : mJustify, opacity: o }}>
              {navPages.map(p => (
                <a key={p.slug} href={pageHref(p.slug)} style={{ fontFamily: fontVar(el.fontFamily || 'label'), fontSize: Math.min(el.fontSize || 16, 18), color: mcol, textTransform: 'uppercase', letterSpacing: 1.5, textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-block', ...mExtra }}>{p.label}</a>
              ))}
            </div>
          )
        } else {
          const txt = (
            <div className={el.dropCap ? 'dbp-dropcap' : undefined} style={{ fontFamily: fontVar(el.fontFamily), fontSize: Math.min(el.mFontSize || el.fontSize || 24, 48), color: el.gradient ? 'transparent' : el.color || '#1a1612', backgroundImage: el.gradient ? gradientCss(el.gradient) : undefined, WebkitBackgroundClip: el.gradient ? 'text' : undefined, backgroundClip: el.gradient ? 'text' : undefined, fontWeight: el.weight ?? (el.bold ? 700 : 400), fontStyle: el.italic ? 'italic' : undefined, letterSpacing: el.letterSpacing || undefined, textAlign: el.align || 'left', whiteSpace: 'pre-wrap', lineHeight: el.lineHeight ?? 1.3, opacity: o }}>
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
