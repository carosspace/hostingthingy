import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// The old form-based editor has been superseded by the visual editor at
// /design (which it would otherwise silently strip structured fields from on
// save). Always send people to the visual editor.
export default function EditSitePage({ params }: { params: { id: string } }) {
  redirect(`/sites/${params.id}/design`)
}
