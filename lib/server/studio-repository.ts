import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createBlankStudioScene } from '../studio/catalog.ts'
import { getVisualDossierSummary } from '../studio/project-summary.ts'
import type {
  RevisionSource,
  SurveyCompletenessStatus,
  StudioProjectRecord,
  StudioProjectRevision,
  StudioProjectSummary,
  StudioScene,
} from '../studio/schema.ts'
import { normalizeSiteSurvey, normalizeStudioScene, validateSiteSurvey } from '../studio/schema.ts'

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

function uploadsDir(projectId: string): string {
  return path.join(projectDir(projectId), 'uploads')
}

function blenderPackagesDir(projectId: string): string {
  return path.join(DATA_ROOT, 'blender-packages', projectId)
}

function blenderRendersDir(projectId: string): string {
  return path.join(DATA_ROOT, 'blender-renders', projectId)
}

export function getProjectUploadPath(projectId: string, fileName: string): string {
  return path.join(uploadsDir(projectId), fileName)
}

export async function saveProjectUpload(
  projectId: string,
  fileName: string,
  data: Buffer,
): Promise<void> {
  const dir = uploadsDir(projectId)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, fileName), data)
}

export async function deleteProjectUpload(projectId: string, fileName: string): Promise<void> {
  await fs.rm(getProjectUploadPath(projectId, fileName), { force: true })
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

function isHiddenStudioProject(project: Pick<StudioProjectSummary, 'name'>): boolean {
  return project.name.startsWith('Validation Blender ')
}

function deriveSurveyStage(scene: StudioScene): SurveyCompletenessStatus {
  return validateSiteSurvey(scene.siteSurvey).workflow.stage
}

function deriveVisualDossier(scene: StudioScene): Pick<
  StudioProjectSummary,
  'visualDossierStatus' | 'visualDossierScore'
> {
  const dossier = getVisualDossierSummary(scene)
  return {
    visualDossierStatus: dossier.status,
    visualDossierScore: dossier.score,
  }
}

function deriveProjectStatus(
  currentStatus: StudioProjectSummary['status'],
  surveyStage: SurveyCompletenessStatus,
): StudioProjectSummary['status'] {
  if (currentStatus === 'rendering') return 'rendering'
  return surveyStage === 'pret' || surveyStage === 'suffisant' ? 'ready' : 'draft'
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
      if (isHiddenStudioProject(record)) continue
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
  const name = input?.name?.trim() || 'Nouveau projet'
  const scene = normalizeStudioScene(input?.scene || createBlankStudioScene(id, name))
  const surveyStage = deriveSurveyStage(scene)

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
    status: deriveProjectStatus('draft', surveyStage),
    surveyStage,
    ...deriveVisualDossier(scene),
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
    const record = await readJsonFile<StudioProjectRecord>(projectFile(projectId))
    const nextScene = normalizeStudioScene({
      ...record.scene,
      siteSurvey: normalizeSiteSurvey(record.scene.siteSurvey),
    })
    const surveyStage = deriveSurveyStage(nextScene)
    return {
      ...record,
      status: deriveProjectStatus(record.status, surveyStage),
      surveyStage,
      ...deriveVisualDossier(nextScene),
      scene: nextScene,
    }
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
  },
): Promise<StudioProjectRecord> {
  const existing = await getStudioProject(projectId)
  if (!existing) {
    throw new Error(`Unknown project: ${projectId}`)
  }

  const revisionNumber = existing.latestRevisionNumber + 1
  const updatedAt = new Date().toISOString()
  const nextName = input.name?.trim() || input.scene.name || existing.name
  const normalizedInputScene = normalizeStudioScene(input.scene)
  const siteSurveyValidation = validateSiteSurvey(normalizedInputScene.siteSurvey)
  const nextScene: StudioScene = {
    ...normalizedInputScene,
    id: existing.id,
    name: nextName,
    version: Math.max(existing.scene.version + 1, normalizedInputScene.version || 1),
    siteSurvey: {
      ...normalizeSiteSurvey(normalizedInputScene.siteSurvey),
      completeness: siteSurveyValidation.completeness,
    },
  }

  const surveyStage = siteSurveyValidation.workflow.stage
  const nextStatus = deriveProjectStatus(existing.status, surveyStage)

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
    status: nextStatus,
    surveyStage,
    ...deriveVisualDossier(nextScene),
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

export async function deleteStudioProject(projectId: string): Promise<void> {
  const project = await getStudioProject(projectId)
  if (!project) {
    throw new Error(`Unknown project: ${projectId}`)
  }

  await Promise.all([
    fs.rm(projectDir(projectId), { recursive: true, force: true }),
    fs.rm(blenderPackagesDir(projectId), { recursive: true, force: true }),
    fs.rm(blenderRendersDir(projectId), { recursive: true, force: true }),
  ])
}

function toProjectSummary(project: StudioProjectRecord): StudioProjectSummary {
  const surveyStage = deriveSurveyStage(project.scene)
  return {
    id: project.id,
    name: project.name,
    status: deriveProjectStatus(project.status, surveyStage),
    surveyStage,
    ...deriveVisualDossier(project.scene),
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

export async function setProjectStatus(
  projectId: string,
  status: StudioProjectSummary['status'],
): Promise<void> {
  const project = await getStudioProject(projectId)
  if (!project) return
  await writeProject({ ...project, status, updatedAt: new Date().toISOString() })
}
