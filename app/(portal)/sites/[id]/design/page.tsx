import Link from 'next/link'
import { getSite } from '@/lib/sites/store'
import { getPages, THEMES, type SiteContent, type SiteTheme } from '@/lib/sites/types'
import { generateSiteAction, addPageAction, removePageAction, updatePageAction, movePageAction, startCanvasAction } from '../../actions'
import LiveEditor from './LiveEditor'
import CanvasEditor from './CanvasEditor'
import NavLinksEditor from './NavLinksEditor'

export const dynamic = 'force-dynamic'

export default async function DesignPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { page?: string }
}) {
  const site = await getSite(params.id)

  if (!site) {
    return (
      <div className="space-y-6">
        <p className="font-body text-ash">This website couldn&rsquo;t be found.</p>
        <Link href="/sites" className="font-label text-[10px] tracking-[3px] uppercase text-gold hover:text-goldLight">
          ← Back to sites
        </Link>
      </div>
    )
  }

  const c = site.content
  const pages = getPages(c)
  const currentSlug = typeof searchParams.page === 'string' ? searchParams.page : ''
  const current = pages.find(p => p.slug === currentSlug) ?? pages[0]

  // The editor edits one page at a time: site-wide fields + the current page's fields.
  const pageView: SiteContent = {
    theme: c?.theme ?? 'sand',
    accentColor: c?.accentColor,
    pageBg: c?.pageBg,
    layout: c?.layout,
    fontSystem: c?.fontSystem,
    brand: c?.brand,
    logoImage: c?.logoImage,
    headerLogoPos: c?.headerLogoPos,
    faviconImage: c?.faviconImage,
    menuPosition: c?.menuPosition,
    headerItems: c?.headerItems,
    footerItems: c?.footerItems,
    seoTitle: c?.seoTitle,
    seoDescription: c?.seoDescription,
    headline: current.headline,
    subheadline: current.subheadline,
    heroImage: current.heroImage,
    sections: current.sections,
    ctaLabel: current.ctaLabel,
    ctaType: current.ctaType,
    ctaHref: current.ctaHref,
    contactLabel: c?.contactLabel,
    contactEmail: c?.contactEmail ?? '',
    footer: c?.footer,
    socials: c?.socials,
    heroOverlay: c?.heroOverlay,
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/sites/${site.id}`} className="font-label text-[10px] tracking-[3px] uppercase text-ash hover:text-gold transition-colors">
          ← {site.name}
        </Link>
        <h1 className="font-display text-3xl italic text-parchment mt-2">Design your website</h1>
      </div>

      {/* Pages & menu */}
      <div className="space-y-3 border-b border-gold/10 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-label text-[9px] tracking-[3px] uppercase text-gold/60 mr-1">Pages</span>
          {pages.map(p => (
            <Link
              key={p.id}
              href={`/sites/${site.id}/design?page=${p.slug}`}
              className={`font-label text-[10px] tracking-[2px] uppercase px-3 py-1.5 rounded-sm transition-colors ${
                p.slug === current.slug ? 'bg-gold text-background' : 'border border-gold/20 text-ash hover:text-gold'
              }`}
            >
              {p.navLabel || p.title || 'Untitled'}
              {p.hidden && <span className="opacity-50"> · hidden</span>}
            </Link>
          ))}
          <form action={addPageAction} className="flex items-center gap-1">
            <input type="hidden" name="id" value={site.id} />
            {/* Inherit the current build mode: a new page added from a canvas page is a canvas page. */}
            <input type="hidden" name="canvas" value={current.canvas ? '1' : ''} />
            <input
              name="title"
              placeholder="New page name"
              className="bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-xs px-3 py-1.5 rounded-sm outline-none placeholder:text-ash/40"
              style={{ width: 130 }}
            />
            <button className="font-label text-[10px] tracking-[2px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-3 py-1.5 rounded-sm">
              + Add
            </button>
          </form>
        </div>

        {/* Edit the menu: the current page's settings + extra (non-page) links */}
        <details key={current.slug} className="border border-gold/15 rounded-sm px-4 py-3">
          <summary className="font-label text-[9px] tracking-[3px] uppercase text-gold/60 cursor-pointer">
            ⚙ {current.navLabel || current.title || 'Home'} — page settings &amp; menu links
          </summary>
          <div className="mt-3 space-y-3">
            <p className="font-label text-[9px] tracking-[2px] uppercase text-gold/50">
              Page: &ldquo;{current.navLabel || current.title}&rdquo;
            </p>
            <form action={updatePageAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={site.id} />
              <input type="hidden" name="slug" value={current.slug} />
              <label className="block">
                <span className="font-label text-[9px] tracking-[2px] uppercase text-gold/50">Page name</span>
                <input
                  name="title"
                  defaultValue={current.title}
                  className="mt-1 block bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-3 py-2 rounded-sm outline-none"
                  style={{ width: 180 }}
                />
              </label>
              <label className="block">
                <span className="font-label text-[9px] tracking-[2px] uppercase text-gold/50">Menu label</span>
                <input
                  name="navLabel"
                  defaultValue={current.navLabel ?? ''}
                  placeholder={current.title}
                  className="mt-1 block bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-3 py-2 rounded-sm outline-none placeholder:text-ash/40"
                  style={{ width: 180 }}
                />
              </label>
              <label className="flex items-center gap-2 font-body text-ash/70 text-sm pb-2">
                <input type="checkbox" name="hidden" value="1" defaultChecked={!!current.hidden} style={{ accentColor: '#a85c36' }} />
                Hide from menu
              </label>
              <div className="w-full" />
              <label className="block">
                <span className="font-label text-[9px] tracking-[2px] uppercase text-gold/50">SEO title <span className="opacity-60 normal-case">— for Google &amp; sharing</span></span>
                <input
                  name="seoTitle"
                  defaultValue={current.seoTitle ?? ''}
                  placeholder={current.title}
                  className="mt-1 block bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-3 py-2 rounded-sm outline-none placeholder:text-ash/40"
                  style={{ width: 280 }}
                />
              </label>
              <label className="block">
                <span className="font-label text-[9px] tracking-[2px] uppercase text-gold/50">SEO description</span>
                <input
                  name="seoDescription"
                  defaultValue={current.seoDescription ?? ''}
                  placeholder="One sentence describing this page"
                  className="mt-1 block bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-3 py-2 rounded-sm outline-none placeholder:text-ash/40"
                  style={{ width: 360 }}
                />
              </label>
              <label className="block">
                <span className="font-label text-[9px] tracking-[2px] uppercase text-gold/50">Share image URL <span className="opacity-60 normal-case">— https:// only</span></span>
                <input
                  name="seoImage"
                  defaultValue={current.seoImage ?? ''}
                  placeholder="https://…/photo.jpg"
                  className="mt-1 block bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-3 py-2 rounded-sm outline-none placeholder:text-ash/40"
                  style={{ width: 280 }}
                />
              </label>
              <button className="font-label text-[10px] tracking-[2px] uppercase bg-gold text-background hover:bg-goldLight px-5 py-2 rounded-sm">
                Save
              </button>
            </form>

            {current.slug !== '' ? (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <form action={movePageAction}>
                  <input type="hidden" name="id" value={site.id} />
                  <input type="hidden" name="slug" value={current.slug} />
                  <input type="hidden" name="dir" value="up" />
                  <button className="font-label text-[9px] tracking-[2px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-3 py-1.5 rounded-sm">← Move earlier</button>
                </form>
                <form action={movePageAction}>
                  <input type="hidden" name="id" value={site.id} />
                  <input type="hidden" name="slug" value={current.slug} />
                  <input type="hidden" name="dir" value="down" />
                  <button className="font-label text-[9px] tracking-[2px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-3 py-1.5 rounded-sm">Move later →</button>
                </form>
                <form action={removePageAction} className="ml-auto">
                  <input type="hidden" name="id" value={site.id} />
                  <input type="hidden" name="slug" value={current.slug} />
                  <button className="font-label text-[9px] tracking-[2px] uppercase text-red-400 hover:text-red-300 px-2 py-1.5">Delete page</button>
                </form>
              </div>
            ) : (
              <p className="font-body text-ash/40 text-xs">This is your home page — it always stays first in the menu.</p>
            )}
            <div className="border-t border-gold/10 pt-4 mt-1">
              <NavLinksEditor siteId={site.id} initial={c?.navLinks ?? []} />
            </div>
          </div>
        </details>
      </div>

      {/* On a free-canvas page the "Write with AI" + block/canvas switch live inside the
          editor (top-left). On a block page they stay here. */}
      {!current.canvas && (
        <details className="border border-gold/30 bg-gold/5 rounded-sm p-4">
          <summary className="font-label text-[10px] tracking-[3px] uppercase text-gold cursor-pointer">✨ Write this page with AI</summary>
          <p className="font-body text-ash/70 text-sm mt-3 mb-3">Describe this page and Claude writes it — then edit it right here.</p>
          <form action={generateSiteAction} className="space-y-3">
            <input type="hidden" name="id" value={site.id} />
            <input type="hidden" name="pageSlug" value={current.slug} />
            <textarea
              name="description"
              required
              rows={3}
              placeholder="e.g. I run Anima Temple — Reiki, soul readings, and meditation circles in Lisbon."
              className="w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none resize-none placeholder:text-ash/40"
            />
            <button className="font-label text-[11px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-6 py-3 rounded-sm transition-colors">
              Generate ✨
            </button>
          </form>
        </details>
      )}

      {current.canvas && !current.canvasHidden ? (
        <div className="space-y-3">
          <CanvasEditor
            key={'canvas:' + current.slug + ':' + site.updatedAt}
            siteId={site.id}
            siteSlug={site.slug}
            siteStatus={site.status}
            pageSlug={current.slug}
            theme={(c?.theme as SiteTheme) ?? 'sand'}
            accent={c?.accentColor || THEMES[(c?.theme as SiteTheme) ?? 'sand'].accent}
            fontSystem={c?.fontSystem ?? 'serif'}
            contactEmail={c?.contactEmail ?? ''}
            navPages={pages.filter(p => !p.hidden).map(p => ({ slug: p.slug, label: p.navLabel || p.title || 'Untitled' }))}
            initial={current.canvas}
          />
        </div>
      ) : (
        <>
          <form action={startCanvasAction} className="mb-1">
            <input type="hidden" name="id" value={site.id} />
            <input type="hidden" name="pageSlug" value={current.slug} />
            <button className="font-label text-[10px] tracking-[2px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-4 py-2 rounded-sm">
              {current.canvas ? '↩ Back to the free canvas (your layout is saved)' : '✨ Switch this page to the free canvas (Canva-style) — brings your content across'}
            </button>
          </form>
          <LiveEditor
            key={current.slug + ':' + site.updatedAt}
            siteId={site.id}
            siteSlug={site.slug}
            siteName={site.name}
            siteStatus={site.status}
            pageSlug={current.slug}
            navPages={pages.filter(p => !p.hidden).map(p => ({ slug: p.slug, label: p.navLabel || p.title || 'Untitled' }))}
            navLinks={c?.navLinks ?? []}
            initial={pageView}
          />
        </>
      )}
    </div>
  )
}
