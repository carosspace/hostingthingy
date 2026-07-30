import { getSupabaseAdmin } from '@/lib/supabase/admin'

// Reads the pre-aggregated counters written by /api/track. page_stats has RLS with no
// policies, so this uses the service role — every caller must already have checked that the
// signed-in user owns the site.

export interface DayCount { day: string; views: number; visits: number }
export interface Named { name: string; views: number }

export interface SiteStats {
  ready: boolean // false when migration 030 hasn't been run yet
  totals: { views: number; visits: number }
  days: DayCount[]
  pages: Named[]
  sources: Named[]
  devices: Named[]
}

const EMPTY: SiteStats = { ready: false, totals: { views: 0, visits: 0 }, days: [], pages: [], sources: [], devices: [] }

const ymd = (d: Date) => d.toISOString().slice(0, 10)

export async function getSiteStats(siteSlug: string, windowDays = 30): Promise<SiteStats> {
  const admin = getSupabaseAdmin()
  if (!admin) return EMPTY

  const from = new Date()
  from.setUTCDate(from.getUTCDate() - (windowDays - 1))

  const { data, error } = await admin
    .from('page_stats')
    .select('day, path, referrer, device, views, visits')
    .eq('site_slug', siteSlug)
    .gte('day', ymd(from))

  if (error) return EMPTY
  const rows = (data ?? []) as { day: string; path: string; referrer: string; device: string; views: number; visits: number }[]

  const byDay = new Map<string, DayCount>()
  // Seed every date in the window so quiet days still show as zero rather than vanishing.
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(from)
    d.setUTCDate(from.getUTCDate() + i)
    byDay.set(ymd(d), { day: ymd(d), views: 0, visits: 0 })
  }

  const bump = (m: Map<string, number>, k: string, n: number) => m.set(k, (m.get(k) ?? 0) + n)
  const pages = new Map<string, number>()
  const sources = new Map<string, number>()
  const devices = new Map<string, number>()
  let views = 0
  let visits = 0

  for (const r of rows) {
    views += r.views
    visits += r.visits
    const d = byDay.get(String(r.day).slice(0, 10))
    if (d) { d.views += r.views; d.visits += r.visits }
    bump(pages, r.path || '/', r.views)
    bump(sources, r.referrer || 'Direct / typed in', r.views)
    bump(devices, r.device || 'other', r.views)
  }

  const top = (m: Map<string, number>, n: number): Named[] =>
    Array.from(m.entries()).map(([name, v]) => ({ name, views: v })).sort((a, b) => b.views - a.views).slice(0, n)

  return {
    ready: true,
    totals: { views, visits },
    days: Array.from(byDay.values()),
    pages: top(pages, 12),
    sources: top(sources, 8),
    devices: top(devices, 3),
  }
}
