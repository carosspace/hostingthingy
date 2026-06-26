/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle so the platform runs in a small Docker image
  // on our own infrastructure (Hetzner/Coolify).
  output: "standalone",
  experimental: {
    // A canvas page is saved as one JSON server-action body and can carry many
    // embedded images (background photos, slideshows, the uploads library). The
    // default Server Actions body limit is 1 MB — raise it so image-heavy pages
    // persist. The editor also guards against oversized saves before posting.
    serverActions: { bodySizeLimit: "12mb" },
    // node-ical (used SERVER-SIDE to parse owners' external calendars for "block busy
    // times") pulls in CJS deps (rrule/luxon/etc.) that break when webpack bundles them.
    // Keep it external so it's required from node_modules at runtime instead.
    serverComponentsExternalPackages: ["node-ical"],
  },
};

export default nextConfig;
