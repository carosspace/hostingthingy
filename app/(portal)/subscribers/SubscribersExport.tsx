'use client'

import { useState } from 'react'

// Copy-all + CSV-download for the owner's subscriber emails, so she can paste them into a
// dedicated newsletter tool (Mailchimp / MailerLite / Buttondown / Substack) to actually send.
export default function SubscribersExport({ emails }: { emails: string[] }) {
  const [copied, setCopied] = useState(false)

  function copyAll() {
    const text = emails.join(', ')
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }).catch(() => {})
    }
  }

  function downloadCsv() {
    const csv = 'email\n' + emails.map(e => '"' + e.replace(/"/g, '""') + '"').join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'subscribers.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-wrap gap-3">
      <button
        onClick={copyAll}
        className="font-label text-[10px] tracking-[2px] uppercase bg-gold text-background rounded-sm px-4 py-2 hover:bg-gold/90 transition-colors"
      >
        {copied ? 'Copied ✓' : 'Copy all emails'}
      </button>
      <button
        onClick={downloadCsv}
        className="font-label text-[10px] tracking-[2px] uppercase border border-gold/25 text-ash rounded-sm px-4 py-2 hover:text-gold hover:border-gold/50 transition-colors"
      >
        Download CSV
      </button>
    </div>
  )
}
