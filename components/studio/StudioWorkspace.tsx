'use client'

import { startTransition, useDeferredValue, useEffect, useState } from 'react'
import Link from 'next/link'
import Plan2DCanvas from '@/components/studio/Plan2DCanvas'
import ScenePreview3D from '@/components/studio/ScenePreview3D'
import SiteSurveyPanel from '@/components/studio/SiteSurveyPanel'
import StudioFormPanel from '@/components/studio/StudioFormPanel'
import { compileStudioScene } from '@/lib/studio/compiler'
import {
  getAutoCameraPresetLabel,
  getCameraAngleLabel,
  getImplantationLabel,
  getPreviewDeliveryLabel,
  getPreviewShellLabel,
  getRenderAmbienceLabel,
  getRenderQualityLabel,
  getVisualDossierSummary,
  getVisualReferencesSummary,
} from '@/lib/studio/project-summary'
import { PREVIEW_SHELL_MODES, validateSiteSurvey } from '@/lib/studio/schema'
import {
  createBlenderPackageRequest,
  createStudioProjectRequest,
  deleteStudioProjectRequest,
  getStudioProjectRequest,
  listStudioProjectsRequest,
  saveStudioProjectRequest,
  startBlenderRenderRequest,
} from '@/lib/studio/client'
import type {
  ModulePlacement,
  OpeningSpec,
  StudioProjectSummary,
  StudioScene,
  SurveyCompletenessStatus,
} from '@/lib/studio/schema'

export default function StudioWorkspace() {
  const [projects, setProjects] = useState<StudioProjectSummary[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [scene, setScene] = useState<StudioScene | null>(null)
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [previewFullscreen, setPreviewFullscreen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
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

        const created = await createStudioProjectRequest('Nouveau projet')
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

  useEffect(() => {
    if (!scene || !selectedModuleId) return
    if (!scene.modules.some((moduleSpec) => moduleSpec.id === selectedModuleId)) {
      setSelectedModuleId(null)
    }
  }, [scene, selectedModuleId])

  useEffect(() => {
    if (!previewFullscreen) return

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewFullscreen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [previewFullscreen])

  async function loadProject(id: string, cancelled = false) {
    const project = await getStudioProjectRequest(id)
    if (cancelled) return
    setProjectId(project.id)
    setProjectName(project.name)
    setScene(project.scene)
    setSelectedModuleId(null)
  }

  async function handleCreateProject() {
    setLoading(true)
    setError(null)
    try {
      const created = await createStudioProjectRequest(`Nouveau projet ${projects.length + 1}`)
      setProjects((current) => [toSummary(created), ...current])
      setProjectId(created.id)
      setProjectName(created.name)
      setScene(created.scene)
      setSelectedModuleId(null)
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
      await persistCurrentScene('manual')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      setSaving(false)
    }
  }

  async function persistCurrentScene(source: 'manual' | 'autosave') {
    if (!projectId || !scene) {
      throw new Error('Projet studio introuvable')
    }

    const saved = await saveStudioProjectRequest(
      projectId,
      { ...scene, name: projectName },
      projectName,
      source,
    )

    startTransition(() => {
      setScene(saved.scene)
      setProjectName(saved.name)
      setProjects((current) =>
        current
          .map((project) => (project.id === saved.id ? toSummary(saved) : project))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
      )
    })

    return saved
  }

  async function handleDeleteProject(id: string) {
    const target = projects.find((project) => project.id === id)
    if (!target) return
    if (target.status === 'rendering') {
      setError('Impossible de supprimer un projet pendant un rendu en cours.')
      return
    }

    const confirmed = window.confirm(
      `Supprimer definitivement le projet "${target.name}" et toutes ses revisions ?`,
    )
    if (!confirmed) return

    setDeletingProjectId(id)
    setError(null)

    try {
      await deleteStudioProjectRequest(id)
      const remainingProjects = projects.filter((project) => project.id !== id)
      setProjects(remainingProjects)

      if (projectId !== id) return

      setLoading(true)

      if (remainingProjects[0]) {
        await loadProject(remainingProjects[0].id)
        return
      }

      const created = await createStudioProjectRequest('Nouveau projet')
      setProjects([toSummary(created)])
      setProjectId(created.id)
      setProjectName(created.name)
      setScene(created.scene)
      setSelectedModuleId(null)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      setDeletingProjectId(null)
      setLoading(false)
    }
  }

  async function handleGeneratePackage() {
    if (!projectId) return
    setPackageMessage('Generation du package Blender...')
    try {
      await persistCurrentScene('autosave')
      const result = await createBlenderPackageRequest(projectId)
      setPackageMessage(`${result.blenderConfigured ? 'Package pret' : 'Package genere'}: ${result.packagePath}`)
    } catch (nextError) {
      setPackageMessage(nextError instanceof Error ? nextError.message : String(nextError))
    }
  }

  async function handleStartRender() {
    if (!projectId || !scene) return
    const isExpressRender = scene.renderQualityPreset === 'express'
    setRenderMessage(`Lancement du rendu ${isExpressRender ? 'express' : 'Blender'}...`)
    try {
      await persistCurrentScene('autosave')
      const result = await startBlenderRenderRequest(projectId)
      setRenderMessage(result.error || `Rendu termine. output=${result.outputDir || '(non renseigne)'}`)
    } catch (nextError) {
      setRenderMessage(nextError instanceof Error ? nextError.message : String(nextError))
    }
  }

  function handlePlanModulePlacementChange(moduleId: string, placement: ModulePlacement) {
    setScene((current) =>
      current
        ? {
            ...current,
            modules: current.modules.map((moduleSpec) =>
              moduleSpec.id === moduleId ? { ...moduleSpec, placement } : moduleSpec,
            ),
          }
        : current,
    )
  }

  function handlePlanModuleDuplicate(moduleSpec: StudioScene['modules'][number]) {
    setScene((current) =>
      current
        ? {
            ...current,
            modules: [...current.modules, moduleSpec],
          }
        : current,
    )
    setSelectedModuleId(moduleSpec.id)
  }

  function handlePlanModuleRemove(moduleId: string) {
    setScene((current) =>
      current
        ? {
            ...current,
            modules: current.modules.filter((moduleSpec) => moduleSpec.id !== moduleId),
          }
        : current,
    )
    setSelectedModuleId((current) => (current === moduleId ? null : current))
  }

  function handlePlanOpeningChange(
    openingId: string,
    patch: Pick<OpeningSpec, 'wall' | 'offset'>,
  ) {
    setScene((current) => {
      if (!current) return current

      const openings = current.openings.map((opening) =>
        opening.id === openingId ? { ...opening, ...patch } : opening,
      )
      const nextSurvey = {
        ...current.siteSurvey,
        openings: openings.map((opening) => ({
          id: opening.id,
          name: opening.name,
          wall: opening.wall,
          kind: opening.kind,
          offset: opening.offset,
          width: opening.width,
          height: opening.height,
          baseHeight: opening.baseHeight,
        })),
      }
      const validation = validateSiteSurvey(nextSurvey)

      return {
        ...current,
        openings,
        siteSurvey: { ...nextSurvey, completeness: validation.completeness },
      }
    })
  }

  const deferredScene = useDeferredValue(scene)
  const compiled = deferredScene ? compileStudioScene(deferredScene) : null
  const surveyValidation = scene ? validateSiteSurvey(scene.siteSurvey) : null

  if (loading || !scene || !compiled) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center text-sm text-[#6f6863]">
        Chargement du studio parametrique...
      </div>
    )
  }

  const previewReady = surveyValidation?.workflow.previewReady ?? false
  const renderReady = surveyValidation?.workflow.renderReady ?? false
  const canStartRender = renderReady || (previewReady && scene.renderQualityPreset === 'express')
  const readingSummary = {
    previewShell: getPreviewShellLabel(scene.previewShellMode),
    cameraPreset: getAutoCameraPresetLabel(scene.autoCameraPreset),
    camera: getCameraAngleLabel(scene),
    implantation: getImplantationLabel(scene),
    ambience: getRenderAmbienceLabel(scene.renderAmbiencePreset),
    quality: getRenderQualityLabel(scene.renderQualityPreset),
    workflow: getPreviewDeliveryLabel({
      previewReady,
      renderReady,
      renderQualityPreset: scene.renderQualityPreset,
    }),
    visualReferences: getVisualReferencesSummary(scene),
    visualDossier: getVisualDossierSummary(scene),
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
              <div
                key={project.id}
                className={[
                  'relative rounded-[18px] border transition-colors',
                  project.id === projectId
                    ? 'bg-[#201d1e] text-white border-[#201d1e]'
                    : 'bg-[#faf7f2] text-[#201d1e] border-[#ede3d5] hover:border-[#b6a593]',
                ].join(' ')}
              >
                <button
                  onClick={() => loadProject(project.id)}
                  className="w-full text-left rounded-[18px] px-4 py-3 pr-20"
                >
                  <div className="text-sm font-semibold">{project.name}</div>
                  <div className="flex items-center justify-between mt-1.5 gap-2">
                    <span className="text-xs opacity-70">
                      rev {project.latestRevisionNumber} | {new Date(project.updatedAt).toLocaleString('fr-FR')}
                    </span>
                    <ProjectStatusBadge
                      status={project.status}
                      surveyStage={project.surveyStage}
                      active={project.id === projectId}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <VisualDossierBadge
                      status={project.visualDossierStatus}
                      active={project.id === projectId}
                    />
                    <span className="text-[11px] opacity-65">visuel {project.visualDossierScore}%</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteProject(project.id)}
                  disabled={deletingProjectId === project.id || project.status === 'rendering'}
                  title={
                    project.status === 'rendering'
                      ? 'Suppression desactivee pendant le rendu'
                      : 'Supprimer ce projet'
                  }
                  className={[
                    'absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
                    project.id === projectId
                      ? 'bg-white/15 text-white disabled:bg-white/10'
                      : 'bg-[#f3e6db] text-[#9b5143] disabled:bg-[#f4eee8] disabled:text-[#b7aba2]',
                  ].join(' ')}
                >
                  {deletingProjectId === project.id ? '...' : 'Suppr'}
                </button>
              </div>
            ))}
          </div>
        </aside>

        <main className="space-y-6">
          <section className="bg-white rounded-[28px] border border-[#ece4d8] p-6 shadow-[0_16px_40px_rgba(36,31,32,0.06)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-[#8f857d]">Studio BP Cuisines</p>
                <h1 className="text-[30px] font-semibold text-[#201d1e] mt-2">{projectName}</h1>
                <p className="text-sm text-[#6f6863] mt-2 max-w-[780px]">
                  Commencez par le releve chantier, puis posez les ouvertures et les modules.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={projectId ? `/releve-imprimable?projectId=${projectId}` : '/releve-imprimable'}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-[16px] border border-[#d8ccbc] bg-white px-5 py-3 text-sm font-semibold text-[#201d1e]"
                >
                  Fiche terrain A4
                </Link>
                <button onClick={handleSaveProject} disabled={saving} className="rounded-[16px] bg-[#201d1e] text-white px-5 py-3 text-sm font-semibold disabled:opacity-50">
                  {saving ? 'Sauvegarde...' : 'Sauvegarder une revision'}
                </button>
                <button
                  onClick={handleGeneratePackage}
                  disabled={!previewReady}
                  title={previewReady ? undefined : 'Le releve doit etre au moins suffisant avant de generer un package Blender'}
                  className="rounded-[16px] bg-[#efe8dd] text-[#201d1e] px-5 py-3 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Generer package Blender
                </button>
                <button
                  onClick={handleStartRender}
                  disabled={!canStartRender}
                  title={
                    canStartRender
                      ? undefined
                      : scene.renderQualityPreset === 'express'
                        ? 'Le releve doit etre au moins suffisant avant de lancer un rendu express'
                        : 'Le releve doit etre au statut pret avant de lancer le rendu'
                  }
                  className="rounded-[16px] bg-[#c24f2c] text-white px-5 py-3 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {scene.renderQualityPreset === 'express' ? 'Lancer rendu express' : 'Lancer rendu Blender'}
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,1fr)] gap-4">
              <div className="space-y-4">
                <div className="rounded-[24px] border border-[#ece4d8] bg-[#fcfbf9] p-4">
                  <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-[#8f857d] mb-2">
                    Nom du projet
                  </label>
                  <input
                    value={projectName}
                    onChange={(event) => {
                      setProjectName(event.target.value)
                      setScene({ ...scene, name: event.target.value })
                    }}
                    className="w-full rounded-[16px] border border-[#e4d8c8] bg-white px-4 py-3 text-sm text-[#201d1e]"
                  />
                  <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-[#6f6863] md:grid-cols-2">
                    <div>Le haut de page sert au pilotage rapide: statut, lecture preview et rendu.</div>
                    <div>Le plan 2D en dessous permet maintenant de repositionner les meubles en glisser-deposer.</div>
                  </div>
                </div>

                {surveyValidation && (
                  <Banner tone={renderReady ? 'success' : previewReady ? 'info' : 'warning'}>
                    <div>{surveyValidation.workflow.nextAction}</div>
                    {!renderReady && previewReady && scene.renderQualityPreset === 'express' ? (
                      <div className="mt-2 text-sm opacity-80">
                        Le rendu express est disponible. Le rendu interne plus strict reste verrouille tant que le releve n est pas pret.
                      </div>
                    ) : null}
                  </Banner>
                )}

                {(error || packageMessage || renderMessage) && (
                  <div className="space-y-2">
                    {error && <Banner tone="error">{error}</Banner>}
                    {packageMessage && <Banner tone="info">{packageMessage}</Banner>}
                    {renderMessage && <Banner tone="info">{renderMessage}</Banner>}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <SurveyStatusCard
                  status={surveyValidation?.workflow.stage || scene.siteSurvey.completeness.status}
                  score={surveyValidation?.completeness.score || scene.siteSurvey.completeness.score}
                  previewReady={previewReady}
                  expressReady={previewReady}
                  renderReady={renderReady}
                />
                <StatusCard label="Warnings scène" value={String(compiled.warnings.length)} />
                <DetailCard label="Preview / rendu" value={readingSummary.workflow} />
                <DetailCard
                  label="Dossier visuel"
                  value={`${readingSummary.visualDossier.label} · ${readingSummary.visualDossier.score}%`}
                  hint={
                    readingSummary.visualDossier.missing.length > 0
                      ? readingSummary.visualDossier.missing.slice(0, 2).join(' · ')
                      : readingSummary.visualDossier.hint
                  }
                  tone={
                    readingSummary.visualDossier.status === 'complet'
                      ? 'success'
                      : readingSummary.visualDossier.status === 'suffisant'
                        ? 'info'
                        : 'warning'
                  }
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <DetailCard label="Lecture preview" value={readingSummary.previewShell} />
              <DetailCard label="Camera auto" value={readingSummary.cameraPreset} />
              <DetailCard label="Angle camera" value={readingSummary.camera} />
              <DetailCard label="Implantation" value={readingSummary.implantation} />
              <DetailCard label="Ambiance" value={readingSummary.ambience} />
              <DetailCard label="Qualite rendu" value={readingSummary.quality} />
              <div className="xl:col-span-2">
                <DetailCard
                  label="References visuelles"
                  value={readingSummary.visualReferences.value}
                  hint={readingSummary.visualReferences.hint}
                />
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="Plan 2D parametrique" subtitle="Trace, dimensions, ouvertures, implantation et drag and drop">
              <div className="h-[420px]">
                <Plan2DCanvas
                  scene={scene}
                  selectedModuleId={selectedModuleId}
                  onSelectModule={setSelectedModuleId}
                  onModulePlacementChange={handlePlanModulePlacementChange}
                  onModuleDuplicate={handlePlanModuleDuplicate}
                  onModuleRemove={handlePlanModuleRemove}
                  onOpeningChange={handlePlanOpeningChange}
                />
              </div>
            </Card>

            <Card title="Preview 3D three.js" subtitle="Geometrie derivee de la scene canonique">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#8f857d]">
                    Lecture piece
                  </p>
                  <p className="text-sm text-[#6f6863] mt-1">
                    Auto garde une lecture adaptee a la cuisine. Tu peux forcer 2 ou 3 murs si besoin.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PREVIEW_SHELL_MODES.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() =>
                        setScene((current) =>
                          current ? { ...current, previewShellMode: mode } : current,
                        )
                      }
                      className={[
                        'rounded-full px-3 py-2 text-xs font-semibold transition-colors',
                        scene.previewShellMode === mode
                          ? 'bg-[#201d1e] text-white'
                          : 'bg-[#f1ebe2] text-[#5f5750] hover:bg-[#e6ddcf]',
                      ].join(' ')}
                    >
                      {mode === 'auto' ? 'Auto' : mode === '2-walls' ? '2 murs' : '3 murs'}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPreviewFullscreen(true)}
                    className="rounded-full bg-[#201d1e] px-3 py-2 text-xs font-semibold text-white"
                  >
                    Grand ecran
                  </button>
                </div>
              </div>
              <div className="h-[420px] bg-[#fbfaf8] rounded-[24px] overflow-hidden">
                <ScenePreview3D compiled={compiled} scene={scene} />
              </div>
            </Card>
          </section>

          {previewFullscreen ? (
            <div className="fixed inset-0 z-50 bg-[#201d1e]/88 p-4 md:p-8">
              <div className="mx-auto flex h-full w-full max-w-[1800px] flex-col rounded-[28px] border border-white/10 bg-[#f7f4ef] shadow-[0_28px_80px_rgba(0,0,0,0.35)]">
                <div className="flex items-center justify-between gap-4 border-b border-[#e7ddd1] px-6 py-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#8f857d]">Preview 3D</p>
                    <h2 className="mt-1 text-xl font-semibold text-[#201d1e]">{projectName}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewFullscreen(false)}
                    className="rounded-full bg-[#201d1e] px-4 py-2 text-sm font-semibold text-white"
                  >
                    Fermer
                  </button>
                </div>
                <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="min-h-0 overflow-hidden rounded-[24px] bg-[#fbfaf8]">
                    <ScenePreview3D compiled={compiled} scene={scene} />
                  </div>
                  <div className="flex flex-col gap-3 rounded-[24px] border border-[#e7ddd1] bg-white p-4">
                    <DetailCard label="Lecture preview" value={readingSummary.previewShell} />
                    <DetailCard label="Camera auto" value={readingSummary.cameraPreset} />
                    <DetailCard label="Angle camera" value={readingSummary.camera} />
                    <DetailCard label="Implantation" value={readingSummary.implantation} />
                    <DetailCard label="Ambiance" value={readingSummary.ambience} />
                    <DetailCard label="Qualite rendu" value={readingSummary.quality} />
                    <DetailCard label="Preview / rendu" value={readingSummary.workflow} />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <StudioFormPanel
            scene={scene}
            setScene={setScene}
            selectedModuleId={selectedModuleId}
            onSelectModule={setSelectedModuleId}
          />
          <SiteSurveyPanel scene={scene} setScene={setScene} projectId={projectId ?? ''} />

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
  surveyStage: SurveyCompletenessStatus
  visualDossierStatus: 'insuffisant' | 'suffisant' | 'complet'
  visualDossierScore: number
  latestRevisionNumber: number
  createdAt: string
  updatedAt: string
}) {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    surveyStage: project.surveyStage,
    visualDossierStatus: project.visualDossierStatus,
    visualDossierScore: project.visualDossierScore,
    latestRevisionNumber: project.latestRevisionNumber,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
}

function ProjectStatusBadge({
  status,
  surveyStage,
  active,
}: {
  status: 'ready' | 'draft' | 'rendering'
  surveyStage: SurveyCompletenessStatus
  active: boolean
}) {
  const isRenderReady = surveyStage === 'pret'

  if (active) {
    if (status === 'ready' && isRenderReady) return <span className="text-[10px] font-semibold bg-[#d4edd4] text-[#276127] rounded-full px-2 py-0.5">Prêt rendu</span>
    if (status === 'ready') return <span className="text-[10px] font-semibold bg-[#dbeafe] text-[#1e40af] rounded-full px-2 py-0.5">Prévisualisable</span>
    if (status === 'rendering') return <span className="text-[10px] font-semibold bg-[#dbeafe] text-[#1e40af] rounded-full px-2 py-0.5">Rendu…</span>
    return <span className="text-[10px] font-semibold bg-[#fef3c7] text-[#92400e] rounded-full px-2 py-0.5">Brouillon</span>
  }
  if (status === 'ready' && isRenderReady) return <span className="text-[10px] font-semibold bg-[#d4edd4] text-[#276127] rounded-full px-2 py-0.5">Prêt rendu</span>
  if (status === 'ready') return <span className="text-[10px] font-semibold bg-[#dbeafe] text-[#1e40af] rounded-full px-2 py-0.5">Prévisualisable</span>
  if (status === 'rendering') return <span className="text-[10px] font-semibold bg-[#dbeafe] text-[#1e40af] rounded-full px-2 py-0.5">Rendu…</span>
  return <span className="text-[10px] font-semibold bg-[#fef3c7] text-[#92400e] rounded-full px-2 py-0.5">Brouillon</span>
}

function VisualDossierBadge({
  status,
  active,
}: {
  status: 'insuffisant' | 'suffisant' | 'complet'
  active: boolean
}) {
  const className =
    status === 'complet'
      ? active
        ? 'bg-[#d4edd4] text-[#276127]'
        : 'bg-[#e8f6e8] text-[#276127]'
      : status === 'suffisant'
        ? active
          ? 'bg-[#dbeafe] text-[#1e40af]'
          : 'bg-[#ebf4ff] text-[#1e40af]'
        : active
          ? 'bg-[#fef3c7] text-[#92400e]'
          : 'bg-[#fff7dc] text-[#92400e]'

  const label =
    status === 'complet'
      ? 'Visuel complet'
      : status === 'suffisant'
        ? 'Visuel suffisant'
        : 'Visuel incomplet'

  return <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${className}`}>{label}</span>
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

function Banner({ tone, children }: { tone: 'error' | 'info' | 'warning' | 'success'; children: React.ReactNode }) {
  const toneClass = tone === 'error'
    ? 'border-[#efc6bc] bg-[#fff1ec] text-[#8e4f3f]'
    : tone === 'warning'
      ? 'border-[#e9dfb8] bg-[#fff8df] text-[#8a6b10]'
      : tone === 'success'
        ? 'border-[#cde4cf] bg-[#eff9f0] text-[#276127]'
        : 'border-[#d7d8e9] bg-[#f6f6ff] text-[#3d466d]'

  return <div className={`rounded-[18px] border px-4 py-3 text-sm ${toneClass}`}>{children}</div>
}

function StatusCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[20px] border border-[#ede3d5] bg-[#faf7f2] px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-[#8f857d]">{label}</div>
      <div className="text-[28px] font-semibold text-[#201d1e] mt-2">{value}</div>
      {hint ? <div className="text-xs text-[#8f857d] mt-1">{hint}</div> : null}
    </div>
  )
}

function DetailCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'neutral' | 'warning' | 'info' | 'success'
}) {
  const toneClass =
    tone === 'warning'
      ? 'border-[#f2dfb2] bg-[#fffaf0]'
      : tone === 'info'
        ? 'border-[#d9e5ff] bg-[#f7fbff]'
        : tone === 'success'
          ? 'border-[#cfe7d1] bg-[#f3fbf3]'
          : 'border-[#ede3d5] bg-[#faf7f2]'

  return (
    <div className={`rounded-[20px] border px-4 py-3 ${toneClass}`}>
      <div className="text-[11px] uppercase tracking-[0.16em] text-[#8f857d]">{label}</div>
      <div className="text-sm font-semibold text-[#201d1e] mt-2 leading-snug">{value}</div>
      {hint ? <div className="text-xs text-[#8f857d] mt-1 leading-snug">{hint}</div> : null}
    </div>
  )
}

function SurveyStatusCard({
  status,
  score,
  previewReady,
  expressReady,
  renderReady,
}: {
  status: 'pret' | 'suffisant' | 'a_verifier' | 'bloquant'
  score: number
  previewReady: boolean
  expressReady: boolean
  renderReady: boolean
}) {
  const meta = {
    pret: { label: 'Relevé · Prêt', text: '#276127', bar: '#4ade80' },
    suffisant: { label: 'Relevé · Suffisant', text: '#1d4ed8', bar: '#60a5fa' },
    a_verifier: { label: 'Relevé · À vérifier', text: '#92400e', bar: '#fbbf24' },
    bloquant: { label: 'Relevé · Bloquant', text: '#991b1b', bar: '#f87171' },
  }[status]

  return (
    <div className="rounded-[20px] border border-[#ede3d5] bg-[#faf7f2] px-4 py-3">
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: meta.text }}
      >
        {meta.label}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="text-[28px] font-semibold text-[#201d1e] leading-none">{score} %</div>
        <div className="flex flex-col items-end gap-1">
          <StatusPill label="Preview" ready={previewReady} />
          <StatusPill label="Express" ready={expressReady} />
          <StatusPill label="Rendu" ready={renderReady} />
        </div>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-[#ede8e0] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${score}%`, backgroundColor: meta.bar }}
        />
      </div>
    </div>
  )
}

function StatusPill({ label, ready }: { label: string; ready: boolean }) {
  return (
    <span
      className={[
        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
        ready ? 'bg-[#dff3e1] text-[#276127]' : 'bg-[#f3e7d6] text-[#8c6a2c]',
      ].join(' ')}
    >
      {label} {ready ? 'ok' : 'attente'}
    </span>
  )
}
