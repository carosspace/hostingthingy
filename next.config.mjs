/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle so the platform runs in a small Docker image
  // on our own infrastructure (Hetzner/Coolify).
  output: "standalone",
  // Don't auto-redirect trailing slashes. Next's default would 308 /planner/ ->
  // /planner, which fights the middleware rule that serves the static Planner PWA
  // at /planner/ (it 308s /planner -> /planner/) and creates a redirect loop.
  // With this off, the middleware is the sole authority on those paths.
  skipTrailingSlashRedirect: true,
  experimental: {
    // A canvas page is saved as one JSON server-action body and can carry many
    // embedded images (background photos, slideshows, the uploads library). The
    // default Server Actions body limit is 1 MB — raise it so image-heavy pages
    // persist. The editor also guards against oversized saves before posting.
    serverActions: { bodySizeLimit: "12mb" },
    // node-ical (used SERVER-SIDE to parse owners' external calendars for "block busy
    // times") pulls in CJS/Temporal deps that break when webpack bundles them. Keep it
    // external so it's required from node_modules at runtime instead. It's loaded LAZILY
    // (lib/bookings/external-calendar.ts) so a load failure degrades gracefully.
    serverComponentsExternalPackages: ["node-ical"],
    // Force node-ical + its deps into the output:'standalone' trace for the only route that
    // loads it at runtime (the public booking page), so the lazy import resolves on the slim
    // server image. (Belt-and-suspenders — the dynamic import is normally traced anyway.)
    outputFileTracingIncludes: {
      "/book/[slug]": [
        "./node_modules/node-ical/**",
        "./node_modules/rrule-temporal/**",
        "./node_modules/temporal-polyfill/**",
      ],
    },
  },
};

export default nextConfig;
