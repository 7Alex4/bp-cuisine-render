/**
 * Database helpers for render_jobs table — server-only.
 */
import { getSupabaseAdmin } from './supabase'

export interface RenderJob {
  id: string
  replicate_id: string | null
  status: 'processing' | 'succeeded' | 'failed' | 'canceled'
  output_url: string | null
  error_message: string | null
  full_prompt: string | null
  style: string | null
  dimensions: string | null
  materials: string | null
  room_storage_path: string | null
  sketch_storage_path: string | null
  created_at: string
  updated_at: string
  last_checked_at: string | null
}

/** Insert a new job in processing state. */
export async function createJob(
  data: Pick<
    RenderJob,
    | 'id'
    | 'full_prompt'
    | 'style'
    | 'dimensions'
    | 'materials'
    | 'room_storage_path'
    | 'sketch_storage_path'
  >,
): Promise<void> {
  const sb = getSupabaseAdmin()
  const { error } = await sb.from('render_jobs').insert({
    ...data,
    status: 'processing',
  })
  if (error) throw new Error(`DB createJob failed: ${error.message}`)
}

/** Fetch a single job by id. Returns null if not found. */
export async function getJob(id: string): Promise<RenderJob | null> {
  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('render_jobs')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    // PGRST116 = "Row not found" from PostgREST
    if (error.code === 'PGRST116') return null
    throw new Error(`DB getJob failed: ${error.message}`)
  }
  return data as RenderJob
}

/** Partial update on a job. */
export async function updateJob(
  id: string,
  updates: Partial<
    Pick<
      RenderJob,
      'replicate_id' | 'status' | 'output_url' | 'error_message' | 'last_checked_at'
    >
  >,
): Promise<void> {
  const sb = getSupabaseAdmin()
  const { error } = await sb.from('render_jobs').update(updates).eq('id', id)
  if (error) throw new Error(`DB updateJob failed: ${error.message}`)
}
