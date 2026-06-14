# 👋 Switching on Hosting Thingy (when you're ready)

Everything is built. To actually run and see it, the platform needs its **own
database** — a brand-new Supabase project, separate from Divine Blueprint. About
10 minutes, no coding. Do it whenever; there's no rush.

> Until this is done, the code is complete and verified, it just has nowhere to
> save data yet. (The public `/preview` page works without any of this — it's the
> browser-only taste.)

## 1 · Make a new Supabase project
<https://supabase.com/dashboard> → **New project** → name it `hosting-thingy`.
**Important:** this is a NEW project, not the Divine Blueprint one.

## 2 · Copy 3 keys
In that project → **Settings ⚙️ → API**, copy:
- **Project URL**
- **anon public** key
- **service_role** key

## 3 · Put them in the project
Copy `.env.local.example` to a new file named `.env.local`, and fill in:
```
NEXT_PUBLIC_SUPABASE_URL=...(Project URL)
NEXT_PUBLIC_SUPABASE_ANON_KEY=...(anon public)
SUPABASE_SERVICE_ROLE_KEY=...(service_role)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 4 · Create the tables
Supabase → **SQL Editor** → **New query** → paste the contents of
`supabase/migrations/001_sites.sql` → **Run**.

## 5 · Allow the login link
Supabase → **Authentication → URL Configuration** → **Redirect URLs** → add:
```
http://localhost:3000/auth/callback
```

## 6 · See it
```
npm install
npm run dev
```
Open <http://localhost:3000> → sign in → **Sites** → create a website. It saves to
your database and "deploys" to live.

---

## Later — putting it on the real internet
- **Host the dashboard online:** a GitHub repo + Vercel project for this folder.
- **Real hosting engine:** a Hetzner server running Coolify (see `DEPLOY.md`), then
  set `COOLIFY_API_URL` + `COOLIFY_API_TOKEN` so sites actually go live on the web.
- Right now "deploying" is a friendly simulation (the MockEngine). Wiring the real
  CoolifyEngine is milestone **P2** in `ARCHITECTURE.md`.

When you're ready for any of this, just ask — I'll walk you through it click by click.
