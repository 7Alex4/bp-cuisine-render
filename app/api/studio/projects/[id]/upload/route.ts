import { getStudioProject, saveProjectUpload } from '@/lib/server/studio-repository'
import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
])
const MAX_SIZE_BYTES = 20 * 1024 * 1024

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params

  const project = await getStudioProject(id)
  if (!project) {
    return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Corps de requete invalide' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Champ "file" manquant dans le formulaire' }, { status: 400 })
  }

  if (file.size === 0) {
    return NextResponse.json({ error: 'Le fichier est vide' }, { status: 400 })
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 20 Mo)' }, { status: 413 })
  }

  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Type de fichier non autorise : ${file.type}` },
      { status: 415 },
    )
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const fileName = `${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await saveProjectUpload(id, fileName, buffer)

  return NextResponse.json({
    fileName,
    url: `/api/studio/projects/${id}/uploads/${fileName}`,
  })
}
