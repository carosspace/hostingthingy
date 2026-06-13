import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Platform dashboard. The list of sites is empty until we wire the hosting
// engine (Coolify) in a later milestone — this is the shell it slots into.
export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-14">
      <section>
        <p className="font-label text-[10px] tracking-[4px] uppercase text-gold/70 mb-3">Welcome</p>
        <h1 className="font-display text-4xl italic text-parchment break-words">{user?.email}</h1>
        <p className="font-body text-ash mt-3">Your temple. Let&apos;s put your work into the world.</p>
      </section>

      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-label text-[11px] tracking-[4px] uppercase text-gold">Your websites</h2>
          <button
            disabled
            title="Coming soon"
            className="font-label text-[10px] tracking-[3px] uppercase border border-gold/30 text-gold/50 px-4 py-2 rounded-sm cursor-not-allowed"
          >
            + Add a website
          </button>
        </div>
        <div className="border border-gold/15 rounded-sm p-10 text-center">
          <p className="font-body text-ash">No websites yet.</p>
          <p className="font-body text-ash/50 text-sm mt-2">
            Soon you&apos;ll connect a domain and deploy a site here in a few clicks.
          </p>
        </div>
      </section>

      <section>
        <h2 className="font-label text-[11px] tracking-[4px] uppercase text-gold mb-5">Coming to your temple</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {["Domains & SSL", "One-click deploys", "Databases", "Analytics"].map((f) => (
            <div key={f} className="border border-gold/10 rounded-sm p-5">
              <p className="font-body text-ash">{f}</p>
              <p className="font-label text-[9px] tracking-[2px] uppercase text-gold/40 mt-2">Soon</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
