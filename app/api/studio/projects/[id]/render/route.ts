import { NextRequest, NextResponse } from 'next/server'
import { isBlenderConfigured, runBlenderRender, writeBlenderRenderPackage } from '@/lib/server/blender'
import { getStudioProject, setProjectStatus } from '@/lib/server/studio-repository'

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

    await setProjectStatus(id, 'rendering')
    let result
    try {
      result = await runBlenderRender(project)
    } catch (renderError) {
      await setProjectStatus(id, 'draft').catch(() => {})
      throw renderError
    }
    await setProjectStatus(id, 'ready')
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
