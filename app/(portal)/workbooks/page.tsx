import { redirect } from 'next/navigation'

// The workbook now lives inside Resources (one place for downloads + the workbook).
// This route is kept only so old bookmarks/links land in the right spot.
export default function WorkbooksPage() {
  redirect('/resources')
}
