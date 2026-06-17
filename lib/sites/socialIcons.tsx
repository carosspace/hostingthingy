import type { ReactNode } from 'react'

// Platforms a "social" header/footer block can link to.
export const SOCIAL_ICON_KINDS = ['instagram', 'facebook', 'tiktok', 'youtube', 'whatsapp', 'email', 'website'] as const
export type SocialIconKind = (typeof SOCIAL_ICON_KINDS)[number]

export const SOCIAL_ICON_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  email: 'Email',
  website: 'Website',
}

// Simple monochrome line icons drawn with currentColor, so they take on the
// chosen text/accent colour. Used on the published page and in the editor preview.
export function socialIcon(kind: string, size = 22): ReactNode {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (kind) {
    case 'instagram':
      return (
        <svg {...p}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.4" cy="6.6" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'facebook':
      return (
        <svg {...p}>
          <path d="M15 3h-3a4 4 0 0 0-4 4v3H5v4h3v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      )
    case 'youtube':
      return (
        <svg {...p}>
          <rect x="2.5" y="5" width="19" height="14" rx="4" />
          <path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg {...p}>
          <path d="M14 4v9.5a3.5 3.5 0 1 1-3-3.46" />
          <path d="M14 4a5 5 0 0 0 5 5" />
        </svg>
      )
    case 'whatsapp':
      return (
        <svg {...p}>
          <path d="M3 21l1.6-4.2A8 8 0 1 1 8 19.4z" />
          <path d="M8.8 9.2c0 3 2.4 5.4 5.4 5.4l1-1.3-2.1-1-.8.8a4.2 4.2 0 0 1-2-2l.8-.8-1-2.1z" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'email':
      return (
        <svg {...p}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3.5 7l8.5 6 8.5-6" />
        </svg>
      )
    case 'website':
    default:
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
        </svg>
      )
  }
}
