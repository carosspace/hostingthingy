export const runtime = 'nodejs'

import { getCurrentUser } from '@/lib/auth'
import { PORTAL_SITE_SLUG } from '@/lib/portal/site'
import { getMyWorkbookHtml } from '@/lib/portal/workbook'
import { getWorkbookState } from '@/lib/portal/workbook-state'

// Safe to inline inside a <script> tag: no "</script>" break-out, no line-separator hazards.
function jsonForScript(value: unknown): string {
  return JSON.stringify(value ?? null)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

// ACCOUNT SAVING for interactive workbooks. These files were authored against
// localStorage, so rather than rewrite every workbook we make localStorage itself
// account-backed for the signed-in member:
//   • their saved writing is inlined and seeded BEFORE the workbook's own scripts run, so
//     its very first read already sees their answers (no async race, no empty flash);
//   • every write is captured and pushed back to their account (debounced);
//   • if a DIFFERENT account signs in on this browser, the previous person's writing is
//     cleared first — nothing leaks between people sharing a computer;
//   • unsent changes survive a reload, so nothing is silently lost when offline.
// If any of this fails the workbook still works exactly as it does today, from local storage.
function stateShim(slug: string, ownerKey: string, seed: Record<string, string> | null): string {
  return `<script>
(function(){
  try{
    var SLUG=${jsonForScript(slug)}, OWNER=${jsonForScript(ownerKey)}, SEED=${jsonForScript(seed || {})};
    var LS; try{ LS=window.localStorage; if(!LS) return; }catch(e){ return; }
    var P='__atwb_', K_KEYS=P+'keys_'+SLUG, K_OWNER=P+'owner_'+SLUG, K_DIRTY=P+'dirty_'+SLUG;
    var setRaw=LS.setItem.bind(LS), getRaw=LS.getItem.bind(LS), delRaw=LS.removeItem.bind(LS);
    var mine=function(k){ return typeof k==='string' && k.indexOf(P)!==0; };
    function keys(){ try{ return JSON.parse(getRaw(K_KEYS)||'[]')||[]; }catch(e){ return []; } }
    function remember(k){ var a=keys(); if(a.indexOf(k)<0){ a.push(k); setRaw(K_KEYS,JSON.stringify(a)); } }
    function snapshot(){ var o={},a=keys(); for(var i=0;i<a.length;i++){ var v=getRaw(a[i]); if(typeof v==='string') o[a[i]]=v; } return o; }

    // A different person on this browser → drop whatever the previous account seeded.
    if(getRaw(K_OWNER)!==OWNER){
      var old=keys(); for(var i=0;i<old.length;i++) delRaw(old[i]);
      setRaw(K_KEYS,'[]'); delRaw(K_DIRTY); setRaw(K_OWNER,OWNER);
    }

    // Seed from the account — unless this device still holds writing that never got sent up.
    var dirty = getRaw(K_DIRTY)==='1';
    if(!dirty){
      var seeded=[];
      for(var k in SEED){ if(Object.prototype.hasOwnProperty.call(SEED,k)){ setRaw(k,SEED[k]); seeded.push(k); } }
      if(seeded.length) setRaw(K_KEYS,JSON.stringify(seeded));
    }

    var timer=null, sending=false, again=false;
    function push(){
      if(sending){ again=true; return; }
      sending=true;
      var payload; try{ payload=JSON.stringify({data:snapshot()}); }catch(e){ sending=false; return; }
      fetch('/api/client/workbook/state?w='+encodeURIComponent(SLUG),
        {method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:payload})
        .then(function(r){
          sending=false;
          if(r&&r.ok){ delRaw(K_DIRTY); if(again){ again=false; schedule(); } }
        })
        .catch(function(){ sending=false; }); // stays dirty → retried on next write / reload
    }
    function schedule(){ setRaw(K_DIRTY,'1'); clearTimeout(timer); timer=setTimeout(push,900); }

    LS.setItem=function(k,v){ setRaw(k,v); if(mine(k)){ remember(k); schedule(); } };
    LS.removeItem=function(k){ delRaw(k); if(mine(k)) schedule(); };

    // Anything left unsent (offline, closed too fast) goes up as soon as we can.
    if(dirty) schedule();
    window.addEventListener('online',function(){ if(getRaw(K_DIRTY)==='1') push(); });
    document.addEventListener('visibilitychange',function(){ if(document.hidden && getRaw(K_DIRTY)==='1') push(); });
  }catch(e){ /* never break the workbook */ }
})();
</script>
`
}

// Put the shim as early as possible — before any of the workbook's own scripts read storage.
function injectShim(html: string, shim: string): string {
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, m => m + '\n' + shim)
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, m => m + '\n' + shim)
  return shim + html
}

// A small branded fallback page (shown when not signed in or not entitled).
function message(title: string, body: string, status: number): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#1A1108;color:#E8C5B0;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:2rem}div{max-width:22rem}h1{font-weight:400;font-size:1.3rem;margin:0 0 .8rem}p{opacity:.72;font-size:.92rem;line-height:1.65;margin:0}</style></head><body><div><h1>${title}</h1><p>${body}</p></div></body></html>`
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
  })
}

// Serves the workbook HTML — but ONLY to a signed-in, entitled member. The RPC
// re-checks entitlement server-side on every request (the iframe src can't be
// cached past a session), so this can't be scraped by a logged-out visitor.
export async function GET(req: Request): Promise<Response> {
  const user = await getCurrentUser()
  if (!user) {
    return message('Please sign in', 'Sign in to your portal to open your workbook.', 401)
  }
  // Which product to serve (?w=<slug>); defaults to the original 'tuned-in'.
  const raw = (new URL(req.url).searchParams.get('w') || 'tuned-in').toLowerCase()
  const workbookSlug = /^[a-z0-9-]{1,60}$/.test(raw) ? raw : 'tuned-in'
  const html = await getMyWorkbookHtml(PORTAL_SITE_SLUG, workbookSlug)
  if (!html) {
    return message(
      'Not unlocked yet',
      'This workbook isn’t on your account yet. If you bought it, make sure you’re signed in with the email you used at checkout.',
      403,
    )
  }
  // Their own writing, carried across their devices. Never fatal: if this read fails the
  // workbook is served untouched and keeps working from local storage.
  const seed = await getWorkbookState(user.id, workbookSlug)
  const body = injectShim(html, stateShim(workbookSlug, user.id, seed))

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      // Allow embedding only within our own portal page (same-origin iframe).
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "frame-ancestors 'self'",
    },
  })
}
