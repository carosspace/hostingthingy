import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { unreadMessageCount } from '@/lib/sites/messages'
import PortalNav from './PortalNav'

// Every page inside the (portal) group is gated here: no session → /login.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  let unread = 0
  try {
    unread = await unreadMessageCount()
  } catch {
    // messages table not migrated yet — show no badge
  }

  return (
    <div className="bg-background min-h-screen text-parchment">
      <header className="border-b border-gold/10">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between gap-8">
          <Link href="/dashboard" className="font-label text-[11px] tracking-[4px] uppercase text-gold whitespace-nowrap">
            Anima&nbsp;Temple
          </Link>
          <PortalNav unread={unread} />
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-12">{children}</main>
    </div>
  )
}
