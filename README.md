# BP Cuisine Render Studio

BP Cuisine Render Studio is a Next.js application with two product paths:

- `/` for the legacy AI render flow backed by Supabase and Replicate
- `/studio` for the new deterministic kitchen planning flow: parametric 2D scene, three.js preview, and Blender final render

## Stack

| Layer | Technology |
|---|---|
| App | Next.js 16 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Legacy render backend | Next.js API routes + Supabase + Replicate |
| Studio pipeline | Parametric scene compiler + three.js + Blender |
| Local studio persistence | `.data/studio` |

## Setup

1. Install dependencies

```bash
npm install
```

2. Create `.env.local`

Required for the legacy IA route:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=renders
REPLICATE_API_TOKEN=...
```

Required for local final renders from `/studio`:

```env
BLENDER_PATH=C:\Program Files\Blender Foundation\Blender 5.0\blender.exe
```

3. Start development

```bash
npm run dev
```

Open:

- `http://localhost:3000/` for the legacy IA flow
- `http://localhost:3000/studio` for the parametric studio

## Current Product Paths

### Legacy IA Flow

The legacy route:

- uploads the room image and sketch to Supabase Storage
- starts a Replicate prediction through `/api/render/start`
- polls `/api/render/status`
- stores render job metadata in `render_jobs`

This path still works, but its fidelity is inherently weaker than the studio pipeline because it depends on image generation rather than deterministic geometry.

### Studio Pipeline

The `/studio` route uses a canonical parametric scene:

- room shell and openings
- kitchen modules and worktops
- materials
- camera match

The scene is compiled deterministically, previewed in three.js, then rendered through Blender using:

- `lib/server/blender.ts`
- `scripts/blender/render_scene.py`

Generated local outputs live under:

- `.data/studio/projects/...`
- `.data/studio/blender-packages/...`
- `.data/studio/blender-renders/...`

## Useful Commands

```bash
npm test
npm run lint
npm run build
```

Studio integration helpers:

```bash
powershell -ExecutionPolicy Bypass -File scripts/test-studio-flow.ps1
node --experimental-strip-types scripts/test-blender-render.ts
```

## Database And Storage

For the legacy IA flow, run:

- `scripts/migrate.sql`

For the future server-side studio migration, run:

- `scripts/studio-migrate.sql`

## Notes

- Blender must be installed locally for `/api/studio/projects/:id/render` to produce `final.png`
- Without `BLENDER_PATH`, the studio API can still generate a render package JSON, but it cannot launch the final render
- The current studio assets are functional placeholders; commercial-grade BP fidelity will require a real product and material catalog
