/**
 * Supabase Storage helpers — server-only.
 *
 * Bucket layout (single bucket, organised by jobId):
 *   {jobId}/room.jpg      — uploaded room photo (input for Replicate)
 *   {jobId}/sketch.jpg    — uploaded sketch (stored for reference)
 *   {jobId}/output.jpg    — final render downloaded from Replicate
 */
import { getSupabaseAdmin } from './supabase'

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'renders'

/**
 * Upload a Buffer to Supabase Storage and return the storage path.
 * Uses upsert so re-uploads don't fail on existing path.
 */
export async function uploadFileToStorage(
  path: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const sb = getSupabaseAdmin()
  const { error } = await sb.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: true,
  })
  if (error) {
    throw new Error(`Storage upload failed for ${path}: ${error.message}`)
  }
  return path
}

/**
 * Return the public URL for a storage path.
 * Works only if the bucket is set to public in Supabase.
 */
export function getPublicUrl(path: string): string {
  const sb = getSupabaseAdmin()
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
