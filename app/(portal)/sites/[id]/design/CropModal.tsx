'use client'

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'

type Rect = { x: number; y: number; w: number; h: number }
type Handle = 'nw' | 'ne' | 'sw' | 'se'
type Drag = { mode: 'move' | Handle; px: number; py: number; start: Rect } | null

const MAX_OUT = 1600 // cap the exported image's longest side
const MIN = 24 // smallest crop box (displayed px)

const PRESETS: [string, number | null][] = [
  ['Free', null], ['1:1', 1], ['4:3', 4 / 3], ['16:9', 16 / 9], ['3:4', 3 / 4],
]

// A modal for cropping one image. It fits the image into a box, overlays a
// draggable/resizable crop rectangle, and on Apply bakes the cropped region to a
// new JPEG data URL (so the result passes the same image gate as an upload).
export default function CropModal({ src, onApply, onClose }: { src: string; onApply: (dataUrl: string) => void; onClose: () => void }) {
  const imgRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<Drag>(null)
  const [disp, setDisp] = useState<{ w: number; h: number } | null>(null) // displayed image size
  const [crop, setCrop] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 })
  const [ratio, setRatio] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  // Fit the image into the available box once it has loaded its natural size.
  const onLoad = () => {
    const im = imgRef.current
    if (!im) return
    const maxW = Math.min(560, window.innerWidth - 80)
    const maxH = Math.min(440, window.innerHeight - 220)
    const nat = im.naturalWidth / im.naturalHeight
    let w = maxW, h = w / nat
    if (h > maxH) { h = maxH; w = h * nat }
    const d = { w: Math.round(w), h: Math.round(h) }
    setDisp(d)
    setCrop({ x: 0, y: 0, w: d.w, h: d.h })
  }

  const applyRatio = (r: number | null) => {
    setRatio(r)
    if (!r || !disp) return
    // Centre the largest r-shaped box that fits.
    let w = disp.w, h = w / r
    if (h > disp.h) { h = disp.h; w = h * r }
    setCrop({ x: Math.round((disp.w - w) / 2), y: Math.round((disp.h - h) / 2), w: Math.round(w), h: Math.round(h) })
  }

  useEffect(() => {
    const clamp = (r: Rect, d: { w: number; h: number }): Rect => {
      const w = Math.min(r.w, d.w), h = Math.min(r.h, d.h)
      return { w, h, x: Math.max(0, Math.min(r.x, d.w - w)), y: Math.max(0, Math.min(r.y, d.h - h)) }
    }
    const move = (e: PointerEvent) => {
      const dg = dragRef.current
      if (!dg || !disp) return
      const dx = e.clientX - dg.px, dy = e.clientY - dg.py
      const s = dg.start
      if (dg.mode === 'move') {
        setCrop(clamp({ ...s, x: s.x + dx, y: s.y + dy }, disp))
        return
      }
      // Resize from a corner; the opposite corner stays put.
      let left = s.x, top = s.y, right = s.x + s.w, bottom = s.y + s.h
      if (dg.mode === 'nw') { left = s.x + dx; top = s.y + dy }
      if (dg.mode === 'ne') { right = s.x + s.w + dx; top = s.y + dy }
      if (dg.mode === 'sw') { left = s.x + dx; bottom = s.y + s.h + dy }
      if (dg.mode === 'se') { right = s.x + s.w + dx; bottom = s.y + s.h + dy }
      let nx = Math.min(left, right), ny = Math.min(top, bottom)
      let nw = Math.abs(right - left), nh = Math.abs(bottom - top)
      if (ratio) {
        // Lock the aspect ratio, sizing by the larger drag axis, anchored to the fixed corner.
        const anchorX = dg.mode === 'nw' || dg.mode === 'sw' ? s.x + s.w : s.x
        const anchorY = dg.mode === 'nw' || dg.mode === 'ne' ? s.y + s.h : s.y
        if (nw / ratio >= nh) nh = nw / ratio
        else nw = nh * ratio
        nx = dg.mode === 'nw' || dg.mode === 'sw' ? anchorX - nw : anchorX
        ny = dg.mode === 'nw' || dg.mode === 'ne' ? anchorY - nh : anchorY
      }
      nw = Math.max(MIN, nw); nh = Math.max(MIN, nh)
      setCrop(clamp({ x: nx, y: ny, w: nw, h: nh }, disp))
    }
    const up = () => { dragRef.current = null }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [disp, ratio])

  const startDrag = (e: RPointerEvent, mode: 'move' | Handle) => {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { mode, px: e.clientX, py: e.clientY, start: crop }
  }

  const apply = () => {
    const im = imgRef.current
    if (!im || !disp) return
    setBusy(true)
    try {
      const scale = im.naturalWidth / disp.w
      let sw = crop.w * scale, sh = crop.h * scale
      const sx = crop.x * scale, sy = crop.y * scale
      let outW = sw, outH = sh
      const longest = Math.max(outW, outH)
      if (longest > MAX_OUT) { const k = MAX_OUT / longest; outW = Math.round(outW * k); outH = Math.round(outH * k) }
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(outW))
      canvas.height = Math.max(1, Math.round(outH))
      const ctx = canvas.getContext('2d')
      if (!ctx) { setBusy(false); return }
      ctx.drawImage(im, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
      onApply(canvas.toDataURL('image/jpeg', 0.9))
    } catch {
      // e.g. a cross-origin image would taint the canvas and make toDataURL throw —
      // fail safe by just closing rather than crashing the editor.
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const handleStyle = (pos: Handle): CSSProperties => ({
    position: 'absolute', width: 16, height: 16, background: '#fff', border: '2px solid #9a7d2e', borderRadius: 3, touchAction: 'none', zIndex: 3,
    cursor: pos === 'nw' || pos === 'se' ? 'nwse-resize' : 'nesw-resize',
    left: pos === 'nw' || pos === 'sw' ? -8 : undefined, right: pos === 'ne' || pos === 'se' ? -8 : undefined,
    top: pos === 'nw' || pos === 'ne' ? -8 : undefined, bottom: pos === 'sw' || pos === 'se' ? -8 : undefined,
  })

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="rounded-lg p-5" style={{ background: '#faf7f2', maxWidth: '92vw' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="font-label" style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#9a7d2e' }}>Crop photo</span>
          <button type="button" onClick={onClose} style={{ fontSize: 16, color: '#888', lineHeight: 1 }}>×</button>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {PRESETS.map(([lbl, r]) => (
            <button key={lbl} type="button" onClick={() => applyRatio(r)} className="font-label" style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', padding: '4px 9px', borderRadius: 3, border: `1px solid ${ratio === r ? '#9a7d2e' : 'rgba(0,0,0,0.15)'}`, background: ratio === r ? '#9a7d2e' : 'transparent', color: ratio === r ? '#fff' : '#666' }}>{lbl}</button>
          ))}
        </div>

        <div style={{ position: 'relative', width: disp?.w, height: disp?.h, margin: '0 auto', userSelect: 'none', touchAction: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imgRef} src={src} alt="" onLoad={onLoad} draggable={false} style={{ width: disp?.w, height: disp?.h, display: 'block', pointerEvents: 'none' }} />
          {disp && (
            <>
              {/* four dark panels around the crop box */}
              <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: crop.y, background: 'rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', left: 0, top: crop.y + crop.h, width: '100%', bottom: 0, background: 'rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', left: 0, top: crop.y, width: crop.x, height: crop.h, background: 'rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', left: crop.x + crop.w, top: crop.y, right: 0, height: crop.h, background: 'rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
              {/* the crop box */}
              <div onPointerDown={e => startDrag(e, 'move')} style={{ position: 'absolute', left: crop.x, top: crop.y, width: crop.w, height: crop.h, border: '1px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.3)', cursor: 'move', touchAction: 'none' }}>
                {(['nw', 'ne', 'sw', 'se'] as Handle[]).map(pos => (
                  <div key={pos} onPointerDown={e => startDrag(e, pos)} style={handleStyle(pos)} />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="font-label" style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#888', padding: '8px 14px' }}>Cancel</button>
          <button type="button" onClick={apply} disabled={busy || !disp} className="font-label" style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', background: '#9a7d2e', color: '#faf7f2', padding: '8px 18px', borderRadius: 4, opacity: busy ? 0.6 : 1 }}>{busy ? 'Cropping…' : 'Apply crop'}</button>
        </div>
      </div>
    </div>
  )
}
