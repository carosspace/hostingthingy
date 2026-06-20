// The (client) route group is the END-USER portal — separate from the owner
// (portal) area. It is intentionally NOT auth-gated here: each page (e.g. /me)
// decides what to show logged-out vs logged-in, so the magic-link login renders
// in-place. Theming is applied per-page (theme-aware roots), so this layout just
// passes children through.
export default function ClientAreaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
