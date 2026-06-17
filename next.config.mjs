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
  },
};

export default nextConfig;
