import { getCurrentUser } from '@/lib/auth'
import { listResources, type Resource } from '@/lib/resources/repo'
import { listTiers, type Tier } from '@/lib/memberships/repo'
import { getOwnerWorkbook, listCodes, listAccess } from '@/lib/workbooks/repo'
import { deleteResourceAction } from './actions'
import ResourceUploader from './ResourceUploader'
import WorkbookAdmin from '../workbooks/WorkbookAdmin'

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
  const user = await getCurrentUser()

  let resources: Resource[] = []
  let tiers: Tier[] = []
  let dbError = false
  try {
    resources = await listResources()
  } catch {
    // resources table not migrated yet → show the switch-on notice for FILES only.
    dbError = true
  }
  try {
    tiers = await listTiers()
  } catch {
    tiers = []
  }

  // The interactive workbook lives here too now (its own table/migration 023, independent
  // of the file-resources table) — best-effort so a missing workbook table never breaks the page.
  const workbook = user ? await getOwnerWorkbook(user.id).catch(() => null) : null
  const codes = user ? await listCodes(user.id).catch(() => []) : []
  const access = user ? await listAccess(user.id).catch(() => []) : []

  const tierName = (id: string | null): string | null => {
    if (!id) return null
    return tiers.find(t => t.id === id)?.name ?? null
  }

  return (
    <div className="space-y-12 max-w-2xl">
      <section>
        <h1 className="font-display text-4xl italic text-parchment">Resources</h1>
        <p className="font-body text-ash mt-2 text-sm">
          Everything your clients get in one place — downloads (worksheets, audio, PDFs) and your interactive
          workbook. Mark each as free for all signed-in clients, or members-only to gate it behind a tier.
        </p>
      </section>

      {/* ---- Downloads: upload + library (or the migration notice) ------- */}
      {dbError ? (
        <section>
          <h2 className="font-label text-[11px] tracking-[4px] uppercase text-gold mb-4">Downloads</h2>
          <div className="border border-gold/15 rounded-sm p-8 text-center">
            <p className="font-body text-parchment">Almost there — switch on file downloads.</p>
            <p className="font-body text-ash/60 text-sm mt-2">
              Run migration <code className="text-gold/70">022_resources.sql</code> in Supabase, then refresh.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section>
            <h2 className="font-label text-[11px] tracking-[4px] uppercase text-gold mb-4">Add a download</h2>
            <ResourceUploader tiers={tiers.map(t => ({ id: t.id, name: t.name }))} />
          </section>

          <section>
            <h2 className="font-label text-[11px] tracking-[4px] uppercase text-gold mb-4">Library</h2>
            <div className="space-y-2">
              {resources.length === 0 && (
                <p className="font-body text-ash/60 text-sm">No downloads yet — upload the first one above.</p>
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
        </>
      )}

      {/* ---- Interactive workbook (was a separate page) ----------------- */}
      <section className="border-t border-gold/10 pt-10">
        <h2 className="font-label text-[11px] tracking-[4px] uppercase text-gold mb-2">Interactive workbook</h2>
        <p className="font-body text-ash text-sm mb-5 max-w-xl leading-relaxed">
          The workbook clients open right inside their portal — it appears alongside their downloads under Resources.
          Upload the HTML, then gift it to a client or hand out unlock codes to buyers (website, Etsy, anywhere). It
          opens in their portal, saved to their own account.
        </p>
        <WorkbookAdmin
          initialTitle={workbook?.title ?? 'Tuned In'}
          hasContent={workbook?.hasContent ?? false}
          updatedAt={workbook?.updatedAt ?? null}
          initialCodes={codes}
          initialAccess={access}
        />
      </section>
    </div>
  )
}
