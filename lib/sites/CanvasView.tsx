import { type CSSProperties } from 'react'
import { CANVAS_W, type PageCanvas, type CanvasElement } from './types'

const fontVar = (f?: string) => (f === 'body' ? 'var(--font-body)' : f === 'label' ? 'var(--font-label)' : 'var(--font-display)')
// A design-pixel value as a container-query-width unit (scales the canvas with the viewport).
const cq = (px: number) => `${(px / CANVAS_W) * 100}cqw`

// Read-only renderer for a free-canvas page. Desktop: a faithful absolutely-positioned
// canvas that scales with the viewport. Phones: the elements stack top-to-bottom.
export function CanvasView({
  canvas,
  accent,
  siteSlug,
  contactEmail,
  safeHref,
}: {
  canvas: PageCanvas
  accent: string
  siteSlug: string
  contactEmail: string
  safeHref: (h: string) => string | null
}) {
  const els = [...canvas.elements].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
  const ctaHref = (el: CanvasElement): string => {
    if (el.ctaType === 'booking') return `/book/${siteSlug}`
    if (el.ctaType === 'email') return contactEmail ? `mailto:${contactEmail}` : ''
    return safeHref((el.href ?? '').trim()) ?? ''
  }
  const bg: CSSProperties = {
    background: canvas.bg || undefined,
    backgroundImage: canvas.bgImage ? `url(${canvas.bgImage})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }

  const desktopInner = (el: CanvasElement) => {
    if (el.type === 'image')
      return el.src ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={el.src} alt="" style={{ width: '100%', height: '100%', objectFit: el.fit || 'cover', borderRadius: cq(el.radius || 0), display: 'block' }} />
      ) : null
    if (el.type === 'box')
      return <div style={{ width: '100%', height: '100%', background: el.fill || 'transparent', borderRadius: cq(el.radius || 0), border: el.borderColor && el.borderWidth ? `${cq(el.borderWidth)} solid ${el.borderColor}` : undefined }} />
    const isBtn = el.type === 'button'
    const content = (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isBtn ? 'center' : el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start',
          fontFamily: fontVar(el.fontFamily),
          fontSize: cq(el.fontSize || 24),
          color: isBtn ? '#ffffff' : el.color || '#1a1612',
          background: isBtn ? el.fill || accent : undefined,
          borderRadius: isBtn ? cq(el.radius ?? 6) : undefined,
          fontWeight: el.bold ? 700 : 400,
          fontStyle: el.italic ? 'italic' : undefined,
          textAlign: el.align || (isBtn ? 'center' : 'left'),
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
          padding: isBtn ? `0 ${cq(18)}` : undefined,
          lineHeight: 1.25,
        }}
      >
        {el.text}
      </div>
    )
    if (isBtn) {
      const h = ctaHref(el)
      return h ? (
        <a href={h} style={{ display: 'block', width: '100%', height: '100%' }}>
          {content}
        </a>
      ) : content
    }
    return content
  }

  return (
    <>
      <div className="hidden md:block" style={{ ...bg, position: 'relative', width: '100%', aspectRatio: `${CANVAS_W} / ${Math.max(200, canvas.h)}`, containerType: 'inline-size' } as CSSProperties}>
        {els.map(el => (
          <div key={el.id} style={{ position: 'absolute', left: cq(el.x), top: cq(el.y), width: cq(el.w), height: cq(el.h), opacity: (el.opacity ?? 100) / 100 }}>
            {desktopInner(el)}
          </div>
        ))}
      </div>

      <div className="md:hidden" style={{ ...bg, padding: '28px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {els.map(el => {
          const o = (el.opacity ?? 100) / 100
          if (el.type === 'image')
            return el.src ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img key={el.id} src={el.src} alt="" style={{ width: '100%', borderRadius: el.radius || 0, objectFit: el.fit || 'cover', display: 'block', opacity: o }} />
            ) : null
          if (el.type === 'box')
            return el.fill || el.borderColor ? <div key={el.id} style={{ background: el.fill, borderRadius: el.radius || 0, minHeight: 28, border: el.borderColor && el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor}` : undefined, opacity: o }} /> : null
          if (el.type === 'button') {
            const h = ctaHref(el)
            const btn = (
              <span style={{ display: 'inline-block', background: el.fill || accent, color: '#fff', padding: '11px 24px', borderRadius: el.radius ?? 6, fontFamily: fontVar(el.fontFamily), fontSize: Math.min(el.fontSize || 18, 20), opacity: o }}>{el.text}</span>
            )
            return (
              <div key={el.id} style={{ textAlign: el.align || 'left' }}>
                {h ? <a href={h}>{btn}</a> : btn}
              </div>
            )
          }
          return (
            <div key={el.id} style={{ fontFamily: fontVar(el.fontFamily), fontSize: Math.min(el.fontSize || 24, 44), color: el.color || '#1a1612', fontWeight: el.bold ? 700 : 400, fontStyle: el.italic ? 'italic' : undefined, textAlign: el.align || 'left', whiteSpace: 'pre-wrap', lineHeight: 1.3, opacity: o }}>
              {el.text}
            </div>
          )
        })}
      </div>
    </>
  )
}
