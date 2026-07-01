import { getCurrentUser } from '@/lib/auth'
import { getOwnerWorkbook, listCodes } from '@/lib/workbooks/repo'
import WorkbookAdmin from './WorkbookAdmin'

export const dynamic = 'force-dynamic'

export default async function WorkbooksPage() {
  const user = await getCurrentUser()
  const workbook = user ? await getOwnerWorkbook(user.id) : null
  const codes = user ? await listCodes(user.id) : []

  return (
    <div>
      <h1 className="font-label text-[11px] tracking-[4px] uppercase text-gold mb-2">Workbook</h1>
      <p className="font-body text-ash text-sm mb-8 max-w-xl leading-relaxed">
        The interactive workbook members open right inside your client portal. Upload the HTML, then hand out unlock
        codes to buyers (on your site, Etsy, anywhere). They redeem a code in the portal and it opens for them, saved
        to their own account.
      </p>
      <WorkbookAdmin
        initialTitle={workbook?.title ?? 'Tuned In'}
        hasContent={workbook?.hasContent ?? false}
        updatedAt={workbook?.updatedAt ?? null}
        initialCodes={codes}
      />
    </div>
  )
}
