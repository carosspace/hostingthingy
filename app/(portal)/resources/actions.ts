'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  createResource,
  deleteResource,
  getResourceFilePath,
  RESOURCE_EXTS,
} from '@/lib/resources/repo'

const RESOURCES_BUCKET = 'site-resources'

// Mint a service-role SIGNED UPLOAD URL for a new resource file, into the PRIVATE site-resources
// bucket at a SERVER-CHOSEN path. The owner must be signed in; the path is `${user.id}/${randomId}.
// ${safeExt}` (owner-scoped, random name) so the client never picks the path. The requested
// extension is mapped through the server allowlist (RESOURCE_EXTS) — anything else is rejected, so
// only safe file kinds enter the bucket. Returns {path, token} for the browser to uploadToSignedUrl.
// Dormant-safe: with Storage / the service role unconfigured we return a friendly error (no throw).
export async function createResourceUploadUrl(
  ext: string,
): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'Please sign in again.' }
  // Map the requested extension to a safe one (server-controlled — never trust the raw input).
  const safe = RESOURCE_EXTS[String(ext ?? '').trim().toLowerCase()]
  if (!safe) {
    return { ok: false, error: 'Unsupported file type. Use a PDF, doc, slide deck, sheet, audio, image, zip or video.' }
  }
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Resource uploads aren’t set up on this server yet.' }
  // The storage path is chosen HERE (owner-scoped, random filename), never by the client.
  const randomId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-z0-9-]/gi, '')
  const path = `${user.id}/${randomId}.${safe.ext}`
  try {
    const { data, error } = await admin.storage.from(RESOURCES_BUCKET).createSignedUploadUrl(path)
    if (error || !data) return { ok: false, error: 'Couldn’t start the upload. Try again.' }
    return { ok: true, path: data.path, token: data.token }
  } catch {
    return { ok: false, error: 'Couldn’t start the upload. Try again.' }
  }
}

// Save a resource row AFTER the browser has uploaded the file to the signed URL. owner_id is the
// AUTHED user (never posted); the RLS with_check + the tier FK keep tier_id within the owner's own
// space. Returns {ok} so the upload UI can surface a friendly error. Dormant-safe: with the table
// not migrated yet the insert throws a known code → we return a friendly error rather than crash.
export async function saveResource(input: {
  title: string
  description: string
  filePath: string
  fileName: string
  fileSize: number
  mime: string
  tierId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'Please sign in again.' }
  const title = String(input.title ?? '').trim()
  const filePath = String(input.filePath ?? '').trim()
  if (!title) return { ok: false, error: 'Give the resource a title.' }
  if (!filePath) return { ok: false, error: 'Upload a file first.' }
  try {
    await createResource(user.id, {
      title,
      description: String(input.description ?? '').trim() || null,
      filePath,
      fileName: String(input.fileName ?? '').trim() || null,
      fileSize: Number.isFinite(input.fileSize) ? Math.round(input.fileSize) : null,
      mime: String(input.mime ?? '').trim() || null,
      // Empty string from the "Free" option → null (free).
      tierId: String(input.tierId ?? '').trim() || null,
    })
  } catch (e) {
    // 42P01 = undefined_table; PGRST205 = relation not in PostgREST's schema cache. Both mean
    // migration 022 isn't applied yet — degrade to a friendly error instead of a 500.
    const code = (e as { code?: string } | null)?.code
    if (code === '42P01' || code === 'PGRST205') {
      return { ok: false, error: 'Resources aren’t switched on yet. Run migration 022 in Supabase.' }
    }
    return { ok: false, error: 'Couldn’t save the resource. Try again.' }
  }
  revalidatePath('/resources')
  return { ok: true }
}

// Delete a resource: remove the storage object first (best-effort via the service role), then the
// row. RLS scopes the path lookup + delete to the signed-in owner, so a foreign id reads as null
// and nothing is removed. Storage removal is best-effort — a Storage failure does not block the row
// delete (the orphaned object is harmless in a private bucket).
export async function deleteResourceAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '').trim()
  if (!id) return
  let filePath: string | null = null
  try {
    filePath = await getResourceFilePath(id)
  } catch {
    // table not migrated / lookup failed — nothing to remove from storage.
  }
  if (filePath) {
    const admin = getSupabaseAdmin()
    if (admin) {
      try {
        await admin.storage.from(RESOURCES_BUCKET).remove([filePath])
      } catch {
        // best-effort: leave the (private, inert) object if removal fails.
      }
    }
  }
  try {
    await deleteResource(id)
  } catch {
    // table not migrated — nothing to delete.
  }
  revalidatePath('/resources')
}
