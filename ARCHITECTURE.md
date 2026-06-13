# Anima Temple Platform — Architecture

> Living document. The platform that hosts websites and runs businesses — for us
> first, for others later. Separate from the Divine Blueprint product.

## The shape of it

```
                  ┌─────────────────────────────┐
   Internet ────▶ │ Cloudflare: DNS · SSL edge · │
                  │ CDN · WAF (free tier)        │
                  └──────────────┬──────────────┘
                                 ▼
        ┌──────────────────────────────────────────────┐
        │  Anima Temple (this Next.js app) = CONTROL    │
        │  PLANE — accounts, dashboard, domains, sites, │
        │  billing, portal. The product we own.         │
        └───────────────┬──────────────────────────────┘
                        │ calls the engine's API
                        ▼
        ┌──────────────────────────────────────────────┐
        │  Coolify on Hetzner = ENGINE                  │
        │  builds images · runs containers · issues SSL │
        │  · manages domains & databases · backups      │
        └───────────────┬──────────────────────────────┘
                        ▼
        ┌──────────────────────────────────────────────┐
        │  Hosted customer sites (incl. one day,        │
        │  Divine Blueprint as a tenant)                │
        └──────────────────────────────────────────────┘
```

## Principles

1. **Own the control plane; rent the engine.** Build the dashboard/brand/billing;
   let Coolify do Docker/SSL/DNS.
2. **One modular monolith** (Next.js + Postgres). No microservices until something
   actually hurts.
3. **Design multi-tenant from day one** (carry `tenant_id`), run single-tenant
   until a second real customer pays.
4. **EU-hosted, cheap, solo-maintainable.** Hetzner + Cloudflare. GDPR by default.

## Milestones

- **P0 — Foundation (done):** project scaffold, magic-link auth, guarded portal
  shell (`/dashboard`, `/account`), brand, Docker + CI. *Needs a new Supabase
  project + envs to run.*
- **P1 — Accounts & tenancy:** profiles, organisations/tenants, roles, the
  `tenant_id` model.
- **P2 — Connect the engine:** integrate Coolify's API; "Add a website" creates a
  real project; show deploy status.
- **P3 — Domains & SSL:** attach a custom domain (Cloudflare API) with automatic
  certificates.
- **P4 — Billing:** Stripe — plans, metered usage, customer billing.
- **P5 — Business suite:** CRM, bookings, courses, member portal (reusing patterns
  proven in Divine Blueprint).
- **P6 — Open to others:** onboarding, white-label, self-serve signup.

## Relationship to Divine Blueprint

Divine Blueprint stays its own repo/product. Later it can become a **tenant**
hosted/managed by this platform — but the two never share a codebase. Brand family,
separate buildings.
