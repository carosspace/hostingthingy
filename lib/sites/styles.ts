import type { SiteTheme } from './types'

// A "style direction" bundles a theme + accent (and later, fonts) so a generated
// site looks coherent and professional instantly. Picking a style sets the palette;
// users can fine-tune colours afterwards in the visual editor.
export interface StylePreset {
  key: string
  name: string
  description: string
  theme: SiteTheme
  accentColor: string
}

export const STYLE_PRESETS: StylePreset[] = [
  { key: 'minimal', name: 'Minimal & elegant', description: 'Clean, modern, spacious.', theme: 'sand', accentColor: '#2a2a28' },
  { key: 'warm', name: 'Warm & organic', description: 'Soft colours, natural feel.', theme: 'sand', accentColor: '#a85c36' },
  { key: 'luxury', name: 'Luxury & premium', description: 'High-end, refined, dark.', theme: 'midnight', accentColor: '#c9a84c' },
  { key: 'bold', name: 'Bold & creative', description: 'Expressive and energetic.', theme: 'rose', accentColor: '#cf5b46' },
  { key: 'professional', name: 'Professional & trustworthy', description: 'Business-focused and clear.', theme: 'sand', accentColor: '#3f6f8f' },
]

export function getStylePreset(key: string): StylePreset {
  return STYLE_PRESETS.find(s => s.key === key) ?? STYLE_PRESETS[1]
}

// The website categories shown in step 1 of the AI wizard.
export const WEBSITE_TYPES = [
  'Personal brand',
  'Coach',
  'Consultant',
  'Therapist',
  'Healer',
  'Course creator',
  'Membership community',
  'Local business',
  'Freelancer',
  'Agency',
  'E-commerce store',
  'Restaurant',
  'Portfolio',
  'Blog',
  'Nonprofit',
  'Event website',
  'SaaS',
  'Other',
]

// Page choices in step 3. Home is always included. About + Contact are on by default.
export interface PageOption {
  title: string
  purpose: string
  required?: boolean
  default?: boolean
}

export const PAGE_OPTIONS: PageOption[] = [
  { title: 'Home', purpose: 'The welcoming hero and overview of the whole business.', required: true },
  { title: 'About', purpose: 'The story, mission and the person/people behind it.', default: true },
  { title: 'Contact', purpose: 'How to get in touch and a gentle call to reach out.', default: true },
  { title: 'Services', purpose: 'The services or offerings, clearly described.' },
  { title: 'Coaching', purpose: 'Coaching programmes and how they help.' },
  { title: 'Courses', purpose: 'Online courses on offer.' },
  { title: 'Membership', purpose: 'A members community and what is included.' },
  { title: 'Blog', purpose: 'Writing, articles and updates.' },
  { title: 'Testimonials', purpose: 'Social proof and client words.' },
  { title: 'FAQ', purpose: 'Common questions answered.' },
  { title: 'Events', purpose: 'Upcoming events, retreats or gatherings.' },
  { title: 'Resources', purpose: 'Helpful free resources and links.' },
  { title: 'Shop', purpose: 'Products available to buy.' },
]
