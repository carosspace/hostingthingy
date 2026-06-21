import Link from 'next/link'
import { getSite } from '@/lib/sites/store'
import AiWizard from './AiWizard'

export const dynamic = 'force-dynamic'

export default async function AiPage({ params }: { params: { id: string } }) {
  const site = await getSite(params.id)

  if (!site) {
    return (
      <div className="space-y-6">
        <p className="font-body text-ash">This website couldn&rsquo;t be found.</p>
        <Link href="/dashboard" className="font-label text-[10px] tracking-[3px] uppercase text-gold hover:text-goldLight">
          ← Dashboard
        </Link>
      </div>
    )
  }

  const hasContent = Boolean(site.content && (site.content.headline || site.content.pages?.length))

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href={`/sites/${site.id}`} className="font-label text-[10px] tracking-[3px] uppercase text-ash hover:text-gold transition-colors">
          ← {site.name}
        </Link>
        <h1 className="font-display text-3xl italic text-parchment mt-2">Build with AI</h1>
        <p className="font-body text-ash/70 text-sm mt-2">
          Answer a few quick questions and the AI writes your whole site — then you refine it in the visual editor.
        </p>
      </div>

      <AiWizard siteId={site.id} siteName={site.name} hasContent={hasContent} />
    </div>
  )
}
