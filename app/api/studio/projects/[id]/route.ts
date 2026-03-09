import { NextRequest, NextResponse } from 'next/server'
import { deleteStudioProject, getStudioProject, saveStudioProject } from '@/lib/server/studio-repository'
import type { RevisionSource, StudioScene } from '@/lib/studio/schema'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const project = await getStudioProject(id)
    if (!project) {
      return NextResponse.json({ error: 'Projet studio introuvable' }, { status: 404 })
    }
    return NextResponse.json({ project })
  } catch (error) {
    return NextResponse.json(
      { error: `Impossible de charger le projet studio: ${String(error)}` },
      { status: 500 },
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: { name?: string; scene?: StudioScene; source?: RevisionSource }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  if (!body?.scene) {
    return NextResponse.json({ error: 'scene manquante dans le corps de la requete' }, { status: 400 })
  }

  try {
    const project = await saveStudioProject(id, {
      name: body.name,
      scene: body.scene,
      source: body.source || 'manual',
    })
    return NextResponse.json({ project })
  } catch (error) {
    const message = String(error)
    return NextResponse.json(
      { error: message },
      { status: message.startsWith('Unknown project:') ? 404 : 500 },
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    await deleteStudioProject(id)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    const message = String(error)
    return NextResponse.json(
      { error: message },
      { status: message.startsWith('Unknown project:') ? 404 : 500 },
    )
  }
}
