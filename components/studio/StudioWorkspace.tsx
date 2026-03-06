'use client'

import { startTransition, useDeferredValue, useEffect, useState } from 'react'
import Plan2DCanvas from '@/components/studio/Plan2DCanvas'
import ScenePreview3D from '@/components/studio/ScenePreview3D'
import StudioFormPanel from '@/components/studio/StudioFormPanel'
import { compileStudioScene } from '@/lib/studio/compiler'
import {
  createBlenderPackageRequest,
  createStudioProjectRequest,
  getStudioProjectRequest,
  listStudioProjectsRequest,
  saveStudioProjectRequest,
  startBlenderRenderRequest,
} from '@/lib/studio/client'
import type { StudioProjectSummary, StudioScene } from '@/lib/studio/schema'

export default function StudioWorkspace() {
  const [projects, setProjects] = useState<StudioProjectSummary[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [scene, setScene] = useState<StudioScene | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [packageMessage, setPackageMessage] = useState<string | null>(null)
  const [renderMessage, setRenderMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        const listed = await listStudioProjectsRequest()
        if (cancelled) return
        setProjects(listed)

        if (listed[0]) {
          await loadProject(listed[0].id, cancelled)
          return
        }

        const created = await createStudioProjectRequest('Projet cuisine BP')
        if (cancelled) return
        setProjects([toSummary(created)])
        setProjectId(created.id)
        setProjectName(created.name)
        setScene(created.scene)
      } catch (nextError) {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : String(nextError))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    boot()
    return () => {
      cancelled = true
    }
  }, [])

  async function loadProject(id: string, cancelled = false) {
    const project = await getStudioProjectRequest(id)
    if (cancelled) return
    setProjectId(project.id)
    setProjectName(project.name)
    setScene(project.scene)
  }

  async function handleCreateProject() {
    setLoading(true)
    setError(null)
    try {
      const created = await createStudioProjectRequest(`Projet cuisine ${projects.length + 1}`)
      setProjects((current) => [toSummary(created), ...current])
      setProjectId(created.id)
      setProjectName(created.name)
      setScene(created.scene)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveProject() {
    if (!projectId || !scene) return
    setSaving(true)
    setError(null)
    try {
      const saved = await saveStudioProjectRequest(projectId, { ...scene, name: projectName }, projectName)
      startTransition(() => {
        setScene(saved.scene)
        setProjectName(saved.name)
        setProjects((current) =>
          current
            .map((project) => (project.id === saved.id ? toSummary(saved) : project))
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
        )
      })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      setSaving(false)
    }
  }

  async function handleGeneratePackage() {
    if (!projectId) return
    setPackageMessage('Generation du package Blender...')
    try {
      const result = await createBlenderPackageRequest(projectId)
      setPackageMessage(`${result.blenderConfigured ? 'Package pret' : 'Package genere'}: ${result.packagePath}`)
    } catch (nextError) {
      setPackageMessage(nextError instanceof Error ? nextError.message : String(nextError))
    }
  }

  async function handleStartRender() {
    if (!projectId) return
    setRenderMessage('Lancement du rendu Blender...')
    try {
      const result = await startBlenderRenderRequest(projectId)
      setRenderMessage(result.error || `Rendu termine. output=${result.outputDir || '(non renseigne)'}`)
    } catch (nextError) {
      setRenderMessage(nextError instanceof Error ? nextError.message : String(nextError))
    }
  }

  const deferredScene = useDeferredValue(scene)
  const compiled = deferredScene ? compileStudioScene(deferredScene) : null

  if (loading || !scene || !compiled) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center text-sm text-[#6f6863]">
        Chargement du studio parametrique...
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[#f3f0ea]">
      <div className="max-w-[1500px] mx-auto px-6 py-8 grid grid-cols-[280px_minmax(0,1fr)] gap-6">
        <aside className="bg-white rounded-[28px] border border-[#ece4d8] p-5 shadow-[0_16px_40px_rgba(36,31,32,0.06)]">
          <div className="flex items-start justify-between gap-3 mb-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#8f857d]">Studio</p>
              <h2 className="text-[22px] font-semibold text-[#201d1e] mt-2">Projets cuisine</h2>
            </div>
            <button onClick={handleCreateProject} className="rounded-full bg-[#201d1e] text-white px-4 py-2 text-xs font-semibold">
              Nouveau
            </button>
          </div>

          <div className="space-y-3">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => loadProject(project.id)}
                className={[
                  'w-full text-left rounded-[18px] px-4 py-3 border transition-colors',
                  project.id === projectId
                    ? 'bg-[#201d1e] text-white border-[#201d1e]'
                    : 'bg-[#faf7f2] text-[#201d1e] border-[#ede3d5] hover:border-[#b6a593]',
                ].join(' ')}
              >
                <div className="text-sm font-semibold">{project.name}</div>
                <div className={project.id === projectId ? 'text-white/70 text-xs mt-1' : 'text-[#7b736d] text-xs mt-1'}>
                  rev {project.latestRevisionNumber} | {new Date(project.updatedAt).toLocaleString('fr-FR')}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="space-y-6">
          <section className="bg-white rounded-[28px] border border-[#ece4d8] p-6 shadow-[0_16px_40px_rgba(36,31,32,0.06)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-[#8f857d]">Source de verite</p>
                <h1 className="text-[30px] font-semibold text-[#201d1e] mt-2">Editeur 2D parametrique + preview 3D</h1>
                <p className="text-sm text-[#6f6863] mt-2 max-w-[780px]">
                  Le plan, les dimensions, les ouvertures et les modules constituent la scene canonique.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={handleSaveProject} disabled={saving} className="rounded-[16px] bg-[#201d1e] text-white px-5 py-3 text-sm font-semibold disabled:opacity-50">
                  {saving ? 'Sauvegarde...' : 'Sauvegarder une revision'}
                </button>
                <button onClick={handleGeneratePackage} className="rounded-[16px] bg-[#efe8dd] text-[#201d1e] px-5 py-3 text-sm font-semibold">
                  Generer package Blender
                </button>
                <button onClick={handleStartRender} className="rounded-[16px] bg-[#c24f2c] text-white px-5 py-3 text-sm font-semibold">
                  Lancer rendu Blender
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-[#8f857d] mb-2">Nom du projet</label>
                <input
                  value={projectName}
                  onChange={(event) => {
                    setProjectName(event.target.value)
                    setScene({ ...scene, name: event.target.value })
                  }}
                  className="w-full rounded-[16px] border border-[#e4d8c8] bg-[#fcfbf9] px-4 py-3 text-sm text-[#201d1e]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatusCard label="Warnings" value={String(compiled.warnings.length)} />
                <StatusCard label="Modules" value={String(scene.modules.length)} />
              </div>
            </div>

            {(error || packageMessage || renderMessage) && (
              <div className="mt-4 space-y-2">
                {error && <Banner tone="error">{error}</Banner>}
                {packageMessage && <Banner tone="info">{packageMessage}</Banner>}
                {renderMessage && <Banner tone="info">{renderMessage}</Banner>}
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="Plan 2D parametrique" subtitle="Trace, dimensions, ouvertures et implantation">
              <div className="h-[420px]">
                <Plan2DCanvas scene={scene} />
              </div>
            </Card>

            <Card title="Preview 3D three.js" subtitle="Geometrie derivee de la scene canonique">
              <div className="h-[420px] bg-[#fbfaf8] rounded-[24px] overflow-hidden">
                <ScenePreview3D compiled={compiled} />
              </div>
            </Card>
          </section>

          <StudioFormPanel scene={scene} setScene={setScene} />

          {compiled.warnings.length > 0 && (
            <section className="bg-white rounded-[28px] border border-[#ece4d8] p-6 shadow-[0_16px_40px_rgba(36,31,32,0.06)]">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#8f857d]">Validation</p>
              <h2 className="text-[22px] font-semibold text-[#201d1e] mt-2">Warnings de composition</h2>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {compiled.warnings.map((warning) => (
                  <div key={warning} className="rounded-[18px] border border-[#ecd7cc] bg-[#fff6f2] px-4 py-3 text-sm text-[#8e4f3f]">
                    {warning}
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

function toSummary(project: {
  id: string
  name: string
  status: 'draft' | 'ready' | 'rendering'
  latestRevisionNumber: number
  createdAt: string
  updatedAt: string
}) {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    latestRevisionNumber: project.latestRevisionNumber,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[28px] border border-[#ece4d8] p-6 shadow-[0_16px_40px_rgba(36,31,32,0.06)]">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#8f857d]">{subtitle}</p>
      <h2 className="text-[22px] font-semibold text-[#201d1e] mt-2 mb-5">{title}</h2>
      {children}
    </div>
  )
}

function Banner({ tone, children }: { tone: 'error' | 'info'; children: React.ReactNode }) {
  const toneClass = tone === 'error'
    ? 'border-[#efc6bc] bg-[#fff1ec] text-[#8e4f3f]'
    : 'border-[#d7d8e9] bg-[#f6f6ff] text-[#3d466d]'

  return <div className={`rounded-[18px] border px-4 py-3 text-sm ${toneClass}`}>{children}</div>
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[#ede3d5] bg-[#faf7f2] px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-[#8f857d]">{label}</div>
      <div className="text-[28px] font-semibold text-[#201d1e] mt-2">{value}</div>
    </div>
  )
}
