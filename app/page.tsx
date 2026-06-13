import Link from "next/link";

function Mark({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="block mx-auto">
      <circle cx="30" cy="30" r="27" stroke="#c9a84c" strokeWidth="1" />
      <circle cx="30" cy="30" r="18" stroke="#c9a84c" strokeWidth="0.5" opacity="0.5" />
      <circle cx="30" cy="30" r="3" fill="#c9a84c" />
      <line x1="30" y1="3" x2="30" y2="13" stroke="#c9a84c" strokeWidth="0.75" />
      <line x1="30" y1="47" x2="30" y2="57" stroke="#c9a84c" strokeWidth="0.75" />
      <line x1="3" y1="30" x2="13" y2="30" stroke="#c9a84c" strokeWidth="0.75" />
      <line x1="47" y1="30" x2="57" y2="30" stroke="#c9a84c" strokeWidth="0.75" />
    </svg>
  );
}

const FEATURES = [
  { title: "Host your website", body: "Put your site online with your own domain and automatic HTTPS — no servers to wrangle." },
  { title: "Run your business", body: "Clients, bookings, payments, courses and a member portal, all in one calm place." },
  { title: "Own your space", body: "Your data lives in Europe, on infrastructure you control. Built to grow with you." },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="px-6 pt-24 pb-20 text-center max-w-3xl mx-auto">
        <Mark size={64} />
        <p className="font-label text-[11px] tracking-[6px] text-gold uppercase mt-6">Anima Temple</p>
        <h1 className="font-display text-5xl md:text-6xl italic text-parchment mt-6 leading-tight">
          Sacred hosting for your work
        </h1>
        <p className="font-body text-ash text-lg md:text-xl mt-6 leading-relaxed">
          Host your website, connect your domain, and run your whole practice from one
          quiet, beautiful place — yours, and one day your clients&apos; too.
        </p>
        <div className="flex items-center justify-center gap-4 mt-10">
          <Link
            href="/login"
            className="font-label text-[11px] tracking-[4px] uppercase bg-gold text-background hover:bg-goldLight transition-colors px-8 py-3 rounded-sm"
          >
            Enter your temple →
          </Link>
        </div>
      </section>

      {/* Gold divider */}
      <div className="flex items-center justify-center gap-4 mb-16">
        <div className="h-px bg-gold/20 w-16" />
        <span className="text-gold/50 text-xs">✦</span>
        <div className="h-px bg-gold/20 w-16" />
      </div>

      {/* Features */}
      <section className="px-6 pb-28 max-w-4xl mx-auto grid md:grid-cols-3 gap-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="border border-gold/15 rounded-sm p-6">
            <h2 className="font-display text-2xl italic text-parchment mb-3">{f.title}</h2>
            <p className="font-body text-ash text-sm leading-relaxed">{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
