import { listResources, type Resource } from '@/lib/resources/repo'
import { listTiers, type Tier } from '@/lib/memberships/repo'
import { deleteResourceAction } from './actions'
import ResourceUploader from './ResourceUploader'

export const dynamic = 'force-dynamic'

// Human-readable file size, e.g. "2.4 MB".
function fmtSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)} ${units[i]}`
}

export default async function ResourcesPage() {
  let resources: Resource[] = []
  let tiers: Tier[] = []
  let dbError = false
  try {
    resources = await listResources()
  } catch {
    // resources table not migrated yet → show the switch-on notice.
    dbError = true
  }
  // Tiers are best-effort: the access picker just shows "Free" if tiers aren't available.
  try {
    tiers = await listTiers()
  } catch {
    tiers = []
  }

  if (dbError) {
    return (
      <div className="space-y-6 max-w-xl">
        <h1 className="font-display text-4xl italic text-parchment">Resources</h1>
        <div className="border border-gold/15 rounded-sm p-8 text-center">
          <p className="font-body text-parchment">Almost there — switch on resources.</p>
          <p className="font-body text-ash/60 text-sm mt-2">
            Run migration <code className="text-gold/70">022_resources.sql</code> in Supabase, then refresh.
          </p>
        </div>
      </div>
    )
  }

  const tierName = (id: string | null): string | null => {
    if (!id) return null
    return tiers.find(t => t.id === id)?.name ?? null
  }

  return (
    <div className="space-y-12 max-w-2xl">
      <section>
        <h1 className="font-display text-4xl italic text-parchment">Resources</h1>
        <p className="font-body text-ash mt-2 text-sm">
          Share downloads with your clients — worksheets, audio, PDFs and more. Mark each as free for all
          signed-in clients, or members-only to gate it behind a tier.
        </p>
      </section>

      {/* ---- Upload ----------------------------------------------------- */}
      <section>
        <h2 className="font-label text-[11px] tracking-[4px] uppercase text-gold mb-4">Add a resource</h2>
        <ResourceUploader tiers={tiers.map(t => ({ id: t.id, name: t.name }))} />
      </section>

      {/* ---- Library --------------------------------------------------- */}
      <section>
        <h2 className="font-label text-[11px] tracking-[4px] uppercase text-gold mb-4">Library</h2>
        <div className="space-y-2">
          {resources.length === 0 && (
            <p className="font-body text-ash/60 text-sm">No resources yet — upload the first one above.</p>
          )}
          {resources.map(r => {
            const tn = tierName(r.tierId)
            const size = fmtSize(r.fileSize)
            return (
              <div
                key={r.id}
                className="border border-gold/10 rounded-sm p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-body text-parchment truncate">{r.title}</p>
                  {r.description && (
                    <p className="font-body text-ash/60 text-sm mt-0.5 truncate">{r.description}</p>
                  )}
                  <p className="font-body text-ash/50 text-xs mt-1">
                    <span className={tn ? 'text-gold/70' : 'text-emerald-400/80'}>
                      {tn ? `Members only · ${tn}` : 'Free'}
                    </span>
                    {r.fileName ? ` · ${r.fileName}` : ''}
                    {size ? ` · ${size}` : ''}
                  </p>
                </div>
                <form action={deleteResourceAction} className="shrink-0">
                  <input type="hidden" name="id" value={r.id} />
                  <button className="font-label text-[9px] tracking-[2px] uppercase text-red-400 hover:text-red-300">
                    Delete
                  </button>
                </form>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
