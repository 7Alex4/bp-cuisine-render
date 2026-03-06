export type RenderStatus = 'idle' | 'uploading' | 'processing' | 'succeeded' | 'failed'

export interface MaterialsData {
  prompt: string
  style: string
  width: string
  depth: string
  height: string
  materials: string
}

/** Response from POST /api/render/start */
export interface StartRenderResponse {
  id: string
  status: 'processing' | 'succeeded' | 'failed'
  outputUrl: string | null
  /** Explicit poll endpoint provided by the backend */
  pollUrl?: string
  error: string | null
}

/** Response from GET /api/render/status?id=... */
export interface RenderJobResponse {
  id: string
  status: 'processing' | 'succeeded' | 'failed' | 'not_found'
  outputUrl: string | null
  error: string | null
  progress: number | null
  updatedAt: string | null
}

export interface HistoryItem {
  id: string
  createdAt: string
  status: 'succeeded' | 'failed'
  imageUrl?: string
  prompt: string
  style: string
}
