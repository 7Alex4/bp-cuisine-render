import { NextRequest, NextResponse } from 'next/server'
import { getJob, updateJob } from '@/lib/server/db'
import { extractOutputUrl, getPrediction } from '@/lib/server/replicate'
import { getPublicUrl, uploadFileToStorage } from '@/lib/server/storage'

const THROTTLE_MS = 3_000

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: "Parametre 'id' manquant" }, { status: 400 })
  }

  console.log(`[render/status] polling job ${id}`)

  let job: Awaited<ReturnType<typeof getJob>>
  try {
    job = await getJob(id)
  } catch (error) {
    console.error('[render/status] DB getJob error:', error)
    return NextResponse.json(
      { error: `Database error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }

  if (!job) {
    return NextResponse.json(
      {
        id,
        status: 'not_found',
        outputUrl: null,
        error: 'Job introuvable',
        progress: null,
        updatedAt: null,
      },
      { status: 404 },
    )
  }

  if (job.status === 'succeeded') {
    return NextResponse.json({
      id,
      status: 'succeeded',
      outputUrl: job.output_url,
      error: null,
      progress: null,
      updatedAt: job.updated_at,
    })
  }

  if (job.status === 'failed' || job.status === 'canceled') {
    return NextResponse.json({
      id,
      status: 'failed',
      outputUrl: null,
      error: job.error_message || 'Le rendu a echoue.',
      progress: null,
      updatedAt: job.updated_at,
    })
  }

  if (!job.replicate_id) {
    return NextResponse.json({
      id,
      status: 'processing',
      outputUrl: null,
      error: null,
      progress: null,
      updatedAt: job.updated_at,
    })
  }

  const lastChecked = job.last_checked_at ? new Date(job.last_checked_at) : null
  const msSinceCheck = lastChecked ? Date.now() - lastChecked.getTime() : Infinity
  if (msSinceCheck < THROTTLE_MS) {
    console.log(`[render/status] throttled (${Math.round(msSinceCheck)}ms since last check)`)
    return NextResponse.json({
      id,
      status: 'processing',
      outputUrl: null,
      error: null,
      progress: null,
      updatedAt: job.updated_at,
    })
  }

  let prediction: Awaited<ReturnType<typeof getPrediction>>
  try {
    prediction = await getPrediction(job.replicate_id)
    console.log(`[render/status] Replicate ${job.replicate_id} -> ${prediction.status}`)
  } catch (error) {
    console.error('[render/status] Replicate poll error:', error)
    return NextResponse.json(
      { error: `Replicate poll failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 502 },
    )
  }

  await updateJob(id, { last_checked_at: new Date().toISOString() }).catch((error) =>
    console.error('[render/status] update last_checked_at failed:', error),
  )

  if (prediction.status === 'succeeded') {
    const replicateUrl = extractOutputUrl(prediction.output)

    if (!replicateUrl) {
      await updateJob(id, {
        status: 'failed',
        error_message: 'Replicate succeeded but returned no output URL',
      }).catch(() => {})

      return NextResponse.json({
        id,
        status: 'failed',
        outputUrl: null,
        error: 'Replicate succeeded but returned no output URL',
        progress: null,
        updatedAt: new Date().toISOString(),
      })
    }

    let outputUrl = replicateUrl
    try {
      console.log('[render/status] downloading render from Replicate')
      const imageRes = await fetch(replicateUrl)
      if (!imageRes.ok) throw new Error(`HTTP ${imageRes.status}`)

      const imageBuffer = Buffer.from(await imageRes.arrayBuffer())
      const contentType = imageRes.headers.get('content-type') || 'image/jpeg'
      await uploadFileToStorage(`${id}/output.jpg`, imageBuffer, contentType)
      outputUrl = getPublicUrl(`${id}/output.jpg`)
      console.log(`[render/status] render stored at ${id}/output.jpg`)
    } catch (error) {
      console.error('[render/status] image re-host failed, using Replicate URL as fallback:', error)
    }

    await updateJob(id, { status: 'succeeded', output_url: outputUrl }).catch((error) =>
      console.error('[render/status] update succeeded failed:', error),
    )

    return NextResponse.json({
      id,
      status: 'succeeded',
      outputUrl,
      error: null,
      progress: null,
      updatedAt: new Date().toISOString(),
    })
  }

  if (prediction.status === 'failed' || prediction.status === 'canceled') {
    const errorMsg = prediction.error || `Replicate prediction ${prediction.status}`
    await updateJob(id, { status: 'failed', error_message: errorMsg }).catch((error) =>
      console.error('[render/status] update failed status error:', error),
    )

    return NextResponse.json({
      id,
      status: 'failed',
      outputUrl: null,
      error: errorMsg,
      progress: null,
      updatedAt: new Date().toISOString(),
    })
  }

  return NextResponse.json({
    id,
    status: 'processing',
    outputUrl: null,
    error: null,
    progress: null,
    updatedAt: job.updated_at,
  })
}
