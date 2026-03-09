import { deleteProjectUpload, getProjectUploadPath, getStudioProject } from '@/lib/server/studio-repository'
import { promises as fs } from 'node:fs'
import { NextRequest, NextResponse } from 'next/server'

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileName: string }> },
): Promise<NextResponse> {
  const { id, fileName } = await params

  if (fileName.includes('/') || fileName.includes('..') || fileName.includes('\0')) {
    return NextResponse.json({ error: 'Nom de fichier invalide' }, { status: 400 })
  }

  const filePath = getProjectUploadPath(id, fileName)

  try {
    const data = await fs.readFile(filePath)
    const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
    const contentType = EXT_TO_MIME[ext] ?? 'application/octet-stream'
    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=86400',
      },
    })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 })
    }
    throw err
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileName: string }> },
): Promise<NextResponse> {
  const { id, fileName } = await params

  if (fileName.includes('/') || fileName.includes('..') || fileName.includes('\0')) {
    return NextResponse.json({ error: 'Nom de fichier invalide' }, { status: 400 })
  }

  const project = await getStudioProject(id)
  if (!project) {
    return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })
  }

  await deleteProjectUpload(id, fileName)
  return NextResponse.json({ ok: true })
}
