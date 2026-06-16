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

export interface GeneratedPage {
  headline: string
  subheadline: string
  sections: { heading: string; body: string }[]
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
