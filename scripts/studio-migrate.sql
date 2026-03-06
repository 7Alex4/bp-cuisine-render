CREATE TABLE IF NOT EXISTS design_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'rendering')),
  latest_revision_number INTEGER NOT NULL DEFAULT 1,
  scene JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS design_project_revisions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES design_projects(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('seed', 'manual', 'autosave', 'import')),
  scene JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, revision_number)
);

CREATE TABLE IF NOT EXISTS design_render_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES design_projects(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'succeeded', 'failed')),
  blender_package_path TEXT,
  output_directory TEXT,
  stdout TEXT,
  stderr TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_design_projects_updated_at
  ON design_projects (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_design_project_revisions_project
  ON design_project_revisions (project_id, revision_number DESC);

CREATE INDEX IF NOT EXISTS idx_design_render_jobs_project
  ON design_render_jobs (project_id, created_at DESC);
