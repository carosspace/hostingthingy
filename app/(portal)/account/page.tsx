import { getCurrentUser } from '@/lib/auth'
import { listSites } from '@/lib/sites/store'
import { updateNameAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const user = await getCurrentUser()
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? ''

  let siteCount: number | null = null
  try {
    siteCount = (await listSites()).length
  } catch {
    siteCount = null
  }

  return (
    <div className="space-y-10 max-w-lg">
      <section>
        <p className="font-label text-[10px] tracking-[4px] uppercase text-gold/70 mb-3">Account</p>
        <h1 className="font-display text-4xl italic text-parchment">Your details</h1>
      </section>

      <section className="border border-gold/15 rounded-sm p-6">
        <p className="font-label text-[9px] tracking-[3px] uppercase text-gold/60 mb-3">Display name</p>
        <form action={updateNameAction} className="flex flex-col sm:flex-row gap-3">
          <input
            name="name"
            defaultValue={fullName}
            placeholder="Your name"
            className="flex-1 bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none placeholder:text-ash/40"
          />
          <button className="font-label text-[11px] tracking-[3px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-6 py-3 rounded-sm transition-colors">
            Save
          </button>
        </form>
      </section>

      <section className="border border-gold/15 rounded-sm divide-y divide-gold/10">
        <div className="px-5 py-4">
          <p className="font-label text-[9px] tracking-[3px] uppercase text-gold/60 mb-1">Email</p>
          <p className="font-body text-parchment break-words">{user?.email}</p>
        </div>
        <div className="px-5 py-4">
          <p className="font-label text-[9px] tracking-[3px] uppercase text-gold/60 mb-1">Websites</p>
          <p className="font-body text-parchment">{siteCount ?? '—'}</p>
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
