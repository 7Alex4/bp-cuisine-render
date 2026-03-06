import { NextRequest, NextResponse } from 'next/server'
import { createStudioProject, listStudioProjects } from '@/lib/server/studio-repository'

export async function GET() {
  try {
    const projects = await listStudioProjects()
    return NextResponse.json({ projects })
  } catch (error) {
    return NextResponse.json(
      { error: `Impossible de lister les projets studio: ${String(error)}` },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  let body: { name?: string } = {}
  try {
    body = (await req.json()) as { name?: string }
  } catch {
    // Empty body is allowed, a default project will be created.
  }

  try {
    const project = await createStudioProject({ name: body.name })
    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: `Impossible de creer le projet studio: ${String(error)}` },
      { status: 500 },
    )
  }
}
