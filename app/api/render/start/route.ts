/**
 * POST /api/render/start
 *
 * Accepts multipart FormData:
 *   room       (File)   - photo of empty room
 *   sketch     (File)   - hand-drawn 2D plan sketch cleaned client-side for lineart control
 *   prompt     (string) - free-text design prompt
 *   style      (string) - kitchen style
 *   dimensions (JSON)   - {"width":4,"depth":5,"height":2.6}
 *   materials  (JSON)   - {"description":"laque blanche, marbre calacatta"}
 *
 * Returns 202 { id, status: "processing", pollUrl, outputUrl: null, error: null }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createJob, updateJob } from '@/lib/server/db'
import {
  buildKitchenPredictionInput,
  buildKitchenModelPrompt,
  buildRenderPrompt,
  startPrediction,
} from '@/lib/server/replicate'
import { getPublicUrl, uploadFileToStorage } from '@/lib/server/storage'
import {
  parseDimensions,
  parseMaterials,
  validateImageFile,
} from '@/lib/server/validation'

function fileExtensionForMimeType(mimeType: string | undefined): string {
  switch ((mimeType || '').toLowerCase()) {
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    default:
      return 'jpg'
  }
}

export async function POST(req: NextRequest) {
  console.log('[render/start] request received')

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
  }

  const roomFile = formData.get('room')
  const sketchValue = formData.get('sketch')
  const sketchFile = sketchValue instanceof File && sketchValue.size > 0 ? sketchValue : null

  if (!(roomFile instanceof File)) {
    return NextResponse.json({ error: "Champ 'room' manquant (fichier image requis)" }, { status: 400 })
  }
  if (!sketchFile) {
    return NextResponse.json(
      { error: "Champ 'sketch' manquant (croquis 2D requis pour guider l'implantation)" },
      { status: 400 },
    )
  }

  const roomErr = validateImageFile(roomFile, 'room')
  if (roomErr) return NextResponse.json({ error: roomErr.message }, { status: 400 })

  const sketchErr = validateImageFile(sketchFile, 'sketch')
  if (sketchErr) return NextResponse.json({ error: sketchErr.message }, { status: 400 })

  const prompt = ((formData.get('prompt') as string) || '').trim()
  const style = ((formData.get('style') as string) || 'moderne').trim()
  const dimensionsRaw = (formData.get('dimensions') as string) || '{}'
  const materialsRaw = (formData.get('materials') as string) || '{}'

  const { value: dimensions, error: dimError } = parseDimensions(dimensionsRaw)
  if (dimError) return NextResponse.json({ error: dimError }, { status: 400 })

  const { value: materials } = parseMaterials(materialsRaw)

  const jobId = crypto.randomUUID()
  const fullPrompt = buildRenderPrompt({
    style,
    prompt,
    dimensions: dimensions!,
    materialsDescription: materials.description,
  })
  const modelPrompt = buildKitchenModelPrompt({
    style,
    prompt,
    materialsDescription: materials.description,
  })

  let roomStoragePath: string
  let sketchStoragePath: string
  let roomPublicUrl: string
  let sketchPublicUrl: string

  try {
    const roomBuffer = Buffer.from(await roomFile.arrayBuffer())
    const roomStorageFilename = `${jobId}/room.${fileExtensionForMimeType(roomFile.type)}`
    roomStoragePath = await uploadFileToStorage(
      roomStorageFilename,
      roomBuffer,
      roomFile.type || 'image/jpeg',
    )
    roomPublicUrl = getPublicUrl(roomStoragePath)
    console.log(`[render/start] room uploaded -> ${roomStoragePath}`)
  } catch (error) {
    console.error('[render/start] room upload error:', error)
    return NextResponse.json(
      { error: `Upload room image failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }

  try {
    const sketchBuffer = Buffer.from(await sketchFile.arrayBuffer())
    const sketchStorageFilename = `${jobId}/sketch.${fileExtensionForMimeType(sketchFile.type)}`
    sketchStoragePath = await uploadFileToStorage(
      sketchStorageFilename,
      sketchBuffer,
      sketchFile.type || 'image/jpeg',
    )
    sketchPublicUrl = getPublicUrl(sketchStoragePath)
    console.log(`[render/start] sketch uploaded -> ${sketchStoragePath}`)
  } catch (error) {
    console.error('[render/start] sketch upload error:', error)
    return NextResponse.json(
      { error: `Upload sketch image failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }

  try {
    await createJob({
      id: jobId,
      full_prompt: fullPrompt,
      style,
      dimensions: dimensionsRaw,
      materials: materialsRaw,
      room_storage_path: roomStoragePath,
      sketch_storage_path: sketchStoragePath,
    })
    console.log(`[render/start] job ${jobId} inserted into DB`)
  } catch (error) {
    console.error('[render/start] DB insert error:', error)
    return NextResponse.json(
      { error: `Database error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }

  let replicateId: string
  try {
    const prediction = await startPrediction(
      buildKitchenPredictionInput({
        roomImageUrl: roomPublicUrl,
        sketchImageUrl: sketchPublicUrl,
        prompt: modelPrompt,
      }),
    )

    if (!prediction?.id) {
      throw new Error(
        `Replicate did not return a prediction ID. Response: ${JSON.stringify(prediction)}`,
      )
    }

    replicateId = prediction.id
    console.log(`[render/start] Replicate prediction started: ${replicateId}`)
  } catch (error) {
    console.error('[render/start] Replicate error:', error)
    await updateJob(jobId, {
      status: 'failed',
      error_message: `Replicate start failed: ${error instanceof Error ? error.message : String(error)}`,
    }).catch(() => {})

    return NextResponse.json(
      { error: `Replicate error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }

  try {
    await updateJob(jobId, { replicate_id: replicateId })
    console.log(`[render/start] replicate_id saved: ${replicateId}`)
  } catch (error) {
    console.error('[render/start] failed to save replicate_id (non-fatal):', error)
  }

  return NextResponse.json(
    {
      id: jobId,
      status: 'processing',
      pollUrl: `/api/render/status?id=${jobId}`,
      outputUrl: null,
      error: null,
    },
    { status: 202 },
  )
}
