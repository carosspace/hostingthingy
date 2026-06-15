import Link from 'next/link'
import { getSite } from '@/lib/sites/store'
import { THEMES } from '@/lib/sites/types'
import { saveSiteContentAction, generateSiteAction } from '../../actions'

export const dynamic = 'force-dynamic'

export default async function EditSitePage({ params }: { params: { id: string } }) {
  const site = await getSite(params.id)

  if (!site) {
    return (
      <div className="space-y-6">
        <p className="font-body text-ash">This website couldn&rsquo;t be found.</p>
        <Link href="/sites" className="font-label text-[10px] tracking-[3px] uppercase text-gold hover:text-goldLight">
          ← Back to sites
        </Link>
      </div>
    )
  }

  const c = site.content
  const s = c?.sections ?? []
  const input =
    'w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none placeholder:text-ash/40'
  const label = 'font-label text-[9px] tracking-[3px] uppercase text-gold/60 block mb-2'

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <Link href={`/sites/${site.id}`} className="font-label text-[10px] tracking-[3px] uppercase text-ash hover:text-gold transition-colors">
          ← Back to {site.name}
        </Link>
        <h1 className="font-display text-4xl italic text-parchment mt-4">Edit your website</h1>
        <p className="font-body text-ash/70 text-sm mt-2">Fill this in and save — it publishes instantly to your site address.</p>
      </div>

      <section className="border border-gold/30 bg-gold/5 rounded-sm p-6">
        <p className="font-label text-[10px] tracking-[3px] uppercase text-gold mb-2">✨ Build with AI</p>
        <p className="font-body text-ash/70 text-sm mb-4">
          Describe your business in a sentence or two and Claude will write your whole website. You can edit it after.
        </p>
        <form action={generateSiteAction} className="space-y-3">
          <input type="hidden" name="id" value={site.id} />
          <textarea
            name="description"
            required
            rows={3}
            placeholder="e.g. I run a spiritual wellness practice called Anima Temple — Reiki, soul readings, and meditation circles in Lisbon."
            className={`${input} resize-none`}
          />
          <button className="font-label text-[11px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-6 py-3 rounded-sm transition-colors">
            Generate with AI ✨
          </button>
        </form>
      </section>

      <form action={saveSiteContentAction} className="space-y-6">
        <input type="hidden" name="id" value={site.id} />

        <div>
          <label className={label}>Headline</label>
          <input name="headline" defaultValue={c?.headline ?? ''} placeholder={site.name} className={input} />
        </div>
        <div>
          <label className={label}>Subheadline</label>
          <input name="subheadline" defaultValue={c?.subheadline ?? ''} placeholder="A short line about what you offer" className={input} />
        </div>

        <div>
          <label className={label}>Theme</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.keys(THEMES) as Array<keyof typeof THEMES>).map(key => {
              const t = THEMES[key]
              return (
                <label key={key} className="cursor-pointer">
                  <input type="radio" name="theme" value={key} defaultChecked={(c?.theme ?? 'sand') === key} className="peer sr-only" />
                  <div className="border border-gold/20 peer-checked:border-gold peer-checked:bg-gold/10 rounded-sm p-3 flex items-center gap-2 transition-colors">
                    <span className="w-4 h-4 rounded-full shrink-0" style={{ background: t.accent, border: `1px solid ${t.bg}` }} />
                    <span className="font-body text-parchment text-sm">{t.label}</span>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        {[0, 1, 2].map(i => (
          <div key={i} className="border border-gold/10 rounded-sm p-5 space-y-3">
            <p className="font-label text-[9px] tracking-[3px] uppercase text-gold/50">Section {i + 1}</p>
            <input name={`s${i + 1}h`} defaultValue={s[i]?.heading ?? ''} placeholder="Section heading" className={input} />
            <textarea name={`s${i + 1}b`} defaultValue={s[i]?.body ?? ''} placeholder="Write something…" rows={4} className={`${input} resize-none`} />
          </div>
        ))}

        <div>
          <label className={label}>Contact email (optional)</label>
          <input name="contactEmail" type="email" defaultValue={c?.contactEmail ?? ''} placeholder="hello@animatemple.com" className={input} />
        </div>

        <div className="flex items-center gap-4">
          <button className="font-label text-[11px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-6 py-3 rounded-sm transition-colors">
            Save &amp; publish
          </button>
          {site.status === 'live' && (
            <a href={`/s/${site.slug}`} target="_blank" rel="noreferrer" className="font-label text-[10px] tracking-[3px] uppercase text-gold hover:text-goldLight">
              View live ↗
            </a>
          )}
        </div>
      </form>
    </div>
  )
}
