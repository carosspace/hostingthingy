'use client'

import Link from 'next/link'
import { useState } from 'react'

// The most-used links stay on the bar; the rest tuck into a "More" menu so the
// header doesn't crowd (and never collides with the logo).
const PRIMARY = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/bookings', label: 'Bookings' },
]
const MORE = [
  { href: '/courses', label: 'Courses' },
  { href: '/memberships', label: 'Memberships' },
  { href: '/resources', label: 'Resources' },
  { href: '/subscribers', label: 'Subscribers' },
]

const linkCls = 'text-ash hover:text-gold transition-colors'

export default function PortalNav({ unread }: { unread: number }) {
  const [open, setOpen] = useState(false)

  return (
    <nav className="flex items-center gap-6 font-label text-[10px] tracking-[3px] uppercase">
      {PRIMARY.map(i => (
        <Link key={i.href} href={i.href} className={linkCls}>
          {i.label}
        </Link>
      ))}

      <Link href="/messages" className={linkCls}>
        Messages
        {unread > 0 && (
          <span className="ml-1.5 inline-block bg-gold text-background rounded-full px-1.5 py-px text-[9px] leading-none align-middle">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Link>

      <div className="relative">
        <button type="button" onClick={() => setOpen(o => !o)} className={`${linkCls} uppercase tracking-[3px]`}>
          More {open ? '▴' : '▾'}
        </button>
        {open && (
          <>
            {/* click-away catcher */}
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-10 cursor-default"
            />
            <div className="absolute right-0 mt-3 z-20 bg-background border border-gold/15 rounded-sm py-2 min-w-[170px] shadow-xl">
              {MORE.map(i => (
                <Link
                  key={i.href}
                  href={i.href}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-ash hover:text-gold hover:bg-gold/5 transition-colors text-[10px] tracking-[3px]"
                >
                  {i.label}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <form action="/auth/signout" method="post">
        <button type="submit" className={`font-label text-[10px] tracking-[3px] uppercase ${linkCls}`}>
          Sign&nbsp;out
        </button>
      </form>
    </nav>
  )
}
