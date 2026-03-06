/**
 * Unit tests for lib/server/replicate.ts.
 * Run with: node --experimental-strip-types --test tests/replicate.test.ts
 */
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  buildKitchenPredictionInput,
  buildKitchenModelPrompt,
  buildRenderPrompt,
  DEFAULT_NEGATIVE_PROMPT,
  extractOutputUrl,
  getReplicateModelSlug,
  getReplicateModelVersion,
} from '../lib/server/replicate.ts'

const ORIGINAL_MODEL_OWNER = process.env.REPLICATE_MODEL_OWNER
const ORIGINAL_MODEL_NAME = process.env.REPLICATE_MODEL_NAME
const ORIGINAL_MODEL_VERSION = process.env.REPLICATE_MODEL_VERSION

afterEach(() => {
  process.env.REPLICATE_MODEL_OWNER = ORIGINAL_MODEL_OWNER
  process.env.REPLICATE_MODEL_NAME = ORIGINAL_MODEL_NAME
  process.env.REPLICATE_MODEL_VERSION = ORIGINAL_MODEL_VERSION
})

describe('extractOutputUrl', () => {
  it('returns first element of a string array', () => {
    assert.equal(
      extractOutputUrl(['https://example.com/img1.jpg', 'https://example.com/img2.jpg']),
      'https://example.com/img1.jpg',
    )
  })

  it('returns the string directly when output is a plain string', () => {
    assert.equal(extractOutputUrl('https://example.com/img.jpg'), 'https://example.com/img.jpg')
  })

  it('returns null for null', () => {
    assert.equal(extractOutputUrl(null), null)
  })

  it('returns null for undefined', () => {
    assert.equal(extractOutputUrl(undefined), null)
  })

  it('returns null for an empty array', () => {
    assert.equal(extractOutputUrl([]), null)
  })

  it('prefers the final out image when control maps are present', () => {
    assert.equal(
      extractOutputUrl([
        'https://example.com/control-0.png',
        'https://example.com/control-1.png',
        'https://example.com/out-0.png',
      ]),
      'https://example.com/out-0.png',
    )
  })

  it('returns null when an array only contains control maps', () => {
    assert.equal(
      extractOutputUrl([
        'https://example.com/control-0.png',
        'https://example.com/control-1.png',
      ]),
      null,
    )
  })

  it('returns null for an array with only undefined elements', () => {
    // @ts-expect-error testing malformed external data
    assert.equal(extractOutputUrl([undefined]), null)
  })
})

describe('buildRenderPrompt', () => {
  it('includes style, user prompt, dimensions and materials', () => {
    const prompt = buildRenderPrompt({
      style: 'Scandinavian',
      prompt: 'ilot central et circulation fluide',
      dimensions: { width: 5, depth: 3, height: 2.7 },
      materialsDescription: 'facades blanches et robinet bronze',
    })

    assert.match(prompt, /Scandinavian/)
    assert.match(prompt, /ilot central et circulation fluide/)
    assert.match(prompt, /facades blanches et robinet bronze/)
    assert.match(prompt, /Room dimensions: 5m width x 3m depth x 2.7m height/)
    assert.match(prompt, /Respect the provided room architecture/)
  })

  it('omits the materials sentence when description is blank', () => {
    const prompt = buildRenderPrompt({
      style: 'Minimalist',
      prompt: 'facades sans poignees',
      dimensions: { width: 4, depth: 2.8, height: 2.5 },
      materialsDescription: '   ',
    })

    assert.doesNotMatch(prompt, /Materials and finishes:/)
  })
})

describe('buildKitchenModelPrompt', () => {
  it('keeps the runtime prompt concise and focused on layout fidelity', () => {
    const prompt = buildKitchenModelPrompt({
      style: 'Scandinavian',
      prompt: 'ilot central, circulation fluide, colonnes fours',
      materialsDescription: 'facades blanches, plan de travail pierre claire, robinet bronze',
    })

    assert.match(prompt, /Scandinavian/)
    assert.match(prompt, /follow the provided sketch layout/)
    assert.doesNotMatch(prompt, /Room dimensions:/)
    assert.match(prompt, /materials:/)
  })
})

describe('buildKitchenPredictionInput', () => {
  it('maps room and sketch images to stable multi-control inputs', () => {
    const input = buildKitchenPredictionInput({
      roomImageUrl: 'https://example.com/room.jpg',
      sketchImageUrl: 'https://example.com/sketch.jpg',
      prompt: 'Kitchen prompt',
    })

    assert.equal(input.image, 'https://example.com/room.jpg')
    assert.equal(input.prompt_strength, 0.72)
    assert.equal(input.guidance_scale, 8)
    assert.equal(input.num_inference_steps, 28)
    assert.equal(input.controlnet_1, 'depth_midas')
    assert.equal(input.controlnet_1_image, 'https://example.com/room.jpg')
    assert.equal(input.controlnet_2, 'lineart')
    assert.equal(input.controlnet_2_image, 'https://example.com/sketch.jpg')
    assert.equal(input.disable_safety_checker, true)
    assert.equal(input.negative_prompt, DEFAULT_NEGATIVE_PROMPT)
  })
})

describe('Replicate model config', () => {
  it('uses stable defaults when env overrides are absent', () => {
    delete process.env.REPLICATE_MODEL_OWNER
    delete process.env.REPLICATE_MODEL_NAME
    delete process.env.REPLICATE_MODEL_VERSION

    assert.equal(getReplicateModelSlug(), 'fofr/realvisxl-v3-multi-controlnet-lora')
    assert.equal(
      getReplicateModelVersion(),
      '90a4a3604cd637cb9f1a2bdae1cfa9ed869362ca028814cdce310a78e27daade',
    )
  })

  it('uses env overrides when provided', () => {
    process.env.REPLICATE_MODEL_OWNER = 'custom-owner'
    process.env.REPLICATE_MODEL_NAME = 'custom-model'
    process.env.REPLICATE_MODEL_VERSION = 'custom-version'

    assert.equal(getReplicateModelSlug(), 'custom-owner/custom-model')
    assert.equal(getReplicateModelVersion(), 'custom-version')
  })
})
