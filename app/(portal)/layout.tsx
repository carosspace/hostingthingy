import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

// Every page inside the (portal) group is gated here: no session → /login.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="bg-background min-h-screen text-parchment">
      <header className="border-b border-gold/10">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/dashboard" className="font-label text-[11px] tracking-[4px] uppercase text-gold">
            Anima&nbsp;Temple
          </Link>
          <nav className="flex items-center gap-6 font-label text-[10px] tracking-[3px] uppercase">
            <Link href="/dashboard" className="text-ash hover:text-gold transition-colors">Dashboard</Link>
            <Link href="/account" className="text-ash hover:text-gold transition-colors">Account</Link>
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
