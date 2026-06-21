import { listTiers, listMemberships, type Tier, type Member } from '@/lib/memberships/repo'
import {
  createTierAction,
  updateTierAction,
  deleteTierAction,
  grantMembershipAction,
  revokeMembershipAction,
} from './actions'

export const dynamic = 'force-dynamic'

const input =
  'w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-2.5 rounded-sm outline-none placeholder:text-ash/40'

export default async function MembershipsPage() {
  let tiers: Tier[] = []
  let members: Member[] = []
  let dbError = false
  try {
    tiers = await listTiers()
    members = await listMemberships()
  } catch {
    // memberships tables not migrated yet → show the switch-on notice.
    dbError = true
  }

  if (dbError) {
    return (
      <div className="space-y-6 max-w-xl">
        <h1 className="font-display text-4xl italic text-parchment">Memberships</h1>
        <div className="border border-gold/15 rounded-sm p-8 text-center">
          <p className="font-body text-parchment">Almost there — switch on memberships.</p>
          <p className="font-body text-ash/60 text-sm mt-2">
            Run migration <code className="text-gold/70">015_memberships.sql</code> in Supabase, then refresh.
          </p>
        </div>
      </div>
    )
  }

  // Format the granted date compactly (e.g. "20 Jun 2026").
  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      return ''
    }
  }

  return (
    <div className="space-y-12 max-w-2xl">
      <section>
        <h1 className="font-display text-4xl italic text-parchment">Memberships</h1>
        <p className="font-body text-ash mt-2 text-sm">
          Create circles, grant clients access by email, and gate courses to a tier.
        </p>
      </section>

      {/* ---- Tiers ------------------------------------------------------ */}
      <section>
        <h2 className="font-label text-[11px] tracking-[4px] uppercase text-gold mb-4">Tiers</h2>

        <div className="space-y-3 mb-6">
          {tiers.length === 0 && (
            <p className="font-body text-ash/60 text-sm">No tiers yet — create the first one below.</p>
          )}
          {tiers.map(t => (
            <div key={t.id} className="border border-gold/10 rounded-sm p-4">
              <form action={updateTierAction} className="space-y-3">
                <input type="hidden" name="id" value={t.id} />
                <input name="name" required defaultValue={t.name} placeholder="Tier name" className={input} />
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={t.description ?? ''}
                  placeholder="Short description (optional)"
                  className={`${input} resize-none`}
                />
                <button className="font-label text-[10px] tracking-[2px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-5 py-2 rounded-sm">
                  Save tier
                </button>
              </form>
              <form action={deleteTierAction} className="mt-2">
                <input type="hidden" name="id" value={t.id} />
                <button className="font-label text-[9px] tracking-[2px] uppercase text-red-400 hover:text-red-300">
                  Delete tier
                </button>
              </form>
            </div>
          ))}
        </div>

        {/* New tier */}
        <form action={createTierAction} className="border border-gold/15 rounded-sm p-5 space-y-3">
          <p className="font-label text-[10px] tracking-[2px] uppercase text-gold/70">New tier</p>
          <input name="name" required placeholder="Tier name (e.g. Inner Circle)" className={input} />
          <textarea name="description" rows={2} placeholder="Short description (optional)" className={`${input} resize-none`} />
          <button className="font-label text-[11px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-6 py-2.5 rounded-sm transition-colors">
            Create tier
          </button>
        </form>
      </section>

      {/* ---- Members --------------------------------------------------- */}
      <section>
        <h2 className="font-label text-[11px] tracking-[4px] uppercase text-gold mb-4">Members</h2>

        {/* Grant membership */}
        <form action={grantMembershipAction} className="border border-gold/15 rounded-sm p-5 space-y-3 mb-6">
          <p className="font-label text-[10px] tracking-[2px] uppercase text-gold/70">Grant membership</p>
          <input
            name="email"
            type="email"
            required
            placeholder="Client email"
            className={input}
          />
          {tiers.length === 0 ? (
            <p className="font-body text-ash/60 text-sm">Create a tier first to grant memberships.</p>
          ) : (
            <select name="tierId" required defaultValue="" className={`${input} appearance-none`}>
              <option value="" disabled>
                Choose a tier…
              </option>
              {tiers.map(t => (
                <option key={t.id} value={t.id} className="bg-surface text-parchment">
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <button
            disabled={tiers.length === 0}
            className="font-label text-[11px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-6 py-2.5 rounded-sm transition-colors disabled:opacity-40"
          >
            Grant membership
          </button>
        </form>

        {/* Current memberships */}
        <div className="space-y-2">
          {members.length === 0 && (
            <p className="font-body text-ash/60 text-sm">No memberships granted yet.</p>
          )}
          {members.map(m => (
            <div
              key={m.id}
              className="border border-gold/10 rounded-sm p-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="font-body text-parchment truncate">{m.clientEmail}</p>
                <p className="font-body text-ash/60 text-sm mt-0.5">
                  <span className="text-gold/70">{m.tierName}</span>
                  {m.createdAt ? ` · granted ${fmtDate(m.createdAt)}` : ''}
                </p>
              </div>
              <form action={revokeMembershipAction} className="shrink-0">
                <input type="hidden" name="id" value={m.id} />
                <button className="font-label text-[9px] tracking-[2px] uppercase text-red-400 hover:text-red-300">
                  Revoke
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
