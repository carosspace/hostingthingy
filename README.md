# Anima Temple — Platform

This is **the platform** ("the hosting thingy"): a web app where you — and later
other people — can host a website, connect a domain, and run a business (clients,
bookings, payments, courses, member portal) from one place.

> **This is a separate project from Divine Blueprint.** Divine Blueprint is a
> product/shop with its own repo. Anima Temple is the platform that can, one day,
> host sites like Divine Blueprint as customers. They share a brand, not a codebase.

## How "hosting" actually works here

A hosting platform has two halves:

- **Control plane (this app)** — the dashboard, accounts, domains screen, billing,
  the "add a website" button. This is the product we build and own.
- **Engine** — the hard plumbing (build code → run containers, issue SSL, route
  domains). We don't reinvent it; we drive **[Coolify](https://coolify.io)** (open
  source, self-hosted on Hetzner) through its API.

So we own the experience and the customer; Coolify does the server magic.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (auth + Postgres) ·
Docker (deploy to Hetzner via Coolify). Same proven stack as Divine Blueprint.

## What's here so far (foundation)

- Magic-link login (`/login`), session middleware, auth callback/sign-out
- A guarded portal: `/dashboard` (your future websites) and `/account`
- Brand theme, landing page
- Dockerfile + docker-compose + CI for self-hosting

## Run it locally

1. Copy `.env.local.example` → `.env.local` and fill in a **new** Supabase
   project's keys.
2. `npm install`
3. `npm run dev` → http://localhost:3000

See `ARCHITECTURE.md` for the bigger picture and roadmap.
