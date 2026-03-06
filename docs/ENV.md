# Environment Variables

## Current App

Set in `.env.local`:

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key for server-side DB and Storage access |
| `SUPABASE_STORAGE_BUCKET` | Yes | Public bucket used for legacy render uploads |
| `REPLICATE_API_TOKEN` | Yes for the legacy IA flow | Token used by `/api/render/*` |
| `BLENDER_PATH` | No, but required for local final renders | Absolute path to the Blender executable, e.g. `C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe` |
| `STUDIO_DATA_DIR` | No | Override the local storage root for studio projects, revisions and Blender packages. Defaults to `.data/studio` in the repo |

---

## Studio Parametric Pipeline

The new `/studio` route stores its canonical projects and revisions locally by default:

- `.data/studio/projects/<project-id>/project.json`
- `.data/studio/projects/<project-id>/revisions/*.json`
- `.data/studio/blender-packages/<project-id>/rev-<n>.json`

If you want to prepare Supabase for the future server-side migration, run:

- `scripts/studio-migrate.sql`

If `BLENDER_PATH` is configured, `POST /api/studio/projects/:id/render` will call Blender in headless mode using:

- `scripts/blender/render_scene.py`

If `BLENDER_PATH` is not configured, the app will still generate the Blender package JSON so the project can be rendered by an external worker later.
