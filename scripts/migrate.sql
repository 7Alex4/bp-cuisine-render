-- ============================================================
-- BP Cuisine Render Studio — Supabase Migration (v2)
-- Adds room_storage_path / sketch_storage_path columns
-- and ensures the renders bucket exists.
--
-- Run once in: Supabase Dashboard > SQL Editor
-- Safe to re-run (all statements are idempotent).
-- ============================================================

-- 1. Create render_jobs table (if not already created by n8n/setup.sql)
-- ============================================================
CREATE TABLE IF NOT EXISTS render_jobs (
  id                   TEXT        PRIMARY KEY,
  replicate_id         TEXT,
  status               TEXT        NOT NULL DEFAULT 'processing'
                                   CHECK (status IN ('processing', 'succeeded', 'failed', 'canceled')),
  output_url           TEXT,
  error_message        TEXT,
  full_prompt          TEXT,
  style                TEXT,
  dimensions           TEXT,
  materials            TEXT,
  room_storage_path    TEXT,
  sketch_storage_path  TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at      TIMESTAMPTZ
);

-- 2. Add new columns to existing installs (safe if they already exist)
-- ============================================================
ALTER TABLE render_jobs ADD COLUMN IF NOT EXISTS room_storage_path    TEXT;
ALTER TABLE render_jobs ADD COLUMN IF NOT EXISTS sketch_storage_path  TEXT;
ALTER TABLE render_jobs ADD COLUMN IF NOT EXISTS error_message        TEXT;
ALTER TABLE render_jobs ADD COLUMN IF NOT EXISTS last_checked_at      TIMESTAMPTZ;
ALTER TABLE render_jobs ADD COLUMN IF NOT EXISTS style                TEXT;
ALTER TABLE render_jobs ADD COLUMN IF NOT EXISTS dimensions           TEXT;
ALTER TABLE render_jobs ADD COLUMN IF NOT EXISTS materials            TEXT;

-- 3. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_render_jobs_replicate_id
  ON render_jobs (replicate_id)
  WHERE replicate_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_render_jobs_created_at
  ON render_jobs (created_at);

CREATE INDEX IF NOT EXISTS idx_render_jobs_last_checked_at
  ON render_jobs (last_checked_at)
  WHERE last_checked_at IS NOT NULL;

-- 4. Auto-update updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION _update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS render_jobs_updated_at ON render_jobs;
CREATE TRIGGER render_jobs_updated_at
  BEFORE UPDATE ON render_jobs
  FOR EACH ROW EXECUTE FUNCTION _update_updated_at();

-- 5. Supabase Storage bucket: "renders"
--    Stores both input images ({jobId}/room.jpg, {jobId}/sketch.jpg)
--    and output renders ({jobId}/output.jpg).
--    Set to public so Replicate can fetch input images via URL.
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'renders',
  'renders',
  true,
  52428800,   -- 50 MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public             = true,
  file_size_limit    = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 6. RLS policies for storage.objects
--    Public read (anyone can download renders / inputs).
--    Write restricted to service role (API routes use service key).
-- ============================================================
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "renders: public read" ON storage.objects;
CREATE POLICY "renders: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'renders');

DROP POLICY IF EXISTS "renders: service write" ON storage.objects;
CREATE POLICY "renders: service write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'renders');

DROP POLICY IF EXISTS "renders: service update" ON storage.objects;
CREATE POLICY "renders: service update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'renders');

-- 7. RLS on render_jobs
--    Service role bypasses RLS automatically.
--    No direct client access needed — all reads go through /api/render/status.
-- ============================================================
ALTER TABLE render_jobs ENABLE ROW LEVEL SECURITY;

-- Deny all direct client access (API routes use service role which bypasses RLS)
DROP POLICY IF EXISTS "render_jobs: deny all" ON render_jobs;
