import Link from "next/link";

export default function NotFound() {
  return (
    <main className="bg-background min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <p className="font-label text-[10px] tracking-[5px] uppercase text-gold mb-6">Hosting Thingy</p>
      <h1 className="font-display text-5xl italic text-parchment">Lost in the stars</h1>
      <p className="font-body text-ash mt-4">This page doesn&rsquo;t exist.</p>
      <Link
        href="/"
        className="mt-8 font-label text-[11px] tracking-[4px] uppercase bg-gold text-background hover:bg-goldLight px-8 py-3 rounded-sm transition-colors"
      >
        Return home →
      </Link>
    </main>
  );
}
