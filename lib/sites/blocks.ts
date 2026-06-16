import type { CtaType, SectionKind } from './types'

// Ready-made section templates the user can drop into a page with one click,
// then edit in place. Keeps a blank page from being intimidating.
export interface SectionBlock {
  key: string
  name: string
  heading: string
  body: string
  kind?: SectionKind
  items?: { title?: string; body?: string }[]
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
    body: 'A few words about how you help.',
    kind: 'cards',
    items: [
      { title: 'Service one', body: 'Describe this offering and who it is for.' },
      { title: 'Service two', body: 'Describe this offering and who it is for.' },
      { title: 'Service three', body: 'Describe this offering and who it is for.' },
    ],
  },
  {
    key: 'testimonial',
    name: 'Testimonials',
    heading: 'Kind words',
    body: '',
    kind: 'cards',
    items: [
      { title: '— A client', body: '“Working together was a beautiful, life-changing experience.”' },
      { title: '— A client', body: '“I felt held, seen and supported every step of the way.”' },
    ],
  },
  {
    key: 'faq',
    name: 'FAQ',
    heading: 'Common questions',
    body: '',
    kind: 'faq',
    items: [
      { title: 'What can I expect?', body: 'Write the answer here.' },
      { title: 'How do we begin?', body: 'Write the answer here.' },
      { title: 'Where do sessions take place?', body: 'Write the answer here.' },
    ],
  },
  {
    key: 'pricing',
    name: 'Pricing',
    heading: 'Pricing',
    body: '',
    kind: 'cards',
    items: [
      { title: 'Single session', body: 'Add your price and what is included.' },
      { title: 'Package of three', body: 'Add your price and what is included.' },
    ],
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
