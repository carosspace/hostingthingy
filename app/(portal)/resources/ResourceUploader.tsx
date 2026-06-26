'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { createResourceUploadUrl, saveResource } from './actions'

// The MIME the browser passes on upload must match what the file actually is. We don't rely on
// file.type (often blank for some types); the SERVER maps the extension to the safe ext + we send a
// best-effort content type from this table so the upload carries a sensible Content-Type.
const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  zip: 'application/zip',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
}
const ACCEPTED = Object.keys(CONTENT_TYPES)
const MAX_BYTES = 104857600 // 100 MB — matches the bucket cap.

const input =
  'w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-2.5 rounded-sm outline-none placeholder:text-ash/40'

// The owner-side "upload a resource" form. The FILE is uploaded directly from the browser to a
// service-role signed URL (the file never passes through a server action), then saveResource writes
// the row. Tier picker = the owner's tiers (the empty value = Free / all clients).
export default function ResourceUploader({ tiers }: { tiers: { id: string; name: string }[] }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErr('')
    const form = e.currentTarget
    const data = new FormData(form)
    const title = String(data.get('title') ?? '').trim()
    const description = String(data.get('description') ?? '')
    const tierId = String(data.get('tierId') ?? '')
    const file = fileRef.current?.files?.[0]

    if (!title) { setErr('Give the resource a title.'); return }
    if (!file) { setErr('Choose a file to upload.'); return }
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (!ACCEPTED.includes(ext)) {
      setErr('Unsupported file type. Use a PDF, doc, slide deck, sheet, audio, image, zip or video.')
      return
    }
    if (file.size > MAX_BYTES) {
      setErr('That file is over 100 MB. Please upload a smaller file.')
      return
    }

    setBusy(true)
    try {
      // 1) Ask the server for a signed upload URL at a server-chosen path.
      const res = await createResourceUploadUrl(ext)
      if (!res.ok) { setErr(res.error); return }
      // 2) Upload the file straight to storage from the browser.
      const supabase = createSupabaseBrowserClient()
      const contentType = CONTENT_TYPES[ext] || file.type || 'application/octet-stream'
      const up = await supabase.storage.from('site-resources').uploadToSignedUrl(res.path, res.token, file, { contentType })
      if (up.error) { setErr('Upload failed. Please try again.'); return }
      // 3) Save the row pointing at the uploaded object.
      const saved = await saveResource({
        title,
        description,
        filePath: res.path,
        fileName: file.name,
        fileSize: file.size,
        mime: contentType,
        tierId,
      })
      if (!saved.ok) { setErr(saved.error); return }
      form.reset()
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    } catch {
      setErr('Upload failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="border border-gold/15 rounded-sm p-5 space-y-3">
      <p className="font-label text-[10px] tracking-[2px] uppercase text-gold/70">New resource</p>
      <input name="title" required placeholder="Title (e.g. Welcome Workbook)" className={input} />
      <textarea name="description" rows={2} placeholder="Short description (optional)" className={`${input} resize-none`} />
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="font-label text-[10px] tracking-[2px] uppercase text-gold/70 block mb-1.5">File</span>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED.map(e => `.${e}`).join(',')}
            className="w-full text-parchment font-body text-sm file:mr-3 file:border file:border-gold/40 file:bg-transparent file:text-gold file:font-label file:text-[10px] file:tracking-[2px] file:uppercase file:px-4 file:py-2 file:rounded-sm file:cursor-pointer"
          />
        </label>
        <label className="block">
          <span className="font-label text-[10px] tracking-[2px] uppercase text-gold/70 block mb-1.5">Access</span>
          <select name="tierId" defaultValue="" className={`${input} appearance-none`}>
            <option value="" className="bg-surface text-parchment">Free — all signed-in clients</option>
            {tiers.map(t => (
              <option key={t.id} value={t.id} className="bg-surface text-parchment">
                Members only — {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="font-body text-ash/50 text-xs">
        PDFs, docs, slide decks, sheets, audio, images, zips and video, up to 100 MB. Members-only files are
        securely gated — only clients in that tier can download them.
      </p>
      {err && <p className="font-body text-red-400 text-sm">{err}</p>}
      <button
        disabled={busy}
        className="font-label text-[11px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-6 py-2.5 rounded-sm transition-colors disabled:opacity-40"
      >
        {busy ? 'Uploading…' : 'Upload resource'}
      </button>
    </form>
  )
}
