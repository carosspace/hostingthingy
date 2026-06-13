/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle so the platform runs in a small Docker image
  // on our own infrastructure (Hetzner/Coolify).
  output: "standalone",
};

export default nextConfig;
