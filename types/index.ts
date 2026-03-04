export type RenderStatus = 'idle' | 'uploading' | 'processing' | 'succeeded' | 'failed'

export interface MaterialsData {
  prompt: string
  style: string
  width: string
  depth: string
  height: string
  materials: string
}

/** Response from POST /webhook/bpcuisines-render/start */
export interface StartRenderResponse {
  id: string
  status: 'pending' | 'processing' | 'succeeded' | 'failed'
  /** Set immediately when the backend finishes synchronously */
  outputUrl?: string
  /** Explicit poll endpoint provided by the backend */
  pollUrl?: string
  error?: string
}

/** Response from GET /webhook/bpcuisines-render/status?id=… */
export interface RenderJobResponse {
  id: string
  status: 'pending' | 'processing' | 'succeeded' | 'failed'
  outputUrl?: string
  error?: string
}

export interface HistoryItem {
  id: string
  createdAt: string
  status: 'succeeded' | 'failed'
  imageUrl?: string
  prompt: string
  style: string
}
