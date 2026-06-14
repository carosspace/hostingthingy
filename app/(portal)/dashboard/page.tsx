import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listSites } from "@/lib/sites/store";
import type { Site } from "@/lib/sites/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  let sites: Site[] = [];
  let dbError = false;
  try {
    sites = await listSites();
  } catch {
    dbError = true;
  }
  const recent = sites.slice(0, 3);

  return (
    <div className="space-y-14">
      <section>
        <p className="font-label text-[10px] tracking-[4px] uppercase text-gold/70 mb-3">Welcome</p>
        <h1 className="font-display text-4xl italic text-parchment break-words">{user?.email}</h1>
        <p className="font-body text-ash mt-3">Your temple. Let&apos;s put your work into the world.</p>
      </section>

      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-label text-[11px] tracking-[4px] uppercase text-gold">
            Your websites{!dbError && sites.length > 0 ? ` · ${sites.length}` : ""}
          </h2>
          <Link
            href="/sites"
            className="font-label text-[10px] tracking-[3px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-4 py-2 rounded-sm transition-colors"
          >
            + Add a website
          </Link>
        </div>

        {dbError ? (
          <div className="border border-gold/15 rounded-sm p-8 text-center">
            <p className="font-body text-parchment">Almost there — connect your database.</p>
            <p className="font-body text-ash/60 text-sm mt-2">See SETUP.md to finish wiring it up.</p>
          </div>
        ) : recent.length === 0 ? (
          <Link
            href="/sites"
            className="block border border-gold/15 hover:border-gold/40 rounded-sm p-10 text-center transition-colors"
          >
            <p className="font-body text-ash">Create your first website →</p>
          </Link>
        ) : (
          <div className="space-y-3">
            {recent.map(site => (
              <Link
                key={site.id}
                href={`/sites/${site.id}`}
                className="flex items-center justify-between gap-4 border border-gold/15 hover:border-gold/40 rounded-sm p-4 transition-colors"
              >
                <span className="font-body text-parchment">{site.name}</span>
                <span className="font-label text-[9px] tracking-[2px] uppercase text-gold/60">{site.status}</span>
              </Link>
            ))}
            {sites.length > recent.length && (
              <Link
                href="/sites"
                className="block text-center font-label text-[10px] tracking-[3px] uppercase text-ash hover:text-gold transition-colors pt-1"
              >
                View all {sites.length} →
              </Link>
            )}
          </div>
        )}
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
