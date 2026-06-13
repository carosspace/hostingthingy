# syntax=docker/dockerfile:1
#
# Production image for the Anima Temple platform (Next.js, standalone output).
# Multi-stage so the final image is small and contains no build tooling.

# ----- Base -----
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ----- Dependencies (cached unless package*.json changes) -----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ----- Builder -----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# IMPORTANT: NEXT_PUBLIC_* values are inlined into the bundle at BUILD time,
# so they must be present here — not only at runtime. Pass the real values as
# build args (Coolify: "Build Variables"; compose: the `args:` block).
# The placeholders below only keep CI / local test builds green.
ARG NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
ARG NEXT_PUBLIC_SITE_URL=https://placeholder.local
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ----- Runner (final image) -----
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run as a non-root user.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy only what the standalone server needs.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# server.js is produced by Next.js standalone output.
CMD ["node", "server.js"]
