import type { Dimensions } from './validation'

/**
 * Replicate API wrapper - server-only.
 *
 * This project uses community image models, so predictions are created through
 * POST /v1/predictions with an explicit version ID.
 */

const REPLICATE_API_BASE = 'https://api.replicate.com/v1'
const REPLICATE_PREDICTIONS_ENDPOINT = `${REPLICATE_API_BASE}/predictions`
const DEFAULT_MODEL_OWNER = 'fofr'
const DEFAULT_MODEL_NAME = 'realvisxl-v3-multi-controlnet-lora'
const DEFAULT_MODEL_VERSION =
  '90a4a3604cd637cb9f1a2bdae1cfa9ed869362ca028814cdce310a78e27daade'

export interface ReplicateInput {
  prompt: string
  negative_prompt: string
  image?: string
  width?: number
  height?: number
  guidance_scale?: number
  prompt_strength?: number
  num_inference_steps?: number
  sizing_strategy?: 'width_height' | 'input_image' | 'controlnet_1_image' | 'controlnet_2_image'
  controlnet_1?: 'none' | 'depth_midas' | 'depth_leres' | 'lineart'
  controlnet_1_image?: string
  controlnet_1_conditioning_scale?: number
  controlnet_1_start?: number
  controlnet_1_end?: number
  controlnet_2?: 'none' | 'depth_midas' | 'depth_leres' | 'lineart'
  controlnet_2_image?: string
  controlnet_2_conditioning_scale?: number
  controlnet_2_start?: number
  controlnet_2_end?: number
  apply_watermark?: boolean
  disable_safety_checker?: boolean
  refine?: 'no_refiner' | 'base_image_refiner'
}

export interface BuildRenderPromptInput {
  style: string
  prompt: string
  dimensions: Dimensions
  materialsDescription: string
}

export interface BuildKitchenPredictionInputArgs {
  roomImageUrl: string
  sketchImageUrl: string
  prompt: string
}

export interface ReplicatePrediction {
  id: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  output: string[] | string | null
  error: string | null
  logs?: string
  metrics?: Record<string, unknown>
  urls?: { get?: string; cancel?: string }
  version?: string
}

export const DEFAULT_NEGATIVE_PROMPT =
  'empty room, unfurnished room, bare walls, lowres, blurry, distorted geometry, duplicated cabinets, warped perspective, floating objects, extra windows, extra appliances, watermark, text, cartoon, low detail, overexposed, underexposed'

export function buildRenderPrompt({
  style,
  prompt,
  dimensions,
  materialsDescription,
}: BuildRenderPromptInput): string {
  return [
    `Photorealistic ${style} kitchen renovation, premium interior design render, ultra detailed, realistic materials, natural daylight`,
    'Respect the provided room architecture, openings, camera perspective, circulation and kitchen layout from the sketch',
    prompt.trim(),
    materialsDescription.trim()
      ? `Materials and finishes: ${materialsDescription.trim()}`
      : '',
    `Room dimensions: ${dimensions.width}m width x ${dimensions.depth}m depth x ${dimensions.height}m height`,
  ]
    .filter(Boolean)
    .join('. ')
}

export function buildKitchenModelPrompt({
  style,
  prompt,
  materialsDescription,
}: Omit<BuildRenderPromptInput, 'dimensions'>): string {
  const trimmedPrompt = prompt.trim()
  const trimmedMaterials = materialsDescription.trim()

  return [
    `Photorealistic ${style} kitchen renovation`,
    'preserve the room perspective and windows',
    'strictly follow the provided sketch layout',
    trimmedPrompt,
    trimmedMaterials ? `materials: ${trimmedMaterials}` : '',
  ]
    .filter(Boolean)
    .join(', ')
}

export function buildKitchenPredictionInput({
  roomImageUrl,
  sketchImageUrl,
  prompt,
}: BuildKitchenPredictionInputArgs): ReplicateInput {
  return {
    prompt,
    negative_prompt: DEFAULT_NEGATIVE_PROMPT,
    image: roomImageUrl,
    prompt_strength: 0.72,
    guidance_scale: 8,
    num_inference_steps: 28,
    sizing_strategy: 'input_image',
    controlnet_1: 'depth_midas',
    controlnet_1_image: roomImageUrl,
    controlnet_1_conditioning_scale: 0.95,
    controlnet_1_start: 0,
    controlnet_1_end: 0.75,
    controlnet_2: 'lineart',
    controlnet_2_image: sketchImageUrl,
    controlnet_2_conditioning_scale: 1.35,
    controlnet_2_start: 0,
    controlnet_2_end: 1,
    apply_watermark: false,
    disable_safety_checker: true,
    refine: 'no_refiner',
  }
}

export function getReplicateModelSlug(): string {
  const owner = process.env.REPLICATE_MODEL_OWNER?.trim() || DEFAULT_MODEL_OWNER
  const name = process.env.REPLICATE_MODEL_NAME?.trim() || DEFAULT_MODEL_NAME
  return `${owner}/${name}`
}

export function getReplicateModelVersion(): string {
  return process.env.REPLICATE_MODEL_VERSION?.trim() || DEFAULT_MODEL_VERSION
}

function authHeaders() {
  const token = process.env.REPLICATE_API_TOKEN
  if (!token) throw new Error('Missing env var: REPLICATE_API_TOKEN')

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

export async function getModelMetadata(): Promise<unknown> {
  const res = await fetch(`${REPLICATE_API_BASE}/models/${getReplicateModelSlug()}`, {
    headers: authHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(
      `Replicate get model ${getReplicateModelSlug()} failed (HTTP ${res.status}): ${text}`,
    )
  }

  return res.json()
}

export async function startPrediction(input: ReplicateInput): Promise<ReplicatePrediction> {
  const version = getReplicateModelVersion()

  const res = await fetch(REPLICATE_PREDICTIONS_ENDPOINT, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ version, input }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(
      `Replicate start prediction failed for ${getReplicateModelSlug()}@${version} (HTTP ${res.status}): ${text}`,
    )
  }

  return res.json() as Promise<ReplicatePrediction>
}

export async function getPrediction(predictionId: string): Promise<ReplicatePrediction> {
  const res = await fetch(`${REPLICATE_API_BASE}/predictions/${predictionId}`, {
    headers: authHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(
      `Replicate get prediction ${predictionId} failed (HTTP ${res.status}): ${text}`,
    )
  }

  return res.json() as Promise<ReplicatePrediction>
}

export function extractOutputUrl(output: string[] | string | null | undefined): string | null {
  if (!output) return null
  if (Array.isArray(output)) {
    const urls = output.filter((value): value is string => typeof value === 'string' && !!value)
    if (urls.length === 0) return null

    const finalUrl =
      urls.find((value) => /\/(?:out|output)(?:-\d+)?\.(?:png|jpe?g|webp)$/i.test(value)) ??
      urls.find((value) => !/\/control-\d+\.(?:png|jpe?g|webp)$/i.test(value))

    return finalUrl ?? null
  }
  return output
}
