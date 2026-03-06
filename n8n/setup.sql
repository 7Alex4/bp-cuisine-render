-- ============================================================
-- BP Cuisine Render Studio — Supabase migration
-- Run this once in: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Table principale des jobs de rendu
-- ============================================================
CREATE TABLE IF NOT EXISTS render_jobs (
  id              TEXT        PRIMARY KEY,
  replicate_id    TEXT,
  status          TEXT        NOT NULL DEFAULT 'processing'
                              CHECK (status IN ('processing', 'succeeded', 'failed', 'canceled')),
  output_url      TEXT,
  error_message   TEXT,
  full_prompt     TEXT,
  style           TEXT,
  dimensions      TEXT,
  materials       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ
);

-- Add columns to existing tables if upgrading from previous version
ALTER TABLE render_jobs ADD COLUMN IF NOT EXISTS error_message   TEXT;
ALTER TABLE render_jobs ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
ALTER TABLE render_jobs ADD COLUMN IF NOT EXISTS style           TEXT;
ALTER TABLE render_jobs ADD COLUMN IF NOT EXISTS dimensions      TEXT;
ALTER TABLE render_jobs ADD COLUMN IF NOT EXISTS materials       TEXT;

-- Update CHECK constraint to include 'canceled' (if upgrading)
-- Note: DROP CONSTRAINT then re-add only needed if old constraint exists without 'canceled'
-- ALTER TABLE render_jobs DROP CONSTRAINT IF EXISTS render_jobs_status_check;
-- ALTER TABLE render_jobs ADD CONSTRAINT render_jobs_status_check
--   CHECK (status IN ('processing', 'succeeded', 'failed', 'canceled'));

-- Index utile pour retrouver un job via son ID Replicate
CREATE INDEX IF NOT EXISTS idx_render_jobs_replicate_id
  ON render_jobs (replicate_id)
  WHERE replicate_id IS NOT NULL;

-- Index pour nettoyer les vieux jobs et détecter les timeouts
CREATE INDEX IF NOT EXISTS idx_render_jobs_created_at
  ON render_jobs (created_at);

-- Index pour le throttle last_checked_at
CREATE INDEX IF NOT EXISTS idx_render_jobs_last_checked_at
  ON render_jobs (last_checked_at)
  WHERE last_checked_at IS NOT NULL;

-- Mise à jour automatique de updated_at
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


-- 2. Bucket Supabase Storage pour les images générées
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'renders',
  'renders',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public             = true,
  file_size_limit    = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];


-- 3. Politiques RLS
-- ============================================================
DROP POLICY IF EXISTS "Public read renders" ON storage.objects;
CREATE POLICY "Public read renders"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'renders');

DROP POLICY IF EXISTS "Service role write renders" ON storage.objects;
CREATE POLICY "Service role write renders"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'renders');

DROP POLICY IF EXISTS "Service role update renders" ON storage.objects;
CREATE POLICY "Service role update renders"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'renders');


-- 4. Nettoyage automatique des vieux jobs (optionnel)
-- ============================================================
-- DELETE FROM render_jobs WHERE created_at < NOW() - INTERVAL '30 days';
