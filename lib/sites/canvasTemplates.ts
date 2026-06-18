import { CANVAS_W, type PageCanvas, type CanvasElement, type CanvasElementType } from './types'

// A few hand-designed free-canvas starting points. Each build(accent) returns a
// ready PageCanvas (black-on-white, the site's accent used for buttons/icons) that
// the owner applies and then tweaks. Pure layout — no AI.
export interface CanvasTemplate {
  key: string
  name: string
  build: (accent: string) => PageCanvas
}

const INK = '#141414'

function builder() {
  let z = 0
  const els: CanvasElement[] = []
  const add = (type: CanvasElementType, x: number, y: number, w: number, h: number, p: Partial<CanvasElement> = {}) => {
    els.push({ id: 't' + els.length.toString(36), type, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), z: ++z, opacity: 100, ...p } as CanvasElement)
  }
  const done = (extra: Partial<PageCanvas> = {}): PageCanvas => {
    const h = Math.max(900, ...els.filter(e => e.pin !== 'footer').map(e => e.y + e.h + 60))
    return { h, bg: '#ffffff', elements: els, ...extra }
  }
  return { add, done }
}

// Centre an element of width w on the 1000px canvas.
const cx = (w: number) => Math.round((CANVAS_W - w) / 2)

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    key: 'welcome',
    name: 'Welcome',
    build: (accent) => {
      const b = builder()
      b.add('box', 0, 0, CANVAS_W, 88, { fill: '#ffffff' })
      b.add('text', 48, 28, 240, 36, { text: 'Your brand', fontSize: 26, fontFamily: 'display', italic: true, color: INK })
      b.add('menu', CANVAS_W - 520, 34, 480, 30, { fontSize: 15, fontFamily: 'label', color: INK, align: 'right' })
      b.add('text', cx(760), 210, 760, 130, { text: 'A few warm words\nabout what you do', fontSize: 58, fontFamily: 'display', italic: true, color: INK, align: 'center' })
      b.add('text', cx(560), 360, 560, 56, { text: 'A short supporting sentence that says who it’s for.', fontSize: 21, fontFamily: 'body', color: '#555', align: 'center' })
      b.add('button', cx(220), 440, 220, 56, { text: 'Get in touch', fontSize: 18, fontFamily: 'label', fill: accent, radius: 6, ctaType: 'email', align: 'center' })
      b.add('image', cx(800), 540, 800, 380, { fit: 'cover', radius: 12 })
      const cols = [100, 380, 660]
      const titles = ['What I offer', 'How it works', 'Why me']
      cols.forEach((x, i) => {
        b.add('icon', x + 110, 990, 44, 44, { icon: ['star', 'sparkle', 'heart'][i], color: accent })
        b.add('text', x, 1048, 260, 34, { text: titles[i], fontSize: 22, fontFamily: 'display', italic: true, color: INK, align: 'center' })
        b.add('text', x, 1090, 260, 96, { text: 'Two or three warm sentences describing this.', fontSize: 15, fontFamily: 'body', color: '#555', align: 'center' })
      })
      b.add('box', 0, 0, CANVAS_W, 118, { fill: INK, pin: 'footer' })
      b.add('text', 48, 46, 360, 28, { text: '© Your name', fontSize: 14, fontFamily: 'body', color: '#ffffff', pin: 'footer' })
      b.add('menu', CANVAS_W - 520, 46, 480, 28, { fontSize: 13, fontFamily: 'label', color: '#ffffff', align: 'right', pin: 'footer' })
      return b.done()
    },
  },
  {
    key: 'bold',
    name: 'Bold landing',
    build: (accent) => {
      const b = builder()
      b.add('box', 0, 0, CANVAS_W, 560, { fill: accent })
      b.add('text', cx(760), 150, 760, 130, { text: 'One clear, bold promise', fontSize: 64, fontFamily: 'display', italic: true, color: '#ffffff', align: 'center' })
      b.add('text', cx(560), 300, 560, 50, { text: 'The single most important thing you want people to know.', fontSize: 20, fontFamily: 'body', color: '#ffffff', align: 'center' })
      b.add('button', cx(240), 390, 240, 58, { text: 'Start now', fontSize: 18, fontFamily: 'label', fill: INK, radius: 8, ctaType: 'none', align: 'center' })
      const rows = ['Fast & simple', 'Made with care', 'Always here for you']
      rows.forEach((t, i) => {
        const y = 640 + i * 120
        b.add('icon', 150, y, 56, 56, { icon: ['check', 'heart', 'phone'][i], color: accent })
        b.add('text', 240, y + 2, 460, 34, { text: t, fontSize: 24, fontFamily: 'display', italic: true, color: INK })
        b.add('text', 240, y + 44, 600, 50, { text: 'A sentence of supporting detail goes here.', fontSize: 16, fontFamily: 'body', color: '#555' })
      })
      b.add('box', 100, 1050, CANVAS_W - 200, 220, { fill: '#f4f1ec', radius: 16 })
      b.add('text', cx(560), 1100, 560, 44, { text: 'Ready when you are', fontSize: 30, fontFamily: 'display', italic: true, color: INK, align: 'center' })
      b.add('button', cx(220), 1170, 220, 56, { text: 'Get started', fontSize: 18, fontFamily: 'label', fill: accent, radius: 8, ctaType: 'booking', align: 'center' })
      return b.done()
    },
  },
  {
    key: 'about',
    name: 'About me',
    build: (accent) => {
      const b = builder()
      b.add('text', cx(700), 130, 700, 80, { text: 'Hi, I’m [Your name]', fontSize: 52, fontFamily: 'display', italic: true, color: INK, align: 'center' })
      b.add('text', cx(420), 224, 420, 36, { text: 'WHAT YOU DO · WHERE YOU ARE', fontSize: 15, fontFamily: 'label', color: accent, align: 'center' })
      b.add('image', cx(360), 300, 360, 360, { fit: 'cover', radius: 200 })
      b.add('text', cx(640), 700, 640, 200, { text: 'Two short paragraphs about you — your story, what you care about, and how you help the people who find this page. Keep it warm and human.', fontSize: 18, fontFamily: 'body', color: '#444', align: 'center' })
      const icons = ['instagram', 'whatsapp', 'email']
      const sx = cx(3 * 52 + 2 * 24)
      icons.forEach((ic, i) => b.add('icon', sx + i * 76, 940, 52, 52, { icon: ic, color: INK, ctaType: ic === 'email' ? 'email' : 'none' }))
      b.add('button', cx(220), 1030, 220, 56, { text: 'Work with me', fontSize: 18, fontFamily: 'label', fill: accent, radius: 6, ctaType: 'booking', align: 'center' })
      return b.done()
    },
  },
  {
    key: 'soon',
    name: 'Coming soon',
    build: (accent) => {
      const b = builder()
      b.add('text', cx(360), 250, 360, 34, { text: 'SOMETHING IS COMING', fontSize: 15, fontFamily: 'label', color: accent, align: 'center' })
      b.add('text', cx(720), 300, 720, 130, { text: 'Coming soon', fontSize: 84, fontFamily: 'display', italic: true, color: INK, align: 'center' })
      b.add('text', cx(520), 470, 520, 56, { text: 'A line about what people can look forward to.', fontSize: 20, fontFamily: 'body', color: '#555', align: 'center' })
      b.add('button', cx(240), 560, 240, 56, { text: 'Notify me', fontSize: 18, fontFamily: 'label', fill: accent, radius: 30, ctaType: 'email', align: 'center' })
      const icons = ['instagram', 'whatsapp', 'website']
      const sx = cx(3 * 48 + 2 * 22)
      icons.forEach((ic, i) => b.add('icon', sx + i * 70, 670, 48, 48, { icon: ic, color: INK }))
      return b.done()
    },
  },
  {
    key: 'event',
    name: 'Event',
    build: (accent) => {
      const b = builder()
      b.add('box', 0, 0, CANVAS_W, 70, { fill: accent })
      b.add('text', cx(700), 30, 700, 36, { text: '✦ You’re invited', fontSize: 15, fontFamily: 'label', color: '#ffffff', align: 'center' })
      b.add('text', cx(760), 170, 760, 120, { text: 'The name of your event', fontSize: 60, fontFamily: 'display', italic: true, color: INK, align: 'center' })
      b.add('text', cx(560), 320, 560, 40, { text: 'SAT · 12 JULY · 7PM — LISBON', fontSize: 18, fontFamily: 'label', color: accent, align: 'center' })
      b.add('image', cx(820), 400, 820, 380, { fit: 'cover', radius: 12 })
      b.add('text', cx(620), 820, 620, 150, { text: 'A short, inviting description of the evening — what to expect, who it’s for, and why they shouldn’t miss it.', fontSize: 18, fontFamily: 'body', color: '#444', align: 'center' })
      b.add('button', cx(220), 1000, 220, 58, { text: 'RSVP', fontSize: 18, fontFamily: 'label', fill: accent, radius: 6, ctaType: 'booking', align: 'center' })
      return b.done()
    },
  },
]
