import type { RenderJobResponse, StartRenderResponse } from '@/types'

function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_N8N_BASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_N8N_BASE_URL is not configured in .env.local')
  return url.replace(/\/$/, '')
}

/**
 * Start a render job.
 * Returns a full StartRenderResponse so the caller can short-circuit polling
 * when the backend signals immediate success or failure.
 */
export async function startRender(
  formData: FormData,
  signal: AbortSignal,
): Promise<StartRenderResponse> {
  const res = await fetch(`${getBaseUrl()}/webhook/bpcuisines-render/start`, {
    method: 'POST',
    body: formData,
    cache: 'no-store',
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Failed to start render (HTTP ${res.status}): ${text}`)
  }

  return res.json()
}

/**
 * Poll for render status.
 *
 * @param id      Render job ID.
 * @param signal  AbortSignal — caller aborts this when the user cancels or
 *                the component unmounts.
 * @param pollUrl Optional explicit URL provided by the backend in the start
 *                response. Falls back to constructing from the base URL.
 */
export async function pollRender(
  id: string,
  signal: AbortSignal,
  pollUrl?: string,
): Promise<RenderJobResponse> {
  // Prefer an explicit pollUrl from the backend (avoids URL construction coupling),
  // otherwise build with a query param (easier to test and more n8n-compatible than
  // a path segment).
  const url =
    pollUrl ?? `${getBaseUrl()}/webhook/bpcuisines-render/status?id=${encodeURIComponent(id)}`

  const res = await fetch(url, { cache: 'no-store', signal })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Status check failed (HTTP ${res.status}): ${text}`)
  }

  return res.json()
}
