import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const user = await getCurrentUser()

  return (
    <div className="space-y-10 max-w-lg">
      <section>
        <p className="font-label text-[10px] tracking-[4px] uppercase text-gold/70 mb-3">Account</p>
        <h1 className="font-display text-4xl italic text-parchment">Your details</h1>
      </section>

      <section className="border border-gold/15 rounded-sm divide-y divide-gold/10">
        <div className="px-5 py-4">
          <p className="font-label text-[9px] tracking-[3px] uppercase text-gold/60 mb-1">Email</p>
          <p className="font-body text-parchment break-words">{user?.email}</p>
        </div>
        <div className="px-5 py-4">
          <p className="font-label text-[9px] tracking-[3px] uppercase text-gold/60 mb-1">Member since</p>
          <p className="font-body text-parchment">
            {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
          </p>
        </div>
      </section>

      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="font-label text-[10px] tracking-[3px] uppercase text-ash hover:text-gold transition-colors"
        >
          Sign out →
        </button>
      </form>
    </div>
  )
}
