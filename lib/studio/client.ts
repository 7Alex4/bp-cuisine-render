import type {
  BlenderRenderPackage,
  CompiledScene,
  StudioProjectRecord,
  StudioProjectSummary,
  StudioScene,
} from './schema'

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text || res.statusText)
  }
  return JSON.parse(text) as T
}

export async function listStudioProjectsRequest(): Promise<StudioProjectSummary[]> {
  const res = await fetch('/api/studio/projects', { cache: 'no-store' })
  const body = await readJson<{ projects: StudioProjectSummary[] }>(res)
  return body.projects
}

export async function createStudioProjectRequest(name?: string): Promise<StudioProjectRecord> {
  const res = await fetch('/api/studio/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const body = await readJson<{ project: StudioProjectRecord }>(res)
  return body.project
}

export async function getStudioProjectRequest(id: string): Promise<StudioProjectRecord> {
  const res = await fetch(`/api/studio/projects/${id}`, { cache: 'no-store' })
  const body = await readJson<{ project: StudioProjectRecord }>(res)
  return body.project
}

export async function saveStudioProjectRequest(
  id: string,
  scene: StudioScene,
  name?: string,
): Promise<StudioProjectRecord> {
  const res = await fetch(`/api/studio/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, scene, status: 'ready' }),
  })
  const body = await readJson<{ project: StudioProjectRecord }>(res)
  return body.project
}

export async function compileStudioProjectRequest(id: string): Promise<CompiledScene> {
  const res = await fetch(`/api/studio/projects/${id}/compile`, {
    method: 'POST',
    cache: 'no-store',
  })
  const body = await readJson<{ compiled: CompiledScene }>(res)
  return body.compiled
}

export async function createBlenderPackageRequest(id: string): Promise<{
  blenderConfigured: boolean
  packagePath: string
  packageData: BlenderRenderPackage
}> {
  const res = await fetch(`/api/studio/projects/${id}/render-package`, {
    method: 'POST',
    cache: 'no-store',
  })
  return readJson<{
    blenderConfigured: boolean
    packagePath: string
    packageData: BlenderRenderPackage
  }>(res)
}

export async function startBlenderRenderRequest(id: string): Promise<{
  packagePath?: string
  outputDir?: string
  exitCode?: number
  stdout?: string
  stderr?: string
  error?: string
}> {
  const res = await fetch(`/api/studio/projects/${id}/render`, {
    method: 'POST',
    cache: 'no-store',
  })
  const text = await res.text()
  const body = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  if (!res.ok) {
    return body as {
      packagePath?: string
      outputDir?: string
      exitCode?: number
      stdout?: string
      stderr?: string
      error?: string
    }
  }
  return body as {
    packagePath?: string
    outputDir?: string
    exitCode?: number
    stdout?: string
    stderr?: string
    error?: string
  }
}
