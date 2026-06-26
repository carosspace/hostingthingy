import { createSupabaseServerClient } from '@/lib/supabase/server'

// ---- Server-authoritative upload rules ---------------------------------
// The owner uploads files into the PRIVATE `site-resources` bucket. The bucket allows any MIME, so
// THIS allowlist (keyed on the requested extension) is the gate on what may enter — broad but safe:
// docs, decks, sheets, audio, images, archives and video. The value is the SERVER-CHOSEN safe
// extension actually used in the storage path (never the raw client input). The matching content
// type lets the browser upload pass a correct Content-Type for the file.
export const RESOURCE_EXTS: Record<string, { ext: string; mime: string }> = {
  pdf:  { ext: 'pdf',  mime: 'application/pdf' },
  doc:  { ext: 'doc',  mime: 'application/msword' },
  docx: { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  ppt:  { ext: 'ppt',  mime: 'application/vnd.ms-powerpoint' },
  pptx: { ext: 'pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  xls:  { ext: 'xls',  mime: 'application/vnd.ms-excel' },
  xlsx: { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  mp3:  { ext: 'mp3',  mime: 'audio/mpeg' },
  wav:  { ext: 'wav',  mime: 'audio/wav' },
  m4a:  { ext: 'm4a',  mime: 'audio/mp4' },
  png:  { ext: 'png',  mime: 'image/png' },
  jpg:  { ext: 'jpg',  mime: 'image/jpeg' },
  jpeg: { ext: 'jpg',  mime: 'image/jpeg' },
  webp: { ext: 'webp', mime: 'image/webp' },
  gif:  { ext: 'gif',  mime: 'image/gif' },
  zip:  { ext: 'zip',  mime: 'application/zip' },
  mp4:  { ext: 'mp4',  mime: 'video/mp4' },
  mov:  { ext: 'mov',  mime: 'video/quicktime' },
}
// 100 MB — matches the bucket's file_size_limit (022).
export const RESOURCE_MAX_BYTES = 104857600

// ---- Types -------------------------------------------------------------

// A resource as the OWNER manages it. file_path is the storage object key — server-side only; it's
// never surfaced to a client (the client-read RPC omits it).
export interface Resource {
  id: string
  title: string
  description: string | null
  filePath: string
  fileName: string | null
  fileSize: number | null
  mime: string | null
  // null = free (any signed-in client); a tier id = members-only (gated to that tier).
  tierId: string | null
  sort: number
  createdAt: string
}

// ---- Owner side (RLS: owner_id = auth.uid()) ---------------------------
// Every read/write below runs through the auth-aware server client, so RLS scopes every row to the
// signed-in owner. Inserts set owner_id from the AUTHED user (passed in), never from posted data.

function mapResource(r: {
  id: string
  title: string
  description: string | null
  file_path: string
  file_name: string | null
  file_size: number | string | null
  mime: string | null
  tier_id: string | null
  sort: number
  created_at: string
}): Resource {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? null,
    filePath: r.file_path,
    fileName: r.file_name ?? null,
    // file_size is bigint → may arrive as a string; coerce to a number (or null).
    fileSize: r.file_size == null ? null : Number(r.file_size) || 0,
    mime: r.mime ?? null,
    tierId: r.tier_id ?? null,
    sort: r.sort,
    createdAt: r.created_at,
  }
}

// All of the owner's resources, in display order. RLS scopes the rows to the signed-in owner.
export async function listResources(): Promise<Resource[]> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('resources')
    .select('id, title, description, file_path, file_name, file_size, mime, tier_id, sort, created_at')
    .order('sort', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(r => mapResource(r as Parameters<typeof mapResource>[0]))
}

// Insert a resource row for the owner (owner_id is the AUTHED user — never posted). tierId null =
// free; a tier id = members-only (the RLS with_check + the FK keep it the owner's own tier space).
// Appends after the current last sibling so new uploads land at the end of the list.
export async function createResource(
  ownerId: string,
  input: {
    title: string
    description: string | null
    filePath: string
    fileName: string | null
    fileSize: number | null
    mime: string | null
    tierId: string | null
  },
): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { data: last } = await supabase
    .from('resources')
    .select('sort')
    .order('sort', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextSort = (last?.sort ?? -1) + 1
  const { error } = await supabase.from('resources').insert({
    owner_id: ownerId,
    title: input.title,
    description: input.description || null,
    file_path: input.filePath,
    file_name: input.fileName || null,
    file_size: input.fileSize ?? null,
    mime: input.mime || null,
    tier_id: input.tierId || null,
    sort: nextSort,
  })
  if (error) throw error
}

// Look up a resource's storage path for the owner (RLS-scoped), so the delete can also remove the
// storage object. Returns null if the row isn't the owner's / doesn't exist.
export async function getResourceFilePath(id: string): Promise<string | null> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('resources')
    .select('file_path')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as { file_path?: string } | null)?.file_path ?? null
}

// Delete a resource row (RLS scopes the delete to the signed-in owner, so a foreign id is a no-op).
export async function deleteResource(id: string): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('resources').delete().eq('id', id)
  if (error) throw error
}
