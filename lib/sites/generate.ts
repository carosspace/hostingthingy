import Anthropic from '@anthropic-ai/sdk'
import type { SiteContent, SiteTheme } from './types'

// Turns a short business description into a full little website, using Claude.
// A forced tool call guarantees clean, structured output (no parsing guesswork).
export async function generateSiteContent(siteName: string, description: string): Promise<SiteContent> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    tools: [
      {
        name: 'build_website',
        description: 'Provide the content for a small, elegant marketing website.',
        input_schema: {
          type: 'object',
          properties: {
            theme: {
              type: 'string',
              enum: ['sand', 'midnight', 'sage', 'rose'],
              description: 'A colour mood that fits the business: sand (warm neutral), midnight (dark elegant), sage (calm green), rose (soft).',
            },
            headline: { type: 'string', description: 'Short, evocative hero headline (~3-8 words).' },
            subheadline: { type: 'string', description: 'One warm sentence beneath the headline.' },
            sections: {
              type: 'array',
              description: 'Exactly three sections, e.g. About, Offerings, and Get in touch.',
              items: {
                type: 'object',
                properties: {
                  heading: { type: 'string' },
                  body: { type: 'string', description: '2-4 warm, clear sentences.' },
                },
                required: ['heading', 'body'],
              },
            },
          },
          required: ['theme', 'headline', 'subheadline', 'sections'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'build_website' },
    messages: [
      {
        role: 'user',
        content: `Write the content for a simple, beautiful website.\n\nBusiness name: ${siteName}\nWhat it is: ${description}\n\nUse warm, clear, professional copy. Exactly three sections.`,
      },
    ],
  })

  if (message.stop_reason === 'max_tokens') throw new Error('That was too much to generate at once — please try again with a shorter description.')
  const block = message.content.find(b => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') {
    throw new Error('The AI did not return website content. Please try again.')
  }

  const input = block.input as {
    theme?: string
    headline?: string
    subheadline?: string
    sections?: { heading?: string; body?: string }[]
  }

  const theme: SiteTheme = (['sand', 'midnight', 'sage', 'rose'].includes(input.theme ?? '')
    ? input.theme
    : 'sand') as SiteTheme

  return {
    theme,
    headline: (input.headline ?? '').trim(),
    subheadline: (input.subheadline ?? '').trim(),
    sections: (input.sections ?? [])
      .slice(0, 3)
      .map(s => ({ heading: (s.heading ?? '').trim(), body: (s.body ?? '').trim() })),
    contactEmail: '',
  }
}

// Rebuild a raw HTML design (e.g. from an AI design tool) as approximate, DRAGGABLE
// free-canvas elements. Returns raw element objects positioned on a 1000px-wide design
// space; the caller sanitises them through the normal canvas save-gate before persisting.
// This is intentionally an approximation — layout/text/colours are matched with simple
// movable pieces, not a pixel copy.
export async function generateCanvasFromHtml(html: string): Promise<Record<string, unknown>[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    tools: [
      {
        name: 'rebuild_as_canvas',
        description: 'Recreate an HTML page design as positioned, draggable canvas elements.',
        input_schema: {
          type: 'object',
          properties: {
            elements: {
              type: 'array',
              description: 'The design recreated as 25–80 canvas elements, in visual (top-to-bottom) order.',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['text', 'button', 'box', 'image', 'divider'], description: 'text = headings/paragraphs; button = CTAs; box = a coloured panel/background band; image = a picture; divider = a thin line.' },
                  x: { type: 'number', description: 'Left position in px on a 1000px-wide canvas (0–1000).' },
                  y: { type: 'number', description: 'Top position in px (page top = 0, growing downward).' },
                  w: { type: 'number', description: 'Width in px.' },
                  h: { type: 'number', description: 'Height in px.' },
                  text: { type: 'string', description: 'The real text content, for text and button elements.' },
                  fontSize: { type: 'number', description: 'Font size in px (12–120).' },
                  weight: { type: 'number', description: 'Font weight 300–800.' },
                  color: { type: 'string', description: 'Text colour as a #rrggbb hex.' },
                  fill: { type: 'string', description: 'Background fill for box/button, as a #rrggbb hex.' },
                  align: { type: 'string', enum: ['left', 'center', 'right'] },
                  fontFamily: { type: 'string', enum: ['display', 'body', 'label'], description: 'display = headings, body = paragraphs, label = small uppercase labels.' },
                  radius: { type: 'number', description: 'Corner radius in px for box/button.' },
                  src: { type: 'string', description: 'Image URL (https:// only). Omit if the image is not a plain URL.' },
                },
                required: ['type', 'x', 'y', 'w', 'h'],
              },
            },
          },
          required: ['elements'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'rebuild_as_canvas' },
    messages: [
      {
        role: 'user',
        content: `Recreate this web page design as draggable canvas elements laid out on a 1000px-wide canvas. Reproduce it as FAITHFULLY as you can — every section, top to bottom.

Rules:
- Read the REAL text out of the HTML and keep it exactly (every heading, paragraph, label, button, nav link). Don't summarise or drop copy.
- For each coloured section/band, add a full-width \`box\` first (its background colour), then the text/buttons ON TOP of it (higher y is lower down; overlapping is fine — position text inside its box).
- Match the visual hierarchy: big display headings (large fontSize, weight 600–700, fontFamily "display"), body paragraphs (fontFamily "body", ~16–20px), small uppercase labels (fontFamily "label").
- Match colours from the HTML/CSS as #rrggbb hex (approximate gradients with their dominant colour). Match alignment (center/left/right) and rough proportions/spacing.
- Include nav items, hero, every content section, and the footer.
- Use x/y/w/h in px on the 1000px canvas so it visually stacks like the original. Aim for 25–80 elements — more is better for fidelity.

HTML:\n${html.slice(0, 80000)}`,
      },
    ],
  })

  if (message.stop_reason === 'max_tokens') throw new Error('That design was too complex to rebuild — try a simpler page.')
  const block = message.content.find(b => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') throw new Error('The AI did not return canvas elements. Please try again.')
  const input = block.input as { elements?: Record<string, unknown>[] }
  return Array.isArray(input.elements) ? input.elements.slice(0, 60) : []
}

// Improve/rewrite a single section, or write a brand-new one (when heading+body
// are empty). Returns the new heading + body. Used by the in-editor AI buttons.
export async function aiSection(opts: {
  siteName: string
  instruction: string
  heading: string
  body: string
}): Promise<{ heading: string; body: string }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const isNew = !opts.heading.trim() && !opts.body.trim()

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 700,
    tools: [
      {
        name: 'write_section',
        description: 'Provide the heading and body for one website section.',
        input_schema: {
          type: 'object',
          properties: {
            heading: { type: 'string', description: 'A short section heading.' },
            body: { type: 'string', description: '2-4 warm, clear sentences.' },
          },
          required: ['heading', 'body'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'write_section' },
    messages: [
      {
        role: 'user',
        content: isNew
          ? `For the website "${opts.siteName}", write a brand-new section.\n\nWhat it should be about: ${opts.instruction}\n\nWarm, clear, professional. Return a heading and a 2-4 sentence body.`
          : `For the website "${opts.siteName}", revise this section.\n\nInstruction: ${opts.instruction}\n\nCurrent heading: ${opts.heading}\nCurrent body: ${opts.body}\n\nKeep it warm, clear and professional. Return the new heading and body.`,
      },
    ],
  })

  const block = message.content.find(b => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') {
    throw new Error('The AI did not return a section. Please try again.')
  }
  const input = block.input as { heading?: string; body?: string }
  return { heading: (input.heading ?? '').trim(), body: (input.body ?? '').trim() }
}

// Rewrite (or write) ONE piece of free-text copy from a plain-language instruction —
// used to edit a single text element on the free canvas with AI.
// A one-line voice instruction appended to copy/review prompts when the owner has set
// a brand voice. Sliced for safety; empty string when no voice is configured.
function voiceLine(brandVoice?: string): string {
  const v = (brandVoice ?? '').trim().slice(0, 600)
  return v ? `\n\nWrite in this brand's voice — match its tone, rhythm and vocabulary: ${v}` : ''
}

export async function aiText(opts: {
  siteName: string
  instruction: string
  text: string
  brandVoice?: string
}): Promise<{ text: string }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const isNew = !opts.text.trim()
  const voice = voiceLine(opts.brandVoice)
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 700,
    tools: [
      {
        name: 'write_text',
        description: 'Provide the rewritten copy for one piece of website text.',
        input_schema: {
          type: 'object',
          properties: { text: { type: 'string', description: 'The new text only.' } },
          required: ['text'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'write_text' },
    messages: [
      {
        role: 'user',
        content: isNew
          ? `For the website "${opts.siteName}", write a short piece of copy.\n\nWhat it should say: ${opts.instruction}\n\nWarm, clear, professional. Return ONLY the text — no quotes, no preamble, no markdown.${voice}`
          : `For the website "${opts.siteName}", rewrite this text.\n\nInstruction: ${opts.instruction}\n\nCurrent text:\n${opts.text}\n\nKeep it warm, clear and professional, and roughly the same length unless the instruction says otherwise. Preserve line breaks where they make sense. Return ONLY the new text — no quotes, no preamble, no markdown.${voice}`,
      },
    ],
  })
  const block = message.content.find(b => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') {
    throw new Error('The AI did not return text. Please try again.')
  }
  const input = block.input as { text?: string }
  return { text: (input.text ?? '').trim() }
}

// Describe an image for alt text using Claude vision. Accepts a base64 data URL
// (jpeg/png/gif/webp) or an http(s) URL. Throws for unsupported types (e.g. SVG).
export async function aiAltText(src: string): Promise<{ alt: string }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const s = src.trim()
  let source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; data: string } | { type: 'url'; url: string }
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(s)
  if (m) {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowed.includes(m[1])) throw new Error('Alt suggestions aren’t available for this image type.')
    source = { type: 'base64', media_type: m[1] as 'image/jpeg', data: m[2] }
  } else if (/^https?:\/\//i.test(s)) {
    source = { type: 'url', url: s }
  } else {
    throw new Error('Unsupported image source.')
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 120,
    tools: [
      {
        name: 'set_alt',
        description: 'Provide concise alt text for the image.',
        input_schema: {
          type: 'object',
          properties: {
            alt: { type: 'string', description: 'A concise (max ~120 chars) description for screen readers and SEO. No "image of"/"picture of" prefix.' },
          },
          required: ['alt'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'set_alt' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source },
          { type: 'text', text: 'Write concise, useful alt text for this image (for screen readers and SEO). Plainly describe what is shown, max ~120 characters. Do not start with "image of" or "picture of".' },
        ],
      },
    ],
  })
  const block = message.content.find(b => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') throw new Error('The AI did not return alt text. Please try again.')
  const input = block.input as { alt?: string }
  return { alt: (input.alt ?? '').trim().slice(0, 250) }
}

// A warm, opinionated design + accessibility review of the current page — "a kind
// senior designer looking over your shoulder". The editor sends a compact text summary
// of the page; the AI returns a few high-leverage, specific notes.
export type CritiqueArea = 'Hierarchy' | 'Contrast' | 'Spacing' | 'Copy' | 'Colour' | 'Accessibility' | 'Mobile'
export type CritiqueSeverity = 'praise' | 'tip' | 'fix'
export interface DesignFinding {
  area: CritiqueArea
  severity: CritiqueSeverity
  note: string
}
// An optional, machine-applicable change the review proposes for a specific element.
// Restricted to safe style properties that already pass the save gate.
export interface DesignEdit {
  targetId: string
  reason: string
  set: { color?: string; fill?: string; fontSize?: number; weight?: number; align?: 'left' | 'center' | 'right'; alt?: string }
}
export interface DesignCritique {
  summary: string
  findings: DesignFinding[]
  edits?: DesignEdit[]
}

const CRITIQUE_AREAS: CritiqueArea[] = ['Hierarchy', 'Contrast', 'Spacing', 'Copy', 'Colour', 'Accessibility', 'Mobile']
const CRITIQUE_SEVS: CritiqueSeverity[] = ['praise', 'tip', 'fix']

export async function aiCritiqueDesign(opts: { siteName: string; summary: string; brandVoice?: string }): Promise<DesignCritique> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system:
      'You are a warm, expert design and accessibility coach for conscious, soulful wellness and coaching brands. ' +
      "You review one-page website designs the way a kind senior designer looks over someone's shoulder: specific, " +
      'encouraging, and never generic. You care about visual hierarchy (does the eye land on the right thing first), ' +
      'readable contrast (WCAG AA), generous breathing room, copy that feels warm and clear, and accessibility (alt text, ' +
      'tap targets). Give a few high-leverage notes, not a long checklist. Genuinely praise what works. Every note must be ' +
      'specific to THIS page and reference the actual elements described — never invent elements that are not in the summary. ' +
      'Mark a note "fix" only for real problems (especially low contrast or missing alt text), "tip" for things that could be ' +
      'stronger, and "praise" for what is already working. ' +
      'When a fix is a concrete, safe property change to a SPECIFIC element, ALSO add it to "edits", reusing the EXACT [id] shown ' +
      'in the summary for that element. Only ever propose edits to these properties: color (text/icon colour), fill (button/box ' +
      'fill), fontSize, weight (100–900), align (left/center/right), alt (image description). Use #rrggbb hex or a var(--brand-N) ' +
      'token for colours. Never invent an id, never propose an edit you are unsure about, and keep edits to the few that genuinely ' +
      'raise the design (max ~8). Leave edits empty if nothing concrete is worth auto-applying.',
    tools: [
      {
        name: 'give_critique',
        description: 'Return a short, warm, prioritized design review of the page.',
        input_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: 'One warm, honest sentence on the overall feel of the page.' },
            findings: {
              type: 'array',
              description: '3 to 6 specific notes, most important first.',
              items: {
                type: 'object',
                properties: {
                  area: { type: 'string', enum: CRITIQUE_AREAS },
                  severity: { type: 'string', enum: CRITIQUE_SEVS, description: 'praise = working well; tip = could be stronger; fix = should change.' },
                  note: { type: 'string', description: 'One specific, actionable sentence that references the actual page.' },
                },
                required: ['area', 'severity', 'note'],
              },
            },
            edits: {
              type: 'array',
              description: 'Optional concrete, safe property changes the user can apply in one click. Reuse the exact [id] from the summary.',
              items: {
                type: 'object',
                properties: {
                  targetId: { type: 'string', description: 'The [id] of the element this changes, exactly as shown in the summary.' },
                  reason: { type: 'string', description: 'Short reason, e.g. "raise contrast on the heading".' },
                  set: {
                    type: 'object',
                    description: 'Only these keys are allowed.',
                    properties: {
                      color: { type: 'string', description: '#rrggbb or var(--brand-N)' },
                      fill: { type: 'string', description: '#rrggbb or var(--brand-N)' },
                      fontSize: { type: 'number' },
                      weight: { type: 'number', description: '100–900' },
                      align: { type: 'string', enum: ['left', 'center', 'right'] },
                      alt: { type: 'string' },
                    },
                  },
                },
                required: ['targetId', 'set'],
              },
            },
          },
          required: ['summary', 'findings'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'give_critique' },
    messages: [
      {
        role: 'user',
        content: `Brand: ${opts.siteName}${voiceLine(opts.brandVoice) ? `\nBrand voice: ${opts.brandVoice!.trim().slice(0, 600)}` : ''}\n\nHere is the current one-page design (positions and sizes are in design pixels on a desktop canvas):\n\n${opts.summary}\n\nReview it warmly and specifically${opts.brandVoice ? ', and judge whether the copy actually sounds like the brand voice above' : ''}.`,
      },
    ],
  })
  if (message.stop_reason === 'max_tokens') throw new Error('The review ran long — please try again.')
  const block = message.content.find(b => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') throw new Error('The AI did not return a review. Please try again.')
  const input = block.input as {
    summary?: string
    findings?: { area?: string; severity?: string; note?: string }[]
    edits?: { targetId?: string; reason?: string; set?: Record<string, unknown> }[]
  }
  // Validate proposed edits the same way the save gate would, so a bad value can never reach
  // the canvas. Only the whitelisted style keys survive; an edit with no usable key is dropped.
  const colorOk = (v: unknown): string | undefined => {
    const s = String(v ?? '').trim()
    return /^#[0-9a-f]{6}$/i.test(s) || /^var\(--brand-[0-5]\)$/.test(s) ? s : undefined // [0-5] = the 6 real palette slots, matches the save gate
  }
  const edits: DesignEdit[] = (input.edits ?? [])
    .slice(0, 12)
    .map(e => {
      const raw = e?.set ?? {}
      const set: DesignEdit['set'] = {}
      const c = colorOk(raw.color); if (c) set.color = c
      const f = colorOk(raw.fill); if (f) set.fill = f
      if (Number.isFinite(raw.fontSize as number)) set.fontSize = Math.max(6, Math.min(400, Math.round(Number(raw.fontSize))))
      if (Number.isFinite(raw.weight as number)) set.weight = Math.max(100, Math.min(900, Math.round(Number(raw.weight) / 100) * 100))
      if (['left', 'center', 'right'].includes(String(raw.align))) set.align = String(raw.align) as 'left' | 'center' | 'right'
      const alt = String(raw.alt ?? '').trim(); if (alt) set.alt = alt.slice(0, 250)
      return { targetId: String(e?.targetId ?? '').trim(), reason: String(e?.reason ?? '').trim().slice(0, 140), set }
    })
    .filter(e => e.targetId && Object.keys(e.set).length > 0)
  return {
    summary: (input.summary ?? '').trim().slice(0, 300),
    findings: (input.findings ?? [])
      .slice(0, 7)
      .map(f => ({
        area: (CRITIQUE_AREAS.includes(f.area as CritiqueArea) ? f.area : 'Hierarchy') as CritiqueArea,
        severity: (CRITIQUE_SEVS.includes(f.severity as CritiqueSeverity) ? f.severity : 'tip') as CritiqueSeverity,
        note: (f.note ?? '').trim().slice(0, 280),
      }))
      .filter(f => f.note),
    edits,
  }
}

// Decide a phone layout: for each element, the order, an emphasis (width), and whether to
// hide it on small screens. The editor turns these hints into a clean single-column stack
// (it computes the actual coordinates, so the AI can never overlap or overflow the canvas).
export type MobileEmphasis = 'full' | 'normal' | 'small'
export async function aiMobileLayout(opts: { siteName: string; items: { id: string; type: string; text: string; w: number; h: number }[] }): Promise<{ items: { id: string; order: number; emphasis: MobileEmphasis; hide: boolean }[] }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const list = opts.items.map(it => `[${it.id}] ${it.type}${it.text ? ` "${it.text}"` : ''} (${it.w}x${it.h})`).join('\n')
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system:
      'You arrange a website\'s elements into a clean single-column PHONE layout. For each element choose: its order top-to-bottom ' +
      '(natural reading + conversion order — brand/logo first, then the hero headline, a short supporting line, the primary call-to-action, ' +
      'then supporting content; menus near the top, footers/contact last); an emphasis — "full" (edge-to-edge: hero images, primary buttons, ' +
      'full-width bands), "normal" (the default comfortable width) or "small" (a narrower secondary element); and whether to HIDE it on phones ' +
      '(true ONLY for purely decorative shapes, lines or background boxes that add nothing on a small screen — NEVER hide text, meaningful images, ' +
      'buttons, forms or menus). Return a decision for every element id.',
    tools: [
      {
        name: 'arrange',
        description: 'Provide a phone layout decision for every element.',
        input_schema: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, order: { type: 'number' }, emphasis: { type: 'string', enum: ['full', 'normal', 'small'] }, hide: { type: 'boolean' } }, required: ['id', 'order', 'emphasis', 'hide'] } },
          },
          required: ['items'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'arrange' },
    messages: [{ role: 'user', content: `Arrange these elements for a phone screen (single column). Brand: "${opts.siteName}".\n\nElements:\n${list}\n\nReturn one decision per id.` }],
  })
  const block = message.content.find(b => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') throw new Error('The AI did not return a phone layout. Please try again.')
  const input = block.input as { items?: { id?: string; order?: number; emphasis?: string; hide?: boolean }[] }
  const items = (input.items ?? [])
    .map(it => ({
      id: String(it.id ?? ''),
      order: Number.isFinite(it.order) ? Number(it.order) : 9999,
      emphasis: (['full', 'normal', 'small'].includes(String(it.emphasis)) ? it.emphasis : 'normal') as MobileEmphasis,
      hide: !!it.hide,
    }))
    .filter(it => it.id)
  return { items }
}

// Polish every text item on a page in one batched call, in a chosen tone, honouring the
// brand voice. Returns rewrites keyed by the SAME ids so the editor can apply them.
export async function aiPolishCopy(opts: { siteName: string; brandVoice?: string; tone: string; items: { id: string; text: string }[] }): Promise<{ items: { id: string; text: string }[] }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const list = opts.items.map((it, i) => `${i + 1}. [${it.id}] ${it.text.replace(/\s+/g, ' ').slice(0, 500)}`).join('\n')
  // Stream with generous headroom: a whole page of rewritten paragraphs in one tool_use
  // object easily overruns a small budget, and a mid-output truncation used to come back
  // as an empty result ("nothing happened") instead of an error.
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    system:
      'You polish the copy on a website while keeping each piece roughly the same length and the same meaning. ' +
      'Warm, clear and human; never invent facts, claims, names or numbers. Return exactly one rewrite per input id, reusing that id.',
    tools: [
      {
        name: 'rewrite_all',
        description: 'Return the rewritten copy for each text item, keyed by its id.',
        input_schema: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } }, required: ['id', 'text'] } },
          },
          required: ['items'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'rewrite_all' },
    messages: [
      {
        role: 'user',
        content: `For the website "${opts.siteName}", rewrite each text item to feel ${opts.tone}, keeping roughly the same length and the same meaning.${voiceLine(opts.brandVoice)}\n\nItems (rewrite each; return the SAME id in brackets):\n${list}\n\nReturn only the rewritten text per id — no preamble, no markdown.`,
      },
    ],
  })
  const message = await stream.finalMessage()
  if (message.stop_reason === 'max_tokens') throw new Error('That was a lot of copy to rewrite at once — please try again.')
  const block = message.content.find(b => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') throw new Error('The AI did not return rewrites. Please try again.')
  const input = block.input as { items?: { id?: string; text?: string }[] }
  const items = (input.items ?? []).map(it => ({ id: String(it.id ?? ''), text: String(it.text ?? '').trim() })).filter(it => it.id && it.text)
  return { items }
}

// Suggest a small, cohesive brand colour palette tuned to the site + its brand voice.
export async function aiPalette(opts: { siteName: string; brandVoice?: string }): Promise<{ colors: string[] }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    system:
      'You are a brand colour expert for conscious, soulful wellness and coaching brands. You design small, cohesive, ' +
      'tasteful palettes — calm, warm and grounded, never harsh or neon. A good palette has a deep anchor colour, one or ' +
      'two mid brand hues, and a soft light tint, with enough contrast between text and background colours to stay readable.',
    tools: [
      {
        name: 'set_palette',
        description: 'Provide a cohesive brand colour palette.',
        input_schema: {
          type: 'object',
          properties: {
            colors: { type: 'array', description: '4-5 harmonious #rrggbb hex colours that work together, ordered anchor/dark first to light last.', items: { type: 'string' } },
          },
          required: ['colors'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'set_palette' },
    messages: [
      {
        role: 'user',
        content: `Design a cohesive brand colour palette for "${opts.siteName}".${voiceLine(opts.brandVoice) ? ` The brand voice: ${opts.brandVoice!.trim().slice(0, 600)}.` : ''} Return 4-5 harmonious hex colours suited to this brand.`,
      },
    ],
  })
  const block = message.content.find(b => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') throw new Error('The AI did not return a palette. Please try again.')
  const input = block.input as { colors?: string[] }
  const colors = (input.colors ?? []).map(c => String(c).trim()).filter(c => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 6)
  if (colors.length < 2) throw new Error('The palette was not usable. Please try again.')
  return { colors }
}

// "Design my whole site" — given a free-text vibe, pick a tasteful font pairing (display/body/
// label), a 5-colour palette, a page background, and button/link colours. Fonts MUST come from
// the supplied allow-list (the Google Fonts whitelist) so nothing arbitrary reaches the font URL;
// the caller re-validates against GOOGLE_FONT_NAMES anyway. Same Sonnet + forced-tool-use idiom
// as the rest of this file. Throws on unusable output so the caller can show a retry.
export async function aiSiteLook(opts: {
  siteName: string
  brandVoice?: string
  vibe: string
  fontNames: string[]
}): Promise<{ display: string; body: string; label: string; palette: string[]; bg: string; buttonFill: string; buttonText: string; linkColor: string }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  // Hand the model the exact allowed family names; it must echo three of them verbatim.
  const allowed = opts.fontNames.map(n => String(n).trim()).filter(Boolean)
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 700,
    system:
      'You are an expert brand designer who dresses a whole website to match a feeling. You choose a tasteful, ' +
      'cohesive type pairing and a harmonious colour scheme that fit the requested vibe — calm and considered, never ' +
      'harsh or clashing. The DISPLAY font is for big headings, the BODY font for paragraphs (must stay highly readable ' +
      'at small sizes), and the LABEL font for small caps / labels. Pair them with contrast (e.g. an expressive serif or ' +
      'display heading over a clean sans body); the three may repeat if one family genuinely suits every role. You MUST ' +
      'pick each font EXACTLY from the allowed list you are given — copy the family name verbatim, never invent one. ' +
      'Ensure the page background and the button/link colours have comfortable, readable contrast against each other.',
    tools: [
      {
        name: 'design_site',
        description: 'Provide a complete site look (fonts, palette, background and button/link colours) for the vibe.',
        input_schema: {
          type: 'object',
          properties: {
            display: { type: 'string', description: 'The heading font — EXACTLY one family name from the allowed list.' },
            body: { type: 'string', description: 'The paragraph font — EXACTLY one family name from the allowed list (readable at small sizes).' },
            label: { type: 'string', description: 'The small-caps / label font — EXACTLY one family name from the allowed list.' },
            palette: { type: 'array', description: 'Exactly 5 harmonious #rrggbb hex colours, ordered anchor/dark first to light last.', items: { type: 'string' } },
            bg: { type: 'string', description: 'The page background colour as #rrggbb hex.' },
            buttonFill: { type: 'string', description: 'The primary button fill colour as #rrggbb hex.' },
            buttonText: { type: 'string', description: 'The button text colour as #rrggbb hex (readable on buttonFill).' },
            linkColor: { type: 'string', description: 'The text-link colour as #rrggbb hex (readable on bg).' },
          },
          required: ['display', 'body', 'label', 'palette', 'bg', 'buttonFill', 'buttonText', 'linkColor'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'design_site' },
    messages: [
      {
        role: 'user',
        content:
          `Design the whole look for the website "${opts.siteName}".\n\nThe vibe to capture: ${opts.vibe}` +
          `${voiceLine(opts.brandVoice) ? `\n\nBrand voice: ${opts.brandVoice!.trim().slice(0, 600)}` : ''}` +
          `\n\nChoose each font EXACTLY from this allowed list (copy the name verbatim):\n${allowed.join(', ')}` +
          `\n\nReturn the display/body/label fonts, a 5-colour palette, a page background colour, and the button fill, button text and link colours.`,
      },
    ],
  })

  if (message.stop_reason === 'max_tokens') throw new Error('The site look ran long — please try again.')
  const block = message.content.find(b => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') throw new Error('The AI did not return a site look. Please try again.')
  const input = block.input as {
    display?: string
    body?: string
    label?: string
    palette?: string[]
    bg?: string
    buttonFill?: string
    buttonText?: string
    linkColor?: string
  }

  const hex = (v: unknown): string => {
    const s = String(v ?? '').trim()
    if (!/^#[0-9a-f]{6}$/i.test(s)) throw new Error('The site look had an unusable colour. Please try again.')
    return s
  }
  const fam = (v: unknown): string => {
    const s = String(v ?? '').trim()
    if (!s) throw new Error('The site look was missing a font. Please try again.')
    return s
  }
  const palette = (input.palette ?? []).map(c => String(c).trim()).filter(c => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 5)
  if (palette.length < 3) throw new Error('The site look palette was not usable. Please try again.')

  return {
    display: fam(input.display),
    body: fam(input.body),
    label: fam(input.label),
    palette,
    bg: hex(input.bg),
    buttonFill: hex(input.buttonFill),
    buttonText: hex(input.buttonText),
    linkColor: hex(input.linkColor),
  }
}

export interface GeneratedPage {
  headline: string
  subheadline: string
  sections: { heading: string; body: string }[]
}

// The in-editor assistant: revise a whole page from a plain-language instruction
// ("make it more premium", "add a testimonials section", "make this more spiritual").
export async function aiRewritePage(opts: {
  siteName: string
  instruction: string
  headline: string
  subheadline: string
  sections: { heading: string; body: string }[]
  brandVoice?: string
}): Promise<GeneratedPage> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const current =
    `Headline: ${opts.headline}\nSubheadline: ${opts.subheadline}\n\nSections:\n` +
    (opts.sections.length ? opts.sections.map((s, i) => `${i + 1}. ${s.heading}\n${s.body}`).join('\n\n') : '(none yet)')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2500,
    tools: [
      {
        name: 'rewrite_page',
        description: 'Provide the full revised content for this website page.',
        input_schema: {
          type: 'object',
          properties: {
            headline: { type: 'string' },
            subheadline: { type: 'string' },
            sections: {
              type: 'array',
              items: {
                type: 'object',
                properties: { heading: { type: 'string' }, body: { type: 'string' } },
                required: ['heading', 'body'],
              },
            },
          },
          required: ['headline', 'subheadline', 'sections'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'rewrite_page' },
    messages: [
      {
        role: 'user',
        content: `Revise this website page for "${opts.siteName}".\n\nInstruction: ${opts.instruction}\n\nCurrent page:\n${current}\n\nApply the instruction, keep what works, and return the FULL revised page (headline, subheadline, and all sections). Warm, clear, professional.${voiceLine(opts.brandVoice)}`,
      },
    ],
  })

  // A truncated (max_tokens) response yields a partial pages/sections array; surface an error
  // instead of silently dropping the tail (which the caller would treat as a real rewrite).
  if (message.stop_reason === 'max_tokens') throw new Error('That page was too large to rewrite in one pass — please try a smaller instruction.')
  const block = message.content.find(b => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') {
    throw new Error('The AI did not return a page. Please try again.')
  }
  const input = block.input as {
    headline?: string
    subheadline?: string
    sections?: { heading?: string; body?: string }[]
  }
  return {
    headline: (input.headline ?? '').trim(),
    subheadline: (input.subheadline ?? '').trim(),
    sections: (input.sections ?? [])
      .slice(0, 12)
      .map(s => ({ heading: (s.heading ?? '').trim(), body: (s.body ?? '').trim() }))
      .filter(s => s.heading || s.body),
  }
}

// Generates copy for a whole multi-page site in one call. Returns one entry per
// requested page, in the SAME order as `pageSpecs` (we control titles/slugs, the
// AI only writes the words). The chosen visual style is handled separately.
export async function generateSitePages(opts: {
  siteName: string
  type: string
  description: string
  styleName: string
  pageSpecs: { title: string; purpose: string }[]
}): Promise<GeneratedPage[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const n = opts.pageSpecs.length

  const pageList = opts.pageSpecs.map((p, i) => `${i + 1}. ${p.title} — ${p.purpose}`).join('\n')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    tools: [
      {
        name: 'build_site',
        description: 'Provide the written content for every page of a small, elegant website.',
        input_schema: {
          type: 'object',
          properties: {
            pages: {
              type: 'array',
              description: `Exactly ${n} pages, in the same order as the requested list.`,
              items: {
                type: 'object',
                properties: {
                  headline: { type: 'string', description: 'Short, evocative page hero headline (~3-8 words).' },
                  subheadline: { type: 'string', description: 'One warm sentence beneath the headline.' },
                  sections: {
                    type: 'array',
                    description: '2-4 sections for this page.',
                    items: {
                      type: 'object',
                      properties: {
                        heading: { type: 'string' },
                        body: { type: 'string', description: '2-4 warm, clear sentences.' },
                      },
                      required: ['heading', 'body'],
                    },
                  },
                },
                required: ['headline', 'subheadline', 'sections'],
              },
            },
          },
          required: ['pages'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'build_site' },
    messages: [
      {
        role: 'user',
        content: `Write the content for a beautiful "${opts.type}" website. Use warm, clear, professional copy in a "${opts.styleName}" style.\n\nBusiness name: ${opts.siteName}\nWhat it is: ${opts.description}\n\nWrite these ${n} pages, in this exact order:\n${pageList}\n\nReturn exactly ${n} pages in the pages array, matching the order above.`,
      },
    ],
  })

  // Don't persist a truncated multi-page generate as blank tail pages — fail loudly instead.
  if (message.stop_reason === 'max_tokens') throw new Error('That site was too large to generate at once — try fewer or simpler pages.')
  const block = message.content.find(b => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') {
    throw new Error('The AI did not return website content. Please try again.')
  }

  const input = block.input as {
    pages?: { headline?: string; subheadline?: string; sections?: { heading?: string; body?: string }[] }[]
  }
  const pages = input.pages ?? []

  // Always return one entry per requested page (fall back to empties if the AI under-delivers).
  return opts.pageSpecs.map((_, i) => {
    const p = pages[i] ?? {}
    return {
      headline: (p.headline ?? '').trim(),
      subheadline: (p.subheadline ?? '').trim(),
      sections: (p.sections ?? [])
        .slice(0, 6)
        .map(s => ({ heading: (s.heading ?? '').trim(), body: (s.body ?? '').trim() }))
        .filter(s => s.heading || s.body),
    }
  })
}
