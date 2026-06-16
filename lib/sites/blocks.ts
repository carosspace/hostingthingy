import type { CtaType } from './types'

// Ready-made section templates the user can drop into a page with one click,
// then edit in place. Keeps a blank page from being intimidating.
export interface SectionBlock {
  key: string
  name: string
  heading: string
  body: string
  ctaType?: CtaType
  ctaLabel?: string
}

export const SECTION_BLOCKS: SectionBlock[] = [
  {
    key: 'about',
    name: 'About',
    heading: 'About',
    body: 'Share who you are, what you do, and why it matters. A few warm sentences that help visitors feel they are in the right place.',
  },
  {
    key: 'services',
    name: 'Services',
    heading: 'What I offer',
    body: 'Describe your main services or offerings here. Keep each one clear and benefit-focused so visitors know exactly how you can help them.',
  },
  {
    key: 'testimonial',
    name: 'Testimonial',
    heading: 'Kind words',
    body: '“Working together was a beautiful, life-changing experience.”\n\nAdd a real client quote here, with their name underneath.',
  },
  {
    key: 'faq',
    name: 'FAQ',
    heading: 'Common questions',
    body: 'What can I expect?\nWrite the answer here.\n\nHow do we begin?\nWrite the answer here.',
  },
  {
    key: 'pricing',
    name: 'Pricing',
    heading: 'Pricing',
    body: 'Single session — add your price\nPackage of three — add your price\n\nDescribe what is included with each option.',
  },
  {
    key: 'steps',
    name: 'How it works',
    heading: 'How it works',
    body: '1. First, we connect and explore where you are.\n2. Then we work together, step by step.\n3. Finally, you leave with clarity and momentum.',
  },
  {
    key: 'cta',
    name: 'Call to action',
    heading: 'Ready to begin?',
    body: 'Invite your visitor to take the next step — warmly and simply.',
    ctaType: 'booking',
    ctaLabel: 'Book a session',
  },
]
