# BP Cuisine — Render Studio

Internal AI-powered 4K kitchen visualisation tool for BP Cuisine design consultants.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Backend | n8n webhook (external) |
| Storage | `localStorage` (render history) |

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and set your n8n base URL:

```env
NEXT_PUBLIC_N8N_BASE_URL=https://your-n8n-instance.example.com
```

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Quickstart Checklist

- [ ] Copy `.env.local.example` to `.env.local` and set `NEXT_PUBLIC_N8N_BASE_URL`
- [ ] Run `npm install` then `npm run dev`
- [ ] Open [http://localhost:3000](http://localhost:3000)
- [ ] In n8n, activate the two webhooks below and verify they return the expected JSON shape

---

## n8n Webhook API Contract

The app expects two endpoints on your n8n instance:

### `POST /webhook/bpcuisines-render/start`

Starts a new render job. Accepts `multipart/form-data`:

| Field | Type | Description |
|---|---|---|
| `room` | File | Photo of the empty kitchen space |
| `sketch` | File | 2D floor plan or hand-drawn sketch |
| `prompt` | string | Free-text design description |
| `style` | string | Kitchen style (e.g. "Minimalist") |
| `dimensions` | string (JSON) | `{"width":4.2,"depth":3.1,"height":2.6}` |
| `materials` | string (JSON) | `{"description":"matte lacquer, marble..."}` |

**Response:**
```json
{
  "id": "render_abc123",
  "status": "processing",
  "pollUrl": "https://your-n8n/webhook/bpcuisines-render/status?id=render_abc123"
}
```

If the render finishes synchronously, include `"status": "succeeded"` and `"outputUrl": "https://..."`.

---

### `GET /webhook/bpcuisines-render/status?id=<id>`

Returns the current status of a render job.

**Response:**
```json
{
  "id": "render_abc123",
  "status": "succeeded",
  "outputUrl": "https://..."
}
```

| `status` value | Meaning |
|---|---|
| `processing` | AI render in progress |
| `succeeded` | Render complete, `outputUrl` is set |
| `failed` | Render failed, optional `error` string |

---

## Polling Behaviour

- Polls every **4 seconds** during normal operation
- After **3 minutes**, switches to **10-second** slow-poll with a warning banner
- User can cancel at any time
- Stops automatically on `succeeded` or `failed`
- Retries up to 3 consecutive network errors with exponential backoff before failing

---

## Features

- Drag-and-drop upload (room photo + 2D sketch)
- Camera capture on mobile (`capture="environment"`)
- Design prompt, style selector, room dimensions, materials fields
- Real-time 3-step progress indicator
- Fullscreen result preview
- One-click 4K download
- "Regenerate with adjustments" flow
- Render history (last 10 jobs, persisted in `localStorage`)

---

## How to Verify Front-Back Connection

Use the **Dev — Connection Debug** panel (visible only in `npm run dev`, hidden in production) to confirm end-to-end wiring before a real shoot.

### Steps

1. **Start the dev server**
   ```bash
   npm run dev
   # open http://localhost:3000
   ```

2. **Verify the base URL**
   Scroll to the bottom of the page and expand the amber "Dev — Connection Debug" panel.
   The **n8n Base URL** row should show your instance origin (e.g. `https://my-n8n.example.com`).
   If it shows `(not set)`, create `.env.local` from `.env.local.example` and restart.

3. **Ping an existing render ID**
   In the **Ping Status** row, enter any ID that exists in your n8n Executions log and click **Ping Status**.
   Expected response shape:
   ```json
   { "_http": 200, "id": "...", "status": "succeeded", "outputUrl": "https://..." }
   ```
   A `_http: 404` or `_error` means the webhook path or n8n activation is wrong.

4. **Start Test Job**
   Upload both images and fill in at least the prompt, then click **Start Test Job**.
   The raw JSON from `/start` is printed immediately — look for `id` and `status`.
   Check the **n8n → Executions** tab to confirm the workflow was triggered and all six fields arrived (`room`, `sketch`, `prompt`, `style`, `dimensions`, `materials`).

5. **Full round-trip**
   Use the normal Generate button. The progress bar will appear, and the result image will be displayed once `outputUrl` is returned.

---

## Project Structure

```
├── app/
│   ├── globals.css          # Tailwind v4 theme + custom animations
│   ├── layout.tsx           # Root layout with Geist font
│   └── page.tsx             # Dashboard — all state logic
├── components/
│   ├── Header.tsx           # Dark branded header
│   ├── UploadZone.tsx       # Drag-and-drop image uploader
│   ├── MaterialsForm.tsx    # Style / materials / constraints form
│   ├── ProgressSection.tsx  # Step-based progress indicator
│   ├── ResultViewer.tsx     # Image preview + download + regenerate
│   └── HistoryPanel.tsx     # Scrollable history of past renders
├── lib/
│   ├── api.ts               # startRender() + pollRender()
│   └── history.ts           # localStorage read/write helpers
└── types/
    └── index.ts             # Shared TypeScript types
```

---

## Build for Production

```bash
npm run build
npm start
```
