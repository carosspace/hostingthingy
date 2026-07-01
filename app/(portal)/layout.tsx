import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { unreadMessageCount } from '@/lib/sites/messages'

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
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/dashboard" className="font-label text-[11px] tracking-[4px] uppercase text-gold">
            Anima&nbsp;Temple
          </Link>
          <nav className="flex items-center gap-6 font-label text-[10px] tracking-[3px] uppercase">
            <Link href="/dashboard" className="text-ash hover:text-gold transition-colors">Dashboard</Link>
            <Link href="/bookings" className="text-ash hover:text-gold transition-colors">Bookings</Link>
            <Link href="/courses" className="text-ash hover:text-gold transition-colors">Courses</Link>
            <Link href="/memberships" className="text-ash hover:text-gold transition-colors">Memberships</Link>
            <Link href="/resources" className="text-ash hover:text-gold transition-colors">Resources</Link>
            <Link href="/workbooks" className="text-ash hover:text-gold transition-colors">Workbook</Link>
            <Link href="/messages" className="text-ash hover:text-gold transition-colors">
              Messages
              {unread > 0 && (
                <span className="ml-1.5 inline-block bg-gold text-background rounded-full px-1.5 py-px text-[9px] leading-none align-middle">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
            <form action="/auth/signout" method="post">
              <button type="submit" className="font-label text-[10px] tracking-[3px] uppercase text-ash hover:text-gold transition-colors">
                Sign&nbsp;out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-12">{children}</main>
    </div>
  )
}
