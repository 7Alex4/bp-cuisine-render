import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createDefaultStudioScene } from '../studio/catalog.ts'
import type {
  RevisionSource,
  StudioProjectRecord,
  StudioProjectRevision,
  StudioProjectSummary,
  StudioScene,
} from '../studio/schema.ts'

const DATA_ROOT = process.env.STUDIO_DATA_DIR || path.join(process.cwd(), '.data', 'studio')

function projectDir(projectId: string): string {
  return path.join(DATA_ROOT, 'projects', projectId)
}

function projectFile(projectId: string): string {
  return path.join(projectDir(projectId), 'project.json')
}

function revisionsDir(projectId: string): string {
  return path.join(projectDir(projectId), 'revisions')
}

function revisionFile(projectId: string, revisionNumber: number): string {
  return path.join(revisionsDir(projectId), `${String(revisionNumber).padStart(4, '0')}.json`)
}

async function ensureStudioRoot(): Promise<void> {
  await fs.mkdir(path.join(DATA_ROOT, 'projects'), { recursive: true })
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw) as T
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function listStudioProjects(): Promise<StudioProjectSummary[]> {
  await ensureStudioRoot()
  const projectsRoot = path.join(DATA_ROOT, 'projects')
  const entries = await fs.readdir(projectsRoot, { withFileTypes: true })
  const projects: StudioProjectSummary[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    try {
      const record = await readJsonFile<StudioProjectRecord>(projectFile(entry.name))
      projects.push(toProjectSummary(record))
    } catch {
      // Ignore malformed folders and keep listing the valid projects.
    }
  }

  return projects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function createStudioProject(input?: {
  name?: string
  scene?: StudioScene
}): Promise<StudioProjectRecord> {
  await ensureStudioRoot()

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const name = input?.name?.trim() || 'Projet cuisine'
  const scene = input?.scene || createDefaultStudioScene(id, name)

  const initialRevision: StudioProjectRevision = {
    id: crypto.randomUUID(),
    projectId: id,
    revisionNumber: 1,
    createdAt: now,
    source: 'seed',
    scene,
  }

  const record: StudioProjectRecord = {
    id,
    name,
    status: 'draft',
    latestRevisionNumber: 1,
    createdAt: now,
    updatedAt: now,
    scene,
    revisions: [initialRevision],
  }

  await writeProject(record)
  await writeRevision(initialRevision)
  return record
}

export async function getStudioProject(projectId: string): Promise<StudioProjectRecord | null> {
  try {
    return await readJsonFile<StudioProjectRecord>(projectFile(projectId))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function saveStudioProject(
  projectId: string,
  input: {
    name?: string
    scene: StudioScene
    source?: RevisionSource
    status?: StudioProjectSummary['status']
  },
): Promise<StudioProjectRecord> {
  const existing = await getStudioProject(projectId)
  if (!existing) {
    throw new Error(`Unknown project: ${projectId}`)
  }

  const revisionNumber = existing.latestRevisionNumber + 1
  const updatedAt = new Date().toISOString()
  const nextName = input.name?.trim() || input.scene.name || existing.name
  const nextScene: StudioScene = {
    ...input.scene,
    id: existing.id,
    name: nextName,
    version: Math.max(existing.scene.version + 1, input.scene.version || 1),
  }

  const revision: StudioProjectRevision = {
    id: crypto.randomUUID(),
    projectId,
    revisionNumber,
    createdAt: updatedAt,
    source: input.source || 'manual',
    scene: nextScene,
  }

  const record: StudioProjectRecord = {
    ...existing,
    name: nextName,
    scene: nextScene,
    status: input.status || existing.status,
    latestRevisionNumber: revisionNumber,
    updatedAt,
    revisions: [...existing.revisions, revision],
  }

  await writeProject(record)
  await writeRevision(revision)
  return record
}

export async function listStudioRevisions(projectId: string): Promise<StudioProjectRevision[]> {
  const project = await getStudioProject(projectId)
  return project?.revisions || []
}

function toProjectSummary(project: StudioProjectRecord): StudioProjectSummary {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    latestRevisionNumber: project.latestRevisionNumber,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
}

async function writeProject(record: StudioProjectRecord): Promise<void> {
  await writeJsonFile(projectFile(record.id), record)
}

async function writeRevision(revision: StudioProjectRevision): Promise<void> {
  await writeJsonFile(revisionFile(revision.projectId, revision.revisionNumber), revision)
}
