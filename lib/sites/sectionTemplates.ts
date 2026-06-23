import { CANVAS_W, type CanvasElement, type CanvasElementType } from './types'

// Ready-made SECTION templates for the free canvas. Unlike whole-page CANVAS_TEMPLATES,
// each section is a self-contained GROUP of elements laid out from y=0 downward; the editor's
// inserter offsets the whole group onto the canvas at the viewport. Pure layout/content — no AI.
// Every section uses ROLE fonts ('display' headings / 'body' paragraphs / 'label' small-caps &
// buttons) so it inherits the site's chosen Site Look fonts, plus INK / #555 / #ffffff and the
// passed `accent` for buttons + highlights. Image slots have no src (the owner drops their own).

export type SectionCategory =
  | 'hero' | 'about' | 'services' | 'testimonial' | 'pricing' | 'faq'
  | 'gallery' | 'team' | 'stats' | 'cta' | 'contact' | 'footer'

export interface SectionTemplate {
  key: string
  name: string
  category: SectionCategory
  build: (accent: string) => CanvasElement[]
}

// Human labels for the gallery's category tabs/headers (also fixes the display order).
export const SECTION_CATEGORY_LABELS: Record<SectionCategory, string> = {
  hero: 'Hero',
  about: 'About',
  services: 'Services',
  testimonial: 'Testimonials',
  pricing: 'Pricing',
  faq: 'FAQ',
  gallery: 'Gallery',
  team: 'Team',
  stats: 'Stats',
  cta: 'Call to action',
  contact: 'Contact',
  footer: 'Footer',
}

export const SECTION_CATEGORY_ORDER: SectionCategory[] = [
  'hero', 'about', 'services', 'testimonial', 'pricing', 'faq', 'gallery', 'team', 'stats', 'cta', 'contact', 'footer',
]

const INK = '#141414'
const MUTE = '#555555'
const PANEL = '#f4f1ec' // soft warm panel
const SLOT = '#ece8e1' // image-slot fill (reads as a photo placeholder)
const LINE = '#e6dfd2' // hairline card border

// Centre an element of width w on the 1000px canvas.
const cx = (w: number) => Math.round((CANVAS_W - w) / 2)

// A tiny builder for a single section: add(type,x,y,w,h,props) → done() returns the element list.
// Ids are placeholders ('s0', 's1', …) — the editor re-mints fresh ids on insert, so they only
// need to be unique within this group. Tracks max-Y so callers / the inserter know the height.
function sb() {
  let z = 0
  const els: CanvasElement[] = []
  const add = (type: CanvasElementType, x: number, y: number, w: number, h: number, p: Partial<CanvasElement> = {}) => {
    els.push({ id: 's' + els.length.toString(36), type, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), z: ++z, opacity: 100, ...p } as CanvasElement)
  }
  const done = () => els
  return { add, done }
}

export const SECTION_TEMPLATES: SectionTemplate[] = [
  // ───────────────────────── HERO ─────────────────────────
  {
    key: 'hero-centered',
    name: 'Hero — centered',
    category: 'hero',
    build: (accent) => {
      const b = sb()
      b.add('text', cx(420), 0, 420, 30, { text: 'A SMALL KICKER LINE', fontSize: 15, fontFamily: 'label', color: accent, align: 'center', letterSpacing: 2 })
      b.add('text', cx(760), 48, 760, 150, { text: 'Your headline goes\nright here', fontSize: 58, fontFamily: 'display', italic: true, color: INK, align: 'center' })
      b.add('text', cx(560), 216, 560, 58, { text: 'A short supporting line that says who this is for and why it matters.', fontSize: 20, fontFamily: 'body', color: MUTE, align: 'center' })
      b.add('button', cx(220), 300, 220, 56, { text: 'Get started', fontSize: 18, fontFamily: 'label', fill: accent, color: '#ffffff', radius: 6, ctaType: 'none', align: 'center' })
      return b.done()
    },
  },
  {
    key: 'hero-split',
    name: 'Hero — text + image',
    category: 'hero',
    build: (accent) => {
      const b = sb()
      b.add('text', 100, 40, 380, 30, { text: 'WELCOME', fontSize: 15, fontFamily: 'label', color: accent, align: 'left', letterSpacing: 2 })
      b.add('text', 100, 80, 400, 132, { text: 'A bold promise,\nclearly told', fontSize: 52, fontFamily: 'display', italic: true, color: INK, align: 'left' })
      b.add('text', 100, 228, 380, 96, { text: 'Two short sentences that explain what you do and the one good reason to keep reading.', fontSize: 19, fontFamily: 'body', color: MUTE, align: 'left' })
      b.add('button', 100, 340, 210, 56, { text: 'Learn more', fontSize: 18, fontFamily: 'label', fill: accent, color: '#ffffff', radius: 6, ctaType: 'none', align: 'center' })
      b.add('image', 540, 30, 360, 420, { fit: 'cover', fill: SLOT, radius: 14 })
      return b.done()
    },
  },
  {
    key: 'hero-band',
    name: 'Hero — colour band',
    category: 'hero',
    build: (accent) => {
      const b = sb()
      b.add('box', 0, 0, CANVAS_W, 460, { fill: accent, radius: 0 })
      b.add('text', cx(760), 110, 760, 120, { text: 'One clear, bold promise', fontSize: 60, fontFamily: 'display', italic: true, color: '#ffffff', align: 'center' })
      b.add('text', cx(540), 250, 540, 54, { text: 'The single most important thing you want people to know.', fontSize: 20, fontFamily: 'body', color: '#ffffff', align: 'center' })
      b.add('button', cx(220), 336, 220, 56, { text: 'Start now', fontSize: 18, fontFamily: 'label', fill: '#ffffff', color: INK, radius: 6, ctaType: 'none', align: 'center' })
      return b.done()
    },
  },

  // ───────────────────────── ABOUT ─────────────────────────
  {
    key: 'about-split',
    name: 'About — image + text',
    category: 'about',
    build: (accent) => {
      const b = sb()
      b.add('image', 100, 20, 360, 400, { fit: 'cover', fill: SLOT, radius: 14 })
      b.add('text', 520, 40, 380, 30, { text: 'ABOUT', fontSize: 15, fontFamily: 'label', color: accent, align: 'left', letterSpacing: 2 })
      b.add('text', 520, 78, 380, 110, { text: 'A little about\nyou & your work', fontSize: 42, fontFamily: 'display', italic: true, color: INK, align: 'left' })
      b.add('text', 520, 206, 380, 170, { text: 'Two short paragraphs about your story, what you care about, and how you help the people who land on this page. Keep it warm and human — write like you speak.', fontSize: 18, fontFamily: 'body', color: MUTE, align: 'left' })
      b.add('button', 520, 388, 200, 54, { text: 'Read more', fontSize: 17, fontFamily: 'label', fill: accent, color: '#ffffff', radius: 6, ctaType: 'none', align: 'center' })
      return b.done()
    },
  },
  {
    key: 'about-centered',
    name: 'About — centered',
    category: 'about',
    build: (accent) => {
      const b = sb()
      b.add('image', cx(180), 0, 180, 180, { fit: 'cover', fill: SLOT, radius: 100 })
      b.add('text', cx(560), 208, 560, 70, { text: 'Hi, I’m [Your name]', fontSize: 44, fontFamily: 'display', italic: true, color: INK, align: 'center' })
      b.add('text', cx(420), 286, 420, 28, { text: 'WHAT YOU DO · WHERE YOU ARE', fontSize: 14, fontFamily: 'label', color: accent, align: 'center', letterSpacing: 2 })
      b.add('text', cx(620), 338, 620, 140, { text: 'A warm paragraph or two about you — your story, what lights you up, and how you help. Speak directly to the person reading, like a friend across the table.', fontSize: 18, fontFamily: 'body', color: MUTE, align: 'center' })
      return b.done()
    },
  },

  // ───────────────────────── SERVICES ─────────────────────────
  {
    key: 'services-3col',
    name: 'Services — three columns',
    category: 'services',
    build: (accent) => {
      const b = sb()
      b.add('text', cx(620), 0, 620, 60, { text: 'What I offer', fontSize: 42, fontFamily: 'display', italic: true, color: INK, align: 'center' })
      b.add('text', cx(520), 70, 520, 40, { text: 'A short line introducing the three ways you can help.', fontSize: 18, fontFamily: 'body', color: MUTE, align: 'center' })
      const xs = [100, 375, 650]
      const names = ['Service one', 'Service two', 'Service three']
      const icons = ['sparkle', 'star', 'heart']
      xs.forEach((x, i) => {
        b.add('box', x, 160, 250, 300, { fill: '#ffffff', radius: 14, borderColor: LINE, borderWidth: 2 })
        b.add('icon', x + 105, 196, 40, 40, { icon: icons[i], color: accent })
        b.add('text', x + 20, 252, 210, 32, { text: names[i], fontSize: 22, fontFamily: 'display', italic: true, color: INK, align: 'center' })
        b.add('text', x + 24, 296, 202, 130, { text: 'A couple of warm sentences describing what this includes and who it’s for.', fontSize: 15, fontFamily: 'body', color: MUTE, align: 'center' })
      })
      return b.done()
    },
  },
  {
    key: 'services-rows',
    name: 'Services — feature rows',
    category: 'services',
    build: (accent) => {
      const b = sb()
      b.add('text', 100, 0, 620, 60, { text: 'How it works', fontSize: 40, fontFamily: 'display', italic: true, color: INK, align: 'left' })
      const titles = ['First, we begin', 'Then, we build', 'Finally, you launch']
      const icons = ['check', 'sparkle', 'star']
      titles.forEach((title, i) => {
        const y = 100 + i * 130
        b.add('box', 100, y, 64, 64, { fill: PANEL, radius: 14 })
        b.add('icon', 112, y + 12, 40, 40, { icon: icons[i], color: accent })
        b.add('text', 200, y + 2, 700, 34, { text: title, fontSize: 24, fontFamily: 'display', italic: true, color: INK, align: 'left' })
        b.add('text', 200, y + 44, 700, 60, { text: 'A sentence or two of supporting detail explaining this step and what the reader can expect.', fontSize: 16, fontFamily: 'body', color: MUTE, align: 'left' })
      })
      return b.done()
    },
  },
  {
    key: 'services-priced',
    name: 'Services — priced cards',
    category: 'services',
    build: (accent) => {
      const b = sb()
      b.add('text', cx(620), 0, 620, 60, { text: 'Ways to work together', fontSize: 40, fontFamily: 'display', italic: true, color: INK, align: 'center' })
      const xs = [100, 375, 650]
      const names = ['Service one', 'Service two', 'Service three']
      const prices = ['from €60', 'from €90', 'from €120']
      xs.forEach((x, i) => {
        b.add('box', x, 110, 250, 320, { fill: '#ffffff', radius: 14, borderColor: LINE, borderWidth: 2 })
        b.add('text', x + 20, 140, 210, 32, { text: names[i], fontSize: 21, fontFamily: 'display', italic: true, color: INK, align: 'center' })
        b.add('text', x + 24, 184, 202, 120, { text: 'A couple of warm sentences about what this includes.', fontSize: 14, fontFamily: 'body', color: MUTE, align: 'center' })
        b.add('text', x + 20, 318, 210, 30, { text: prices[i], fontSize: 18, fontFamily: 'label', color: accent, align: 'center', letterSpacing: 1 })
        b.add('button', x + 45, 360, 160, 48, { text: 'Enquire', fontSize: 16, fontFamily: 'label', fill: accent, color: '#ffffff', radius: 6, ctaType: 'none', align: 'center' })
      })
      return b.done()
    },
  },

  // ───────────────────────── TESTIMONIAL ─────────────────────────
  {
    key: 'testimonial-single',
    name: 'Testimonial — big quote',
    category: 'testimonial',
    build: (accent) => {
      const b = sb()
      b.add('box', 0, 0, CANVAS_W, 380, { fill: PANEL, radius: 0 })
      b.add('icon', cx(56), 56, 56, 56, { icon: 'quote', color: accent })
      b.add('text', cx(720), 140, 720, 150, { text: '“A short, glowing few words from someone you’ve worked with — kept big and centred.”', fontSize: 32, fontFamily: 'display', italic: true, color: INK, align: 'center' })
      b.add('text', cx(360), 308, 360, 28, { text: '— Their name, what they do', fontSize: 16, fontFamily: 'label', color: accent, align: 'center', letterSpacing: 1 })
      return b.done()
    },
  },
  {
    key: 'testimonial-3col',
    name: 'Testimonial — three quotes',
    category: 'testimonial',
    build: (accent) => {
      const b = sb()
      b.add('text', cx(560), 0, 560, 56, { text: 'Kind words', fontSize: 40, fontFamily: 'display', italic: true, color: INK, align: 'center' })
      const xs = [100, 375, 650]
      xs.forEach((x, i) => {
        b.add('box', x, 100, 250, 260, { fill: '#ffffff', radius: 14, borderColor: LINE, borderWidth: 2 })
        b.add('icon', x + 24, 124, 30, 30, { icon: 'quote', color: accent })
        b.add('text', x + 24, 166, 202, 120, { text: 'A warm, specific sentence about what it was like to work with you and the result they got.', fontSize: 15, fontFamily: 'body', color: INK, align: 'left' })
        b.add('text', x + 24, 300, 202, 26, { text: '— Their name', fontSize: 14, fontFamily: 'label', color: accent, align: 'left', letterSpacing: 1 })
      })
      return b.done()
    },
  },
  {
    key: 'testimonial-portrait',
    name: 'Testimonial — with photo',
    category: 'testimonial',
    build: (accent) => {
      const b = sb()
      b.add('image', 120, 20, 220, 220, { fit: 'cover', fill: SLOT, radius: 120 })
      b.add('icon', 400, 30, 44, 44, { icon: 'quote', color: accent })
      b.add('text', 400, 90, 480, 120, { text: '“A longer, heartfelt recommendation that speaks to exactly the kind of person you want to reach next.”', fontSize: 26, fontFamily: 'display', italic: true, color: INK, align: 'left' })
      b.add('text', 400, 220, 480, 28, { text: '— Their name, their role', fontSize: 16, fontFamily: 'label', color: accent, align: 'left', letterSpacing: 1 })
      return b.done()
    },
  },

  // ───────────────────────── PRICING ─────────────────────────
  {
    key: 'pricing-3tier',
    name: 'Pricing — three tiers',
    category: 'pricing',
    build: (accent) => {
      const b = sb()
      b.add('text', cx(560), 0, 560, 56, { text: 'Simple pricing', fontSize: 42, fontFamily: 'display', italic: true, color: INK, align: 'center' })
      b.add('text', cx(520), 66, 520, 36, { text: 'Pick the plan that fits where you are right now.', fontSize: 18, fontFamily: 'body', color: MUTE, align: 'center' })
      const xs = [100, 375, 650]
      const names = ['Starter', 'Most popular', 'Complete']
      const prices = ['€29', '€59', '€99']
      xs.forEach((x, i) => {
        const featured = i === 1
        b.add('box', x, 150, 250, 380, featured
          ? { fill: INK, radius: 16 }
          : { fill: '#ffffff', radius: 16, borderColor: LINE, borderWidth: 2 })
        const head = featured ? '#ffffff' : INK
        const sub = featured ? '#cdcdcd' : MUTE
        b.add('text', x + 20, 184, 210, 28, { text: names[i], fontSize: 15, fontFamily: 'label', color: featured ? accent : accent, align: 'center', letterSpacing: 2 })
        b.add('text', x + 20, 218, 210, 56, { text: prices[i], fontSize: 46, fontFamily: 'display', italic: true, color: head, align: 'center' })
        b.add('text', x + 20, 286, 210, 24, { text: 'per month', fontSize: 13, fontFamily: 'label', color: sub, align: 'center', letterSpacing: 1 })
        b.add('text', x + 28, 330, 194, 120, { text: 'What’s included\nA second nice line\nAnd a third one', fontSize: 15, fontFamily: 'body', color: sub, align: 'center', lineHeight: 1.7 })
        b.add('button', x + 45, 462, 160, 50, { text: 'Choose', fontSize: 16, fontFamily: 'label', fill: featured ? '#ffffff' : accent, color: featured ? INK : '#ffffff', radius: 6, ctaType: 'none', align: 'center' })
      })
      return b.done()
    },
  },

  // ───────────────────────── FAQ ─────────────────────────
  {
    key: 'faq-list',
    name: 'FAQ — question list',
    category: 'faq',
    build: (accent) => {
      const b = sb()
      b.add('text', cx(620), 0, 620, 56, { text: 'Questions & answers', fontSize: 40, fontFamily: 'display', italic: true, color: INK, align: 'center' })
      const qs = [
        'A common question people ask?',
        'Another thing they often wonder?',
        'And one more that comes up a lot?',
      ]
      qs.forEach((q, i) => {
        const y = 100 + i * 150
        b.add('text', 140, y, 720, 36, { text: q, fontSize: 22, fontFamily: 'display', italic: true, color: INK, align: 'left' })
        b.add('text', 140, y + 44, 720, 70, { text: 'A clear, reassuring answer in one or two sentences — say exactly what they need to hear.', fontSize: 16, fontFamily: 'body', color: MUTE, align: 'left' })
        if (i < qs.length - 1) b.add('box', 140, y + 126, 720, 1, { fill: LINE, radius: 0 })
      })
      return b.done()
    },
  },

  // ───────────────────────── GALLERY ─────────────────────────
  {
    key: 'gallery-3col',
    name: 'Gallery — three across',
    category: 'gallery',
    build: (accent) => {
      const b = sb()
      b.add('text', cx(560), 0, 560, 56, { text: 'Selected work', fontSize: 40, fontFamily: 'display', italic: true, color: INK, align: 'center' })
      b.add('text', cx(420), 66, 420, 28, { text: 'A LITTLE LINE ABOUT YOUR CRAFT', fontSize: 14, fontFamily: 'label', color: accent, align: 'center', letterSpacing: 2 })
      const xs = [100, 370, 640]
      xs.forEach(x => b.add('image', x, 130, 260, 300, { fit: 'cover', fill: SLOT, radius: 12 }))
      return b.done()
    },
  },
  {
    key: 'gallery-grid',
    name: 'Gallery — four-up grid',
    category: 'gallery',
    build: () => {
      const b = sb()
      const xs = [100, 530]
      const ys = [0, 320]
      ys.forEach(y => xs.forEach(x => b.add('image', x, y, 370, 290, { fit: 'cover', fill: SLOT, radius: 12 })))
      return b.done()
    },
  },

  // ───────────────────────── TEAM ─────────────────────────
  {
    key: 'team-3col',
    name: 'Team — three people',
    category: 'team',
    build: (accent) => {
      const b = sb()
      b.add('text', cx(560), 0, 560, 56, { text: 'Meet the team', fontSize: 40, fontFamily: 'display', italic: true, color: INK, align: 'center' })
      const xs = [100, 375, 650]
      const roles = ['Founder', 'Designer', 'Maker']
      xs.forEach((x, i) => {
        b.add('image', x + 25, 110, 200, 200, { fit: 'cover', fill: SLOT, radius: 110 })
        b.add('text', x, 326, 250, 32, { text: 'Their name', fontSize: 22, fontFamily: 'display', italic: true, color: INK, align: 'center' })
        b.add('text', x, 366, 250, 24, { text: roles[i].toUpperCase(), fontSize: 13, fontFamily: 'label', color: accent, align: 'center', letterSpacing: 2 })
        b.add('text', x + 20, 398, 210, 70, { text: 'A short, friendly line about what they do here.', fontSize: 15, fontFamily: 'body', color: MUTE, align: 'center' })
      })
      return b.done()
    },
  },

  // ───────────────────────── STATS ─────────────────────────
  {
    key: 'stats-row',
    name: 'Stats — number row',
    category: 'stats',
    build: (accent) => {
      const b = sb()
      b.add('box', 0, 0, CANVAS_W, 220, { fill: PANEL, radius: 0 })
      const xs = [60, 295, 530, 765]
      const nums = ['250+', '12', '98%', '5★']
      const labels = ['Happy clients', 'Years of craft', 'Would recommend', 'Average rating']
      xs.forEach((x, i) => {
        b.add('text', x, 60, 175, 64, { text: nums[i], fontSize: 52, fontFamily: 'display', italic: true, color: accent, align: 'center' })
        b.add('text', x, 138, 175, 28, { text: labels[i].toUpperCase(), fontSize: 13, fontFamily: 'label', color: INK, align: 'center', letterSpacing: 1 })
      })
      return b.done()
    },
  },

  // ───────────────────────── CTA ─────────────────────────
  {
    key: 'cta-band',
    name: 'CTA — colour band',
    category: 'cta',
    build: (accent) => {
      const b = sb()
      b.add('box', 0, 0, CANVAS_W, 300, { fill: accent, radius: 0 })
      b.add('text', cx(680), 70, 680, 60, { text: 'Ready when you are', fontSize: 44, fontFamily: 'display', italic: true, color: '#ffffff', align: 'center' })
      b.add('text', cx(520), 142, 520, 40, { text: 'A warm, inviting line that nudges them to take the next step.', fontSize: 19, fontFamily: 'body', color: '#ffffff', align: 'center' })
      b.add('button', cx(220), 200, 220, 56, { text: 'Get started', fontSize: 18, fontFamily: 'label', fill: '#ffffff', color: INK, radius: 6, ctaType: 'none', align: 'center' })
      return b.done()
    },
  },
  {
    key: 'cta-panel',
    name: 'CTA — soft panel',
    category: 'cta',
    build: (accent) => {
      const b = sb()
      b.add('box', 100, 0, CANVAS_W - 200, 240, { fill: PANEL, radius: 18 })
      b.add('text', cx(560), 52, 560, 50, { text: 'Let’s make something', fontSize: 36, fontFamily: 'display', italic: true, color: INK, align: 'center' })
      b.add('text', cx(480), 110, 480, 36, { text: 'One short line of encouragement to act now.', fontSize: 18, fontFamily: 'body', color: MUTE, align: 'center' })
      b.add('button', cx(220), 166, 220, 54, { text: 'Book a call', fontSize: 17, fontFamily: 'label', fill: accent, color: '#ffffff', radius: 6, ctaType: 'booking', align: 'center' })
      return b.done()
    },
  },
  {
    key: 'cta-simple',
    name: 'CTA — simple line',
    category: 'cta',
    build: (accent) => {
      const b = sb()
      b.add('text', cx(680), 0, 680, 64, { text: 'A simple, direct invitation', fontSize: 40, fontFamily: 'display', italic: true, color: INK, align: 'center' })
      b.add('button', cx(220), 92, 220, 56, { text: 'Get in touch', fontSize: 18, fontFamily: 'label', fill: accent, color: '#ffffff', radius: 30, ctaType: 'email', align: 'center' })
      return b.done()
    },
  },

  // ───────────────────────── CONTACT ─────────────────────────
  {
    key: 'contact-split',
    name: 'Contact — form + details',
    category: 'contact',
    build: (accent) => {
      const b = sb()
      b.add('text', 100, 20, 380, 30, { text: 'GET IN TOUCH', fontSize: 15, fontFamily: 'label', color: accent, align: 'left', letterSpacing: 2 })
      b.add('text', 100, 58, 380, 60, { text: 'Say hello', fontSize: 44, fontFamily: 'display', italic: true, color: INK, align: 'left' })
      b.add('text', 100, 130, 380, 80, { text: 'The easiest ways to reach me — I’d love to hear what you’re working on.', fontSize: 18, fontFamily: 'body', color: MUTE, align: 'left' })
      const items: [string, string][] = [['email', 'hello@yourname.com'], ['whatsapp', '+00 000 000 000'], ['instagram', '@yourhandle']]
      items.forEach(([ic, label], i) => {
        const y = 230 + i * 56
        b.add('icon', 100, y, 32, 32, { icon: ic, color: accent })
        b.add('text', 148, y + 4, 320, 26, { text: label, fontSize: 16, fontFamily: 'body', color: INK, align: 'left' })
      })
      b.add('form', 540, 20, 360, 420, { text: 'Send message', fill: accent, color: INK, radius: 12, fontFamily: 'body' })
      return b.done()
    },
  },
  {
    key: 'contact-centered',
    name: 'Contact — centered',
    category: 'contact',
    build: (accent) => {
      const b = sb()
      b.add('text', cx(560), 0, 560, 64, { text: 'Get in touch', fontSize: 44, fontFamily: 'display', italic: true, color: INK, align: 'center' })
      b.add('text', cx(520), 78, 520, 50, { text: 'The easiest ways to reach me — I’d love to hear from you.', fontSize: 18, fontFamily: 'body', color: MUTE, align: 'center' })
      const items: [string, string][] = [['email', 'Email'], ['whatsapp', 'WhatsApp'], ['instagram', 'Instagram']]
      const sx = cx(3 * 200)
      items.forEach(([ic, label], i) => {
        const x = sx + i * 200
        b.add('icon', x + 78, 160, 44, 44, { icon: ic, color: accent, ctaType: ic === 'email' ? 'email' : 'none' })
        b.add('text', x, 218, 200, 28, { text: label, fontSize: 16, fontFamily: 'label', color: INK, align: 'center', letterSpacing: 1 })
      })
      b.add('button', cx(220), 290, 220, 56, { text: 'Book a time', fontSize: 18, fontFamily: 'label', fill: accent, color: '#ffffff', radius: 6, ctaType: 'booking', align: 'center' })
      return b.done()
    },
  },

  // ───────────────────────── FOOTER ─────────────────────────
  {
    key: 'footer-simple',
    name: 'Footer — brand + links',
    category: 'footer',
    build: () => {
      const b = sb()
      b.add('box', 0, 0, CANVAS_W, 140, { fill: INK, radius: 0, pin: 'footer' })
      b.add('text', 60, 36, 360, 36, { text: 'Your brand', fontSize: 24, fontFamily: 'display', italic: true, color: '#ffffff', align: 'left', pin: 'footer' })
      b.add('text', 60, 80, 360, 26, { text: '© Your name · All rights reserved', fontSize: 13, fontFamily: 'body', color: '#cdcdcd', align: 'left', pin: 'footer' })
      b.add('menu', CANVAS_W - 520, 56, 460, 28, { fontSize: 14, fontFamily: 'label', color: '#ffffff', align: 'right', pin: 'footer' })
      return b.done()
    },
  },
]

// Quick sanity helper for callers (and a place the count is asserted at a glance).
export const SECTION_COUNT = SECTION_TEMPLATES.length
