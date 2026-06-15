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
