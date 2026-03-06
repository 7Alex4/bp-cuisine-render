import type { RenderJobResponse, StartRenderResponse } from '@/types'

export async function startRender(
  formData: FormData,
  signal?: AbortSignal,
): Promise<StartRenderResponse> {
  const res = await fetch('/api/render/start', {
    method: 'POST',
    body: formData,
    cache: 'no-store',
    ...(signal && { signal }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Erreur serveur (HTTP ${res.status}) : ${text || '(corps vide)'}`)
  }

  const text = await res.text()
  if (!text.trim()) {
    throw new Error(`Le serveur a repondu avec un corps vide (HTTP ${res.status}).`)
  }

  try {
    return JSON.parse(text) as StartRenderResponse
  } catch {
    throw new Error(`Reponse invalide (pas du JSON) : ${text.slice(0, 200)}`)
  }
}

export async function pollRender(
  id: string,
  signal?: AbortSignal,
  pollUrl?: string,
): Promise<RenderJobResponse> {
  const url = pollUrl ?? `/api/render/status?id=${encodeURIComponent(id)}`

  const res = await fetch(url, { cache: 'no-store', ...(signal && { signal }) })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Erreur statut (HTTP ${res.status}) : ${text || '(corps vide)'}`)
  }

  const text = await res.text()
  if (!text.trim()) {
    throw new Error('Le serveur a repondu avec un corps vide sur /status.')
  }

  try {
    return JSON.parse(text) as RenderJobResponse
  } catch {
    throw new Error(`Reponse /status invalide : ${text.slice(0, 200)}`)
  }
}
