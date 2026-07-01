import { getCurrentUser } from '@/lib/auth'
import { listTiers } from '@/lib/memberships/repo'
import { getOwnerWorkbook } from '@/lib/workbooks/repo'
import WorkbookAdmin from './WorkbookAdmin'

export const dynamic = 'force-dynamic'

export default async function WorkbooksPage() {
  const user = await getCurrentUser()
  const workbook = user ? await getOwnerWorkbook(user.id) : null

  let tiers: { id: string; name: string }[] = []
  try {
    tiers = (await listTiers()).map(t => ({ id: t.id, name: t.name }))
  } catch {
    // tiers table not migrated yet — the picker just offers "free".
  }

  return (
    <div>
      <h1 className="font-label text-[11px] tracking-[4px] uppercase text-gold mb-2">Workbook</h1>
      <p className="font-body text-ash text-sm mb-8 max-w-xl leading-relaxed">
        The interactive workbook members open right inside your client portal. Upload the HTML file and choose who
        can open it. Members type into it and their answers are saved.
      </p>
      <WorkbookAdmin
        initialTitle={workbook?.title ?? 'Tuned In'}
        initialTierId={workbook?.tierId ?? ''}
        hasContent={workbook?.hasContent ?? false}
        updatedAt={workbook?.updatedAt ?? null}
        tiers={tiers}
      />
    </div>
  )
}
