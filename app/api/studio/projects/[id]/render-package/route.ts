import { NextRequest, NextResponse } from 'next/server'
import { isBlenderConfigured, writeBlenderRenderPackage } from '@/lib/server/blender'
import { getStudioProject } from '@/lib/server/studio-repository'

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

    const result = await writeBlenderRenderPackage(project)
    return NextResponse.json({
      blenderConfigured: isBlenderConfigured(),
      packagePath: result.filePath,
      packageData: result.packageData,
    })
  } catch (error) {
    return NextResponse.json(
      { error: `Impossible de generer le package Blender: ${String(error)}` },
      { status: 500 },
    )
  }
}
