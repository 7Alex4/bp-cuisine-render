import { NextRequest, NextResponse } from 'next/server'
import { getStudioProject } from '@/lib/server/studio-repository'
import { compileStudioScene } from '@/lib/studio/compiler'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const project = await getStudioProject(id)
    if (!project) {
      return NextResponse.json({ error: 'Projet studio introuvable' }, { status: 404 })
    }

    return NextResponse.json({ compiled: compileStudioScene(project.scene) })
  } catch (error) {
    return NextResponse.json(
      { error: `Impossible de compiler la scene studio: ${String(error)}` },
      { status: 500 },
    )
  }
}
