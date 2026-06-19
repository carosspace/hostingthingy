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
export interface DesignCritique {
  summary: string
  findings: DesignFinding[]
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
      'stronger, and "praise" for what is already working.',
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
  const block = message.content.find(b => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') throw new Error('The AI did not return a review. Please try again.')
  const input = block.input as { summary?: string; findings?: { area?: string; severity?: string; note?: string }[] }
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
