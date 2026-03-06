import { NextRequest, NextResponse } from 'next/server'
import { isBlenderConfigured, runBlenderRender, writeBlenderRenderPackage } from '@/lib/server/blender'
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

    if (!isBlenderConfigured()) {
      const result = await writeBlenderRenderPackage(project)
      return NextResponse.json(
        {
          error: 'BLENDER_PATH n est pas configure. Le package a ete genere mais le rendu final ne peut pas etre lance.',
          packagePath: result.filePath,
        },
        { status: 501 },
      )
    }

    const result = await runBlenderRender(project)
    return NextResponse.json({
      packagePath: result.packagePath,
      outputDir: result.outputDir,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    })
  } catch (error) {
    return NextResponse.json(
      { error: `Impossible de lancer le rendu Blender: ${String(error)}` },
      { status: 500 },
    )
  }
}
