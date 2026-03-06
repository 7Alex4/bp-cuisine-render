/**
 * Server-only Supabase client factory.
 * NEVER import this file from a client component — it contains secrets.
 *
 * Validation is deferred to call-time (not module evaluation) so that
 * `next build` does not fail when env vars are absent at build time.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

/**
 * Returns a singleton Supabase service-role client.
 * Throws if env vars are missing (caught at request time, not build time).
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('Missing env var: SUPABASE_URL')
  }
  if (!supabaseServiceKey) {
    throw new Error('Missing env var: SUPABASE_SERVICE_ROLE_KEY')
  }

  _client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  return _client
}
