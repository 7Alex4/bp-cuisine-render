'use client'

import {
  ROOM_PHOTO_CATEGORIES,
  SURVEY_EQUIPMENT_TYPES,
  SURVEY_HOOD_MODES,
  SURVEY_USEFUL_HEIGHT_TARGETS,
  summarizeRoomPhotoReferences,
  validateSiteSurvey,
  WALL_IDS,
} from '@/lib/studio/schema'
import { getVisualDossierSummary } from '@/lib/studio/project-summary'
import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type {
  OpeningKind,
  RoomPhotoCategory,
  RoomPhotoReference,
  SceneReferences,
  SiteSurvey,
  SiteSurveyDesiredEquipmentSpec,
  SiteSurveyOpeningSpec,
  SiteSurveyValidationResult,
  StudioScene,
  SurveyEquipmentType,
  SurveyHoodMode,
  SurveyUsefulHeightTarget,
  WallId,
} from '@/lib/studio/schema'

const EQUIPMENT_LABELS: Record<SurveyEquipmentType, string> = {
  sink: 'Evier',
  hob: 'Plaque de cuisson',
  oven: 'Four',
  fridge: 'Refrigerateur',
  dishwasher: 'Lave-vaisselle',
  hood: 'Hotte',
}

const WALL_LABELS: Record<WallId, string> = {
  north: 'Nord',
  east: 'Est',
  south: 'Sud',
  west: 'Ouest',
}

const HEIGHT_TARGET_LABELS: Record<SurveyUsefulHeightTarget, string> = {
  'full-room': 'Piece complete',
  north: 'Mur nord',
  east: 'Mur est',
  south: 'Mur sud',
  west: 'Mur ouest',
}

const HOOD_OPTIONS: { id: SurveyHoodMode; label: string }[] = SURVEY_HOOD_MODES.slice()
  .sort((left, right) => {
    const order: Record<SurveyHoodMode, number> = { evacuation: 0, recycling: 1, unknown: 2 }
    return order[left] - order[right]
  })
  .map((hoodMode) => ({
    id: hoodMode,
    label:
      hoodMode === 'evacuation'
        ? 'Evacuation exterieure'
        : hoodMode === 'recycling'
          ? 'Recyclage'
          : 'Non renseigne',
  }))

const ROOM_PHOTO_CATEGORY_LABELS: Record<RoomPhotoCategory, string> = {
  piece: 'Piece',
  mur: 'Mur (general)',
  'mur-nord': 'Mur nord',
  'mur-est': 'Mur est',
  'mur-sud': 'Mur sud',
  'mur-ouest': 'Mur ouest',
  sol: 'Sol',
  plafond: 'Plafond',
  'detail-technique': 'Detail technique',
  'detail-finition': 'Detail finition',
  autre: 'Autre',
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])

function getUploadUrl(projectId: string, fileName: string): string {
  return `/api/studio/projects/${projectId}/uploads/${encodeURIComponent(fileName)}`
}

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

function isImageAsset(fileName: string): boolean {
  return IMAGE_EXTENSIONS.has(getFileExtension(fileName))
}

function formatWallCoverage(walls: WallId[]): string {
  if (walls.length === 0) return 'Aucun mur categorie'
  return walls.map((wall) => WALL_LABELS[wall]).join(', ')
}

const STATUS_META: Record<
  SiteSurvey['completeness']['status'],
  { label: string; className: string; hint: string }
> = {
  pret: {
    label: 'Pret',
    className: 'bg-[#d4edd4] text-[#276127]',
    hint: 'Le releve contient assez d informations pour verrouiller un rendu interne.',
  },
  suffisant: {
    label: 'Suffisant pour preview',
    className: 'bg-[#dbeafe] text-[#1d4ed8]',
    hint: 'Le projet peut deja etre previsualise, mais il manque encore des elements avant rendu.',
  },
  a_verifier: {
    label: 'A verifier',
    className: 'bg-[#fef3c7] text-[#92400e]',
    hint: 'Le socle existe, mais Yves doit encore verifier des points critiques avant un preview fiable.',
  },
  bloquant: {
    label: 'Bloquant',
    className: 'bg-[#ffe4e1] text-[#991b1b]',
    hint: 'Le releve n est pas encore assez fiable pour avancer sans risque.',
  },
}

const PROCESS_STEPS = [
  {
    id: '1',
    title: 'Mesurer la piece',
    body: 'Largeur, profondeur, hauteur et sous-hauteurs utiles. Ces valeurs pilotent la boite 3D Blender.',
  },
  {
    id: '2',
    title: 'Relever les ouvertures',
    body: 'Portes et fenetres avec mur, offset, largeur, hauteur et allege pour caler la scene canonique.',
  },
  {
    id: '3',
    title: 'Valider les contraintes',
    body: 'Eau, evacuation, hotte, electricite, gaz et besoins client. Cela guide l implantation.',
  },
  {
    id: '4',
    title: 'Documenter le visuel',
    body: 'Finitions generiques, croquis et photos. Ces donnees serviront a la lecture client et au rendu.',
  },
]

export default function SiteSurveyPanel({
  scene,
  setScene,
  projectId,
}: {
  scene: StudioScene
  setScene: Dispatch<SetStateAction<StudioScene | null>>
  projectId: string
}) {
  const [uploadingSketch, setUploadingSketch] = useState(false)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [deletingUploadName, setDeletingUploadName] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  function updateSurvey(patch: Partial<SiteSurvey>) {
    setScene((current) => {
      if (!current) return current
      const nextSurvey: SiteSurvey = { ...current.siteSurvey, ...patch }
      const validation = validateSiteSurvey(nextSurvey)

      return {
        ...current,
        room: {
          ...current.room,
          width: nextSurvey.dimensions.width,
          depth: nextSurvey.dimensions.depth,
          height: nextSurvey.dimensions.height,
        },
        openings: nextSurvey.openings.map((opening) => ({
          id: opening.id,
          name: opening.name,
          wall: opening.wall,
          kind: opening.kind,
          offset: opening.offset,
          width: opening.width,
          height: opening.height,
          baseHeight: opening.baseHeight,
        })),
        siteSurvey: { ...nextSurvey, completeness: validation.completeness },
      }
    })
  }

  function updateSurveyDimension<K extends keyof SiteSurvey['dimensions']>(key: K, value: number) {
    updateSurvey({
      dimensions: {
        ...scene.siteSurvey.dimensions,
        [key]: value,
      },
    })
  }

  function updateDesiredEquipment(
    type: SurveyEquipmentType,
    patch: Partial<SiteSurveyDesiredEquipmentSpec>,
  ) {
    const next = scene.siteSurvey.desiredEquipment.map((equipment) =>
      equipment.type === type ? { ...equipment, ...patch } : equipment,
    )
    const exists = next.some((equipment) => equipment.type === type)
    updateSurvey({
      desiredEquipment: exists ? next : [...next, { type, required: false, quantity: 0, ...patch }],
    })
  }

  function updateTechnicalConstraint<
    K extends keyof SiteSurvey['technicalConstraints'],
  >(key: K, value: SiteSurvey['technicalConstraints'][K]) {
    updateSurvey({
      technicalConstraints: {
        ...scene.siteSurvey.technicalConstraints,
        [key]: value,
      },
    })
  }

  function updateFinishPreference<
    K extends keyof SiteSurvey['finishPreferences'],
  >(key: K, value: SiteSurvey['finishPreferences'][K]) {
    updateSurvey({
      finishPreferences: {
        ...scene.siteSurvey.finishPreferences,
        [key]: value,
      },
    })
  }

  function updateVisualReferencesPatch(
    patch: Partial<SiteSurvey['visualReferences']>,
  ) {
    updateSurvey({
      visualReferences: {
        ...scene.siteSurvey.visualReferences,
        ...patch,
      },
    })
  }

  function updateVisualReference<
    K extends keyof SiteSurvey['visualReferences'],
  >(key: K, value: SiteSurvey['visualReferences'][K]) {
    updateVisualReferencesPatch({ [key]: value })
  }

  function updateReferences(patch: Partial<SceneReferences>) {
    setScene((current) => {
      if (!current) return current
      return { ...current, references: { ...current.references, ...patch } }
    })
  }

  function updateRoomPhotoAssets(nextAssets: RoomPhotoReference[]) {
    const fileNames = nextAssets.map((asset) => asset.fileName)
    const autoCoverage = summarizeRoomPhotoReferences({
      roomPhotoAssets: nextAssets,
      roomPhotoNames: fileNames,
      roomPhotoName: fileNames[0] ?? null,
    })
    updateReferences({
      roomPhotoAssets: nextAssets,
      roomPhotoNames: fileNames,
      roomPhotoName: fileNames[0] ?? null,
    })
    updateVisualReferencesPatch({
      roomPhotosProvided: fileNames.length > 0,
      roomPhotoCount: fileNames.length,
      floorPhotoProvided:
        scene.siteSurvey.visualReferences.floorPhotoProvided || autoCoverage.hasFloor,
      ceilingPhotoProvided:
        scene.siteSurvey.visualReferences.ceilingPhotoProvided || autoCoverage.hasCeiling,
      fullWallSetProvided:
        scene.siteSurvey.visualReferences.fullWallSetProvided ||
        autoCoverage.wallCoverage.length === 4,
    })
  }

  async function deleteUploadedFile(fileName: string) {
    const res = await fetch(getUploadUrl(projectId, fileName), {
      method: 'DELETE',
    })

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error ?? `Erreur suppression (HTTP ${res.status})`)
    }
  }

  async function uploadSketch(file: File) {
    if (!projectId) {
      setUploadError('Projet introuvable. Sauvegarde ou recharge le studio avant upload.')
      return
    }
    setUploadingSketch(true)
    setUploadError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/studio/projects/${projectId}/upload`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setUploadError(body.error ?? `Erreur upload (HTTP ${res.status})`)
        return
      }
      const { fileName } = (await res.json()) as { fileName: string; url: string }
      updateReferences({ sketchName: fileName })
      updateVisualReferencesPatch({ sketchProvided: true })
    } catch {
      setUploadError('Erreur reseau lors du telechargement du croquis.')
    } finally {
      setUploadingSketch(false)
    }
  }

  async function uploadPhotos(files: FileList) {
    if (files.length === 0) return
    if (!projectId) {
      setUploadError('Projet introuvable. Sauvegarde ou recharge le studio avant upload.')
      return
    }
    setUploadingPhotos(true)
    setUploadError(null)
    const uploaded: RoomPhotoReference[] = []
    try {
      for (const file of Array.from(files)) {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch(`/api/studio/projects/${projectId}/upload`, {
          method: 'POST',
          body: form,
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          setUploadError(body.error ?? `Erreur upload (HTTP ${res.status})`)
          break
        }
        const { fileName } = (await res.json()) as { fileName: string; url: string }
        uploaded.push({ fileName, category: 'piece' })
      }
      if (uploaded.length > 0) {
        const existing = scene.references.roomPhotoAssets ?? []
        updateRoomPhotoAssets([...existing, ...uploaded])
      }
    } catch {
      setUploadError('Erreur reseau lors du telechargement des photos.')
    } finally {
      setUploadingPhotos(false)
    }
  }

  async function removeSketch() {
    if (!scene.references.sketchName || !projectId) return
    setDeletingUploadName(scene.references.sketchName)
    setUploadError(null)
    try {
      await deleteUploadedFile(scene.references.sketchName)
      updateReferences({ sketchName: null })
      updateVisualReferencesPatch({ sketchProvided: false })
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : String(error))
    } finally {
      setDeletingUploadName(null)
    }
  }

  async function removeRoomPhoto(fileName: string) {
    if (!projectId) return
    setDeletingUploadName(fileName)
    setUploadError(null)
    try {
      await deleteUploadedFile(fileName)
      updateRoomPhotoAssets(
        (scene.references.roomPhotoAssets ?? []).filter((asset) => asset.fileName !== fileName),
      )
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : String(error))
    } finally {
      setDeletingUploadName(null)
    }
  }

  function updateRoomPhotoCategory(fileName: string, category: RoomPhotoCategory) {
    const nextAssets = (scene.references.roomPhotoAssets ?? []).map((asset) =>
      asset.fileName === fileName ? { ...asset, category } : asset,
    )
    updateRoomPhotoAssets(nextAssets)
  }

  function updateWorkflowChecklist<
    K extends keyof SiteSurvey['workflowChecklist'],
  >(key: K, value: SiteSurvey['workflowChecklist'][K]) {
    updateSurvey({
      workflowChecklist: {
        ...scene.siteSurvey.workflowChecklist,
        [key]: value,
      },
    })
  }

  function addUsefulHeight() {
    updateSurvey({
      usefulHeights: [
        ...scene.siteSurvey.usefulHeights,
        {
          id: crypto.randomUUID(),
          label: 'Nouvelle sous-hauteur',
          target: 'full-room',
          height: scene.siteSurvey.dimensions.height,
        },
      ],
    })
  }

  function removeUsefulHeight(id: string) {
    updateSurvey({
      usefulHeights: scene.siteSurvey.usefulHeights.filter((usefulHeight) => usefulHeight.id !== id),
    })
  }

  function updateUsefulHeight(
    id: string,
    patch: Partial<SiteSurvey['usefulHeights'][number]>,
  ) {
    updateSurvey({
      usefulHeights: scene.siteSurvey.usefulHeights.map((usefulHeight) =>
        usefulHeight.id === id ? { ...usefulHeight, ...patch } : usefulHeight,
      ),
    })
  }

  function addSurveyOpening(kind: OpeningKind) {
    const opening: SiteSurveyOpeningSpec = {
      id: crypto.randomUUID(),
      name: kind === 'door' ? 'Nouvelle porte' : 'Nouvelle fenetre',
      kind,
      wall: 'north',
      offset: 0.3,
      width: kind === 'door' ? 0.9 : 1.2,
      height: kind === 'door' ? 2.05 : 1.2,
      baseHeight: kind === 'door' ? 0 : 0.95,
    }
    updateSurvey({ openings: [...scene.siteSurvey.openings, opening] })
  }

  function updateSurveyOpening(id: string, patch: Partial<SiteSurveyOpeningSpec>) {
    updateSurvey({
      openings: scene.siteSurvey.openings.map((opening) =>
        opening.id === id ? { ...opening, ...patch } : opening,
      ),
    })
  }

  function removeSurveyOpening(id: string) {
    updateSurvey({
      openings: scene.siteSurvey.openings.filter((opening) => opening.id !== id),
    })
  }

  const validation: SiteSurveyValidationResult = validateSiteSurvey(scene.siteSurvey)
  const badge = STATUS_META[validation.workflow.stage]
  const actionWarnings = validation.warnings.filter(
    (warning) =>
      !validation.workflow.blockers.some((item) => warning.includes(item)) &&
      !validation.workflow.verificationPoints.some((item) => warning.includes(item)),
  )
  const roomPhotoAssets = scene.references.roomPhotoAssets ?? []
  const visualCoverage = summarizeRoomPhotoReferences(scene.references)
  const visualDossier = getVisualDossierSummary(scene)
  const getWallLength = (wall: WallId) =>
    wall === 'north' || wall === 'south'
      ? scene.siteSurvey.dimensions.width
      : scene.siteSurvey.dimensions.depth

  const dimensionsStepDone =
    scene.siteSurvey.dimensions.width > 0 &&
    scene.siteSurvey.dimensions.depth > 0 &&
    scene.siteSurvey.dimensions.height > 0 &&
    scene.siteSurvey.usefulHeights.length > 0 &&
    scene.siteSurvey.usefulHeights.every(
      (usefulHeight) =>
        Number.isFinite(usefulHeight.height) &&
        usefulHeight.height > 0 &&
        usefulHeight.height <= scene.siteSurvey.dimensions.height,
    )

  const openingsStepDone =
    scene.siteSurvey.openings.length > 0 &&
    scene.siteSurvey.openings.every(
      (opening) =>
        Number.isFinite(opening.offset) &&
        Number.isFinite(opening.width) &&
        Number.isFinite(opening.height) &&
        Number.isFinite(opening.baseHeight) &&
        opening.offset >= 0 &&
        opening.width > 0 &&
        opening.height > 0 &&
        opening.baseHeight >= 0 &&
        opening.offset + opening.width <= getWallLength(opening.wall) &&
        opening.baseHeight + opening.height <= scene.siteSurvey.dimensions.height,
    )

  const technicalStepDone =
    scene.siteSurvey.technicalConstraints.waterSupplyWall !== 'unknown' ||
    scene.siteSurvey.technicalConstraints.drainWall !== 'unknown' ||
    scene.siteSurvey.technicalConstraints.hoodMode !== 'unknown' ||
    scene.siteSurvey.technicalConstraints.dedicatedCircuitAvailable ||
    scene.siteSurvey.technicalConstraints.gasSupplyAvailable

  const equipmentStepDone =
    scene.siteSurvey.desiredEquipment.some((equipment) => equipment.required && equipment.quantity > 0) &&
    scene.siteSurvey.desiredEquipment.every(
      (equipment) => Number.isInteger(equipment.quantity) && equipment.quantity >= 0,
    )

  const finishesStepDone =
    scene.siteSurvey.finishPreferences.frontsColor.trim().length > 0 &&
    scene.siteSurvey.finishPreferences.worktopColor.trim().length > 0 &&
    scene.siteSurvey.finishPreferences.handleStyle.trim().length > 0

  const visualStepDone =
    (scene.siteSurvey.visualReferences.sketchProvided ||
      scene.siteSurvey.visualReferences.roomPhotosProvided) &&
    Number.isInteger(scene.siteSurvey.visualReferences.roomPhotoCount) &&
    scene.siteSurvey.visualReferences.roomPhotoCount >= 0 &&
    (!scene.siteSurvey.visualReferences.roomPhotosProvided ||
      (scene.siteSurvey.visualReferences.roomPhotoCount >= 2 &&
        scene.siteSurvey.visualReferences.floorPhotoProvided &&
        scene.siteSurvey.visualReferences.ceilingPhotoProvided &&
        scene.siteSurvey.visualReferences.fullWallSetProvided))

  const checklistStepDone =
    scene.siteSurvey.workflowChecklist.dimensionsVerified &&
    scene.siteSurvey.workflowChecklist.heightsVerified &&
    scene.siteSurvey.workflowChecklist.openingsVerified &&
    scene.siteSurvey.workflowChecklist.technicalVerified &&
    scene.siteSurvey.workflowChecklist.clientNeedsVerified &&
    scene.siteSurvey.workflowChecklist.finishesVerified &&
    scene.siteSurvey.workflowChecklist.photosVerified

  let lockFollowingSteps = false
  const guidedSteps = [
    { id: 'survey-step-1', number: '1', title: 'Dimensions et hauteurs', done: dimensionsStepDone },
    { id: 'survey-step-2', number: '2', title: 'Ouvertures relevees', done: openingsStepDone },
    { id: 'survey-step-3', number: '3', title: 'Contraintes techniques', done: technicalStepDone },
    { id: 'survey-step-4', number: '4', title: 'Equipements souhaites', done: equipmentStepDone },
    { id: 'survey-step-5', number: '5', title: 'Finitions generiques', done: finishesStepDone },
    { id: 'survey-step-6', number: '6', title: 'References visuelles', done: visualStepDone },
    { id: 'survey-step-7', number: '7', title: 'Checklist operateur', done: checklistStepDone },
  ].map((step) => {
    const locked = lockFollowingSteps
    const current = !locked && !step.done
    if (!step.done) lockFollowingSteps = true
    return { ...step, locked, current }
  })

  const currentGuidedStep = guidedSteps.find((step) => step.current) || guidedSteps[guidedSteps.length - 1]

  function jumpToStep(stepId: string) {
    document.getElementById(stepId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className="space-y-6">
      <Card title="Releve chantier guide" subtitle="Processus terrain unique pour Yves">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-6">
          <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className={`rounded-full px-4 py-2 text-sm font-semibold ${badge.className}`}>
                  {badge.label}
                </span>
                <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#8f857d] uppercase tracking-[0.14em]">Completude</span>
                  <span className="text-sm font-semibold text-[#201d1e]">{validation.completeness.score} %</span>
                </div>
                <div className="h-2 rounded-full bg-[#ede8e0] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${validation.completeness.score}%`,
                      backgroundColor:
                        validation.workflow.stage === 'pret'
                          ? '#4ade80'
                          : validation.workflow.stage === 'bloquant'
                            ? '#f87171'
                            : validation.workflow.stage === 'suffisant'
                              ? '#60a5fa'
                              : '#fbbf24',
                    }}
                  />
                </div>
              </div>
            </div>

            <p className="text-sm text-[#5f5750]">{badge.hint}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <MessageBox tone={validation.workflow.previewReady ? 'success' : 'warning'}>
                Preview {validation.workflow.previewReady ? 'possible' : 'pas encore fiable'}
              </MessageBox>
              <MessageBox tone={validation.workflow.previewReady ? 'success' : 'warning'}>
                Rendu express {validation.workflow.previewReady ? 'possible' : 'verrouille'}
              </MessageBox>
              <MessageBox tone={validation.workflow.renderReady ? 'success' : 'warning'}>
                Rendu Blender {validation.workflow.renderReady ? 'autorise' : 'verrouille'}
              </MessageBox>
            </div>

            <InfoNote title="Comment Yves doit l utiliser">
              Remplir le releve dans l ordre, du haut vers le bas. Chaque bloc alimente soit la geometrie,
              soit les choix visuels, soit la validation avant rendu Blender.
            </InfoNote>

            <InfoNote title="Action suivante">
              {validation.workflow.nextAction}
            </InfoNote>

            <div className="rounded-[18px] border border-[#e6dccf] bg-[#f8f4ee] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8f857d]">
                  Workflow guide
                </p>
                <span className="text-sm font-semibold text-[#201d1e]">
                  Etape actuelle: {currentGuidedStep.number}. {currentGuidedStep.title}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-2">
                {guidedSteps.map((step) => (
                  <button
                    key={step.id}
                    type="button"
                    disabled={step.locked}
                    onClick={() => jumpToStep(step.id)}
                    className={[
                      'w-full rounded-[14px] border px-4 py-3 text-left transition-colors',
                      step.locked
                        ? 'border-[#ece4d8] bg-[#f7f4ef] text-[#a19a92] cursor-not-allowed'
                        : step.done
                          ? 'border-[#cfe4d1] bg-[#f1faf2] text-[#276127]'
                          : 'border-[#d9d2c7] bg-white text-[#201d1e]',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">
                        {step.number}. {step.title}
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                        {step.locked ? 'Verrouillee' : step.done ? 'Completee' : 'En cours'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {validation.workflow.blockers.length > 0 && (
              <div className="space-y-2">
                {validation.workflow.blockers.map((blocker, index) => (
                  <MessageBox key={index} tone="error">
                    {blocker}
                  </MessageBox>
                ))}
              </div>
            )}

            {validation.workflow.verificationPoints.length > 0 && (
              <div className="space-y-2">
                {validation.workflow.verificationPoints.map((item, index) => (
                  <MessageBox key={index} tone="warning">
                    {item}
                  </MessageBox>
                ))}
              </div>
            )}

            {validation.errors.length > 0 && (
              <div className="space-y-2">
                {validation.errors.map((error, index) => (
                  <MessageBox key={index} tone="error">
                    {error}
                  </MessageBox>
                ))}
              </div>
            )}

            {actionWarnings.length > 0 && (
              <div className="space-y-2">
                {actionWarnings.map((warning, index) => (
                  <MessageBox key={index} tone="info">
                    {warning}
                  </MessageBox>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-[#ebe1d5] bg-[#faf7f2] p-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#8f857d]">Process standard</p>
            <div className="mt-4 space-y-4">
              {PROCESS_STEPS.map((step) => (
                <div key={step.id} className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-[#201d1e] text-white text-sm font-semibold flex items-center justify-center shrink-0">
                    {step.id}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#201d1e]">{step.title}</p>
                    <p className="text-sm text-[#6f6863] mt-1">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card
          id="survey-step-1"
          title="Etape 1 · Dimensions et hauteurs"
          subtitle="Base geometrique du rendu"
          step={guidedSteps[0]}
        >
          <div className="space-y-4">
            <InfoNote title="Ce que Yves doit mesurer">
              Largeur, profondeur, hauteur et toutes les sous-hauteurs utiles visibles sur le terrain:
              plan de travail, debut meuble haut, fin meuble haut, retombee, sous-poutre.
            </InfoNote>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <NumberField
                label="Largeur piece (m)"
                value={scene.siteSurvey.dimensions.width}
                onChange={(value) => updateSurveyDimension('width', value)}
              />
              <NumberField
                label="Profondeur piece (m)"
                value={scene.siteSurvey.dimensions.depth}
                onChange={(value) => updateSurveyDimension('depth', value)}
              />
              <NumberField
                label="Hauteur sous plafond (m)"
                value={scene.siteSurvey.dimensions.height}
                onChange={(value) => updateSurveyDimension('height', value)}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#201d1e]">Sous-hauteurs utiles</p>
              <SmallAction onClick={addUsefulHeight}>Ajouter une mesure</SmallAction>
            </div>

            {scene.siteSurvey.usefulHeights.length === 0 && (
              <MessageBox tone="warning">
                Ajoute toutes les sous-hauteurs utiles que Yves peut prendre sur place.
              </MessageBox>
            )}

            <div className="space-y-3">
              {scene.siteSurvey.usefulHeights.map((usefulHeight) => (
                <div
                  key={usefulHeight.id}
                  className="rounded-[20px] border border-[#ebe1d5] bg-[#faf7f2] p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <input
                      value={usefulHeight.label}
                      onChange={(event) =>
                        updateUsefulHeight(usefulHeight.id, { label: event.target.value })
                      }
                      className="w-full rounded-[12px] border border-[#e1d4c4] bg-white px-3 py-2 text-sm"
                      placeholder="Ex. sol -> plan de travail"
                    />
                    <button
                      onClick={() => removeUsefulHeight(usefulHeight.id)}
                      className="text-xs text-[#9b5143] font-semibold"
                    >
                      Suppr
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <SelectField
                      label="Zone concernee"
                      value={usefulHeight.target}
                      onChange={(value) =>
                        updateUsefulHeight(usefulHeight.id, {
                          target: value as SurveyUsefulHeightTarget,
                        })
                      }
                      options={SURVEY_USEFUL_HEIGHT_TARGETS.map((target) => ({
                        id: target,
                        label: HEIGHT_TARGET_LABELS[target],
                      }))}
                    />
                    <NumberField
                      label="Hauteur (m)"
                      value={usefulHeight.height}
                      step={0.01}
                      onChange={(value) => updateUsefulHeight(usefulHeight.id, { height: value })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card
          id="survey-step-2"
          title="Etape 2 · Ouvertures relevees"
          subtitle="Portes et fenetres du terrain"
          step={guidedSteps[1]}
        >
          <div className="space-y-4">
            <InfoNote title="Pourquoi c est important">
              Chaque ouverture est reprise dans la scene canonique. Si cette section est fausse, le rendu
              Blender et les angles de vue seront faux.
            </InfoNote>

            <div className="flex gap-2">
              <SmallAction onClick={() => addSurveyOpening('door')}>Ajouter porte</SmallAction>
              <SmallAction onClick={() => addSurveyOpening('window')}>Ajouter fenetre</SmallAction>
            </div>

            {scene.siteSurvey.openings.length === 0 && (
              <MessageBox tone="warning">
                Ajoute toutes les ouvertures qui impactent le plan ou la lecture client.
              </MessageBox>
            )}

            <div className="space-y-3">
              {scene.siteSurvey.openings.map((opening) => (
                <div
                  key={opening.id}
                  className="rounded-[20px] border border-[#ebe1d5] bg-[#faf7f2] p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <input
                      value={opening.name}
                      onChange={(event) =>
                        updateSurveyOpening(opening.id, { name: event.target.value })
                      }
                      className="w-full rounded-[12px] border border-[#e1d4c4] bg-white px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => removeSurveyOpening(opening.id)}
                      className="text-xs text-[#9b5143] font-semibold"
                    >
                      Suppr
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <SelectField
                      label="Mur"
                      value={opening.wall}
                      onChange={(value) =>
                        updateSurveyOpening(opening.id, { wall: value as WallId })
                      }
                      options={WALL_IDS.map((wall) => ({ id: wall, label: WALL_LABELS[wall] }))}
                    />
                    <SelectField
                      label="Type"
                      value={opening.kind}
                      onChange={(value) =>
                        updateSurveyOpening(opening.id, { kind: value as OpeningKind })
                      }
                      options={[
                        { id: 'door', label: 'Porte' },
                        { id: 'window', label: 'Fenetre' },
                      ]}
                    />
                    <NumberField
                      label="Offset depuis angle (m)"
                      value={opening.offset}
                      onChange={(value) => updateSurveyOpening(opening.id, { offset: value })}
                    />
                    <NumberField
                      label="Largeur (m)"
                      value={opening.width}
                      onChange={(value) => updateSurveyOpening(opening.id, { width: value })}
                    />
                    <NumberField
                      label="Hauteur (m)"
                      value={opening.height}
                      onChange={(value) => updateSurveyOpening(opening.id, { height: value })}
                    />
                    <NumberField
                      label="Allege (m)"
                      value={opening.baseHeight}
                      onChange={(value) => updateSurveyOpening(opening.id, { baseHeight: value })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card
          id="survey-step-3"
          title="Etape 3 · Contraintes techniques"
          subtitle="Ce qui bloque ou guide l implantation"
          step={guidedSteps[2]}
        >
          <div className="space-y-4">
            <InfoNote title="Donnees reutilisees">
              Eau, evacuation, hotte, electricite et gaz servent a eliminer les implantations impossibles
              avant meme Blender.
            </InfoNote>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <SelectField
                label="Mur arrivee eau"
                value={scene.siteSurvey.technicalConstraints.waterSupplyWall}
                onChange={(value) =>
                  updateTechnicalConstraint('waterSupplyWall', value as WallId | 'unknown')
                }
                options={[
                  ...WALL_IDS.map((wall) => ({ id: wall, label: WALL_LABELS[wall] })),
                  { id: 'unknown', label: 'Non renseigne' },
                ]}
              />
              <SelectField
                label="Mur evacuation"
                value={scene.siteSurvey.technicalConstraints.drainWall}
                onChange={(value) =>
                  updateTechnicalConstraint('drainWall', value as WallId | 'unknown')
                }
                options={[
                  ...WALL_IDS.map((wall) => ({ id: wall, label: WALL_LABELS[wall] })),
                  { id: 'unknown', label: 'Non renseigne' },
                ]}
              />
              <SelectField
                label="Mode hotte"
                value={scene.siteSurvey.technicalConstraints.hoodMode}
                onChange={(value) => updateTechnicalConstraint('hoodMode', value as SurveyHoodMode)}
                options={HOOD_OPTIONS}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <CheckboxField
                label="Circuit electrique dedie disponible"
                checked={scene.siteSurvey.technicalConstraints.dedicatedCircuitAvailable}
                onChange={(checked) =>
                  updateTechnicalConstraint('dedicatedCircuitAvailable', checked)
                }
              />
              <CheckboxField
                label="Arrivee gaz disponible"
                checked={scene.siteSurvey.technicalConstraints.gasSupplyAvailable}
                onChange={(checked) => updateTechnicalConstraint('gasSupplyAvailable', checked)}
              />
            </div>
          </div>
        </Card>

        <Card
          id="survey-step-4"
          title="Etape 4 · Equipements souhaites"
          subtitle="Ce que le client veut vraiment"
          step={guidedSteps[3]}
        >
          <div className="space-y-4">
            <InfoNote title="Regle simple pour Yves">
              Coche seulement ce qui est vraiment demande par le client. Si c est obligatoire, mets une
              quantite exploitable.
            </InfoNote>

            <div className="space-y-3">
              {SURVEY_EQUIPMENT_TYPES.map((type) => {
                const equipment = scene.siteSurvey.desiredEquipment.find((item) => item.type === type) || {
                  type,
                  required: false,
                  quantity: 0,
                  notes: '',
                }

                return (
                  <div
                    key={type}
                    className="rounded-[20px] border border-[#ebe1d5] bg-[#faf7f2] p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#201d1e]">{EQUIPMENT_LABELS[type]}</p>

                      <div className="flex items-center gap-3">
                        <CheckboxField
                          label="Requis"
                          checked={equipment.required}
                          onChange={(checked) =>
                            updateDesiredEquipment(type, {
                              required: checked,
                              quantity: checked
                                ? equipment.quantity === 0
                                  ? 1
                                  : equipment.quantity
                                : 0,
                            })
                          }
                          compact
                        />

                        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#8f857d]">
                          Qte
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={equipment.quantity}
                            onChange={(event) => {
                              const parsed = Math.round(Number(event.target.value))
                              const quantity = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
                              updateDesiredEquipment(type, { quantity })
                            }}
                            className="w-20 rounded-[12px] border border-[#e1d4c4] bg-white px-2.5 py-2 text-sm text-[#201d1e]"
                          />
                        </label>
                      </div>
                    </div>

                    <TextField
                      label="Notes operateur"
                      value={equipment.notes || ''}
                      placeholder="Ex. four en colonne, refrigerateur americain, hotte plafond..."
                      onChange={(value) => updateDesiredEquipment(type, { notes: value })}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card
          id="survey-step-5"
          title="Etape 5 · Finitions generiques"
          subtitle="Espace prepare pour le futur catalogue"
          step={guidedSteps[4]}
        >
          <div className="space-y-4">
            <InfoNote title="Ce qui sera remappe plus tard">
              Pour l instant, Yves renseigne des choix generiques. Plus tard, ces champs seront relies a de
              vraies references catalogue.
            </InfoNote>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <TextField
                label="Facades / couleur"
                value={scene.siteSurvey.finishPreferences.frontsColor}
                placeholder="Ex. blanc mat, chene naturel..."
                onChange={(value) => updateFinishPreference('frontsColor', value)}
              />
              <TextField
                label="Plan de travail"
                value={scene.siteSurvey.finishPreferences.worktopColor}
                placeholder="Ex. quartz ivoire, pierre foncee..."
                onChange={(value) => updateFinishPreference('worktopColor', value)}
              />
              <TextField
                label="Credence"
                value={scene.siteSurvey.finishPreferences.splashbackColor}
                placeholder="Ex. ton mur, verre clair, ceramique..."
                onChange={(value) => updateFinishPreference('splashbackColor', value)}
              />
              <TextField
                label="Poignees / systeme"
                value={scene.siteSurvey.finishPreferences.handleStyle}
                placeholder="Ex. gorge, poignee noire, sans poignee..."
                onChange={(value) => updateFinishPreference('handleStyle', value)}
              />
              <TextField
                label="Finition electromenager"
                value={scene.siteSurvey.finishPreferences.applianceFinish}
                placeholder="Ex. inox, noir mat, blanc..."
                onChange={(value) => updateFinishPreference('applianceFinish', value)}
              />
            </div>
          </div>
        </Card>

        <Card
          id="survey-step-6"
          title="Etape 6 · References visuelles"
          subtitle="Croquis et photos de la piece"
          step={guidedSteps[5]}
        >
          <div className="space-y-4">
            <InfoNote title="Utilite pour le pipeline">
              Ces informations ne decident pas la geometrie. Elles servent a preparer les futurs overlays
              visuels, a guider les materiaux et a rassurer le client.
            </InfoNote>

            <MessageBox
              tone={
                visualDossier.status === 'complet'
                  ? 'success'
                  : visualDossier.status === 'suffisant'
                    ? 'info'
                    : 'warning'
              }
            >
              {visualDossier.label} · {visualDossier.score}% · {visualDossier.hint}
            </MessageBox>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <CheckboxField
                label="Croquis ou plan joint"
                checked={scene.siteSurvey.visualReferences.sketchProvided}
                onChange={(checked) => updateVisualReference('sketchProvided', checked)}
              />
              <CheckboxField
                label="Photos de piece disponibles"
                checked={scene.siteSurvey.visualReferences.roomPhotosProvided}
                onChange={(checked) => updateVisualReference('roomPhotosProvided', checked)}
              />
              <CheckboxField
                label="Le sol est visible"
                checked={scene.siteSurvey.visualReferences.floorPhotoProvided}
                onChange={(checked) => updateVisualReference('floorPhotoProvided', checked)}
              />
              <CheckboxField
                label="Le plafond est visible"
                checked={scene.siteSurvey.visualReferences.ceilingPhotoProvided}
                onChange={(checked) => updateVisualReference('ceilingPhotoProvided', checked)}
              />
              <CheckboxField
                label="Toutes les faces de mur sont couvertes"
                checked={scene.siteSurvey.visualReferences.fullWallSetProvided}
                onChange={(checked) => updateVisualReference('fullWallSetProvided', checked)}
              />
              <NumberField
                label="Nombre de photos"
                value={scene.siteSurvey.visualReferences.roomPhotoCount}
                step={1}
                onChange={(value) =>
                  updateVisualReference('roomPhotoCount', Math.max(0, Math.round(value)))
                }
              />
            </div>

            {uploadError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {uploadError}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="space-y-3">
                <label className="block text-xs font-medium text-[#555]">
                  Croquis ou plan (image ou PDF)
                </label>
                <label className={`inline-flex items-center gap-2 cursor-pointer rounded border px-3 py-2 text-xs font-medium ${uploadingSketch ? 'opacity-50 pointer-events-none border-[#ddd] text-[#aaa]' : 'border-[#e3d9cb] text-[#201d1e] hover:border-[#c9b6a1]'}`}>
                  {uploadingSketch ? 'Envoi en cours…' : scene.references.sketchName ? 'Remplacer le croquis' : 'Joindre un croquis'}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="sr-only"
                    disabled={uploadingSketch}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void uploadSketch(file)
                      e.target.value = ''
                    }}
                  />
                </label>

                {scene.references.sketchName ? (
                  <UploadAssetCard
                    label="Croquis joint"
                    fileName={scene.references.sketchName}
                    href={getUploadUrl(projectId, scene.references.sketchName)}
                    deleting={deletingUploadName === scene.references.sketchName}
                    onDelete={() => void removeSketch()}
                  />
                ) : (
                  <p className="text-xs text-[#8f857d]">
                    Aucun croquis associe au projet pour l instant.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-medium text-[#555]">
                  Photos de la piece
                  {roomPhotoAssets.length > 0 && (
                    <span className="ml-2 text-[#777] font-normal">({roomPhotoAssets.length} fichier{roomPhotoAssets.length > 1 ? 's' : ''})</span>
                  )}
                </label>
                <label className={`inline-flex items-center gap-2 cursor-pointer rounded border px-3 py-2 text-xs font-medium ${uploadingPhotos ? 'opacity-50 pointer-events-none border-[#ddd] text-[#aaa]' : 'border-[#e3d9cb] text-[#201d1e] hover:border-[#c9b6a1]'}`}>
                  {uploadingPhotos ? 'Envoi en cours…' : 'Ajouter des photos'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    disabled={uploadingPhotos}
                    onChange={(e) => {
                      if (e.target.files) void uploadPhotos(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </label>

                {roomPhotoAssets.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {roomPhotoAssets.map((asset) => (
                      <UploadAssetCard
                        key={asset.fileName}
                        label="Photo terrain"
                        fileName={asset.fileName}
                        href={getUploadUrl(projectId, asset.fileName)}
                        category={asset.category}
                        categoryOptions={ROOM_PHOTO_CATEGORIES.map((category) => ({
                          id: category,
                          label: ROOM_PHOTO_CATEGORY_LABELS[category],
                        }))}
                        deleting={deletingUploadName === asset.fileName}
                        onCategoryChange={(value) =>
                          updateRoomPhotoCategory(asset.fileName, value as RoomPhotoCategory)
                        }
                        onDelete={() => void removeRoomPhoto(asset.fileName)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#8f857d]">
                    Aucune photo terrain associee au projet pour l instant.
                  </p>
                )}
              </div>
            </div>

            <InfoNote title="Couverture detectee via les uploads">
              {[
                `${visualCoverage.count} photo${visualCoverage.count > 1 ? 's' : ''} chargee${visualCoverage.count > 1 ? 's' : ''}`,
                `murs: ${formatWallCoverage(visualCoverage.wallCoverage)}`,
                visualCoverage.wallCoverage.length > 0 && visualCoverage.missingWalls.length > 0
                  ? `murs manquants: ${formatWallCoverage(visualCoverage.missingWalls)}`
                  : null,
                visualCoverage.hasGenericWall ? 'photos mur generiques presentes' : null,
                visualCoverage.hasFloor ? 'sol detecte via upload' : 'sol non detecte via upload',
                visualCoverage.hasCeiling ? 'plafond detecte via upload' : 'plafond non detecte via upload',
                visualCoverage.wallCoverage.length === 4
                  ? 'serie murs complete detectee'
                  : 'serie murs complete non detectee',
                visualCoverage.technicalDetailCount > 0
                  ? `${visualCoverage.technicalDetailCount} detail${visualCoverage.technicalDetailCount > 1 ? 's' : ''} technique${visualCoverage.technicalDetailCount > 1 ? 's' : ''}`
                  : null,
                visualCoverage.finishDetailCount > 0
                  ? `${visualCoverage.finishDetailCount} detail${visualCoverage.finishDetailCount > 1 ? 's' : ''} finition`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </InfoNote>

            {visualDossier.missing.length > 0 && (
              <InfoNote title="Ce qui manque encore">
                {visualDossier.missing.join(' · ')}
              </InfoNote>
            )}
          </div>
        </Card>
      </section>

      <Card
        id="survey-step-7"
        title="Etape 7 · Checklist operateur"
        subtitle="Toujours la meme avant sauvegarde"
        step={guidedSteps[6]}
      >
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <CheckboxField
              label="Dimensions verifiees"
              checked={scene.siteSurvey.workflowChecklist.dimensionsVerified}
              onChange={(checked) => updateWorkflowChecklist('dimensionsVerified', checked)}
            />
            <CheckboxField
              label="Sous-hauteurs verifiees"
              checked={scene.siteSurvey.workflowChecklist.heightsVerified}
              onChange={(checked) => updateWorkflowChecklist('heightsVerified', checked)}
            />
            <CheckboxField
              label="Ouvertures verifiees"
              checked={scene.siteSurvey.workflowChecklist.openingsVerified}
              onChange={(checked) => updateWorkflowChecklist('openingsVerified', checked)}
            />
            <CheckboxField
              label="Contraintes techniques verifiees"
              checked={scene.siteSurvey.workflowChecklist.technicalVerified}
              onChange={(checked) => updateWorkflowChecklist('technicalVerified', checked)}
            />
            <CheckboxField
              label="Besoins client confirmes"
              checked={scene.siteSurvey.workflowChecklist.clientNeedsVerified}
              onChange={(checked) => updateWorkflowChecklist('clientNeedsVerified', checked)}
            />
            <CheckboxField
              label="Finitions discutees"
              checked={scene.siteSurvey.workflowChecklist.finishesVerified}
              onChange={(checked) => updateWorkflowChecklist('finishesVerified', checked)}
            />
            <CheckboxField
              label="Photos controlees"
              checked={scene.siteSurvey.workflowChecklist.photosVerified}
              onChange={(checked) => updateWorkflowChecklist('photosVerified', checked)}
            />
          </div>

          <div className="space-y-4">
            <InfoNote title="Quand cocher cette checklist">
              Seulement quand Yves a vraiment confirme l information avec le client ou la mesure terrain.
              La checklist sert de garde-fou avant la revision et avant Blender.
            </InfoNote>

            <TextAreaField
              label="Notes de releve"
              value={scene.siteSurvey.notes}
              placeholder="Ex. mur legerement hors equerre, radiateur a conserver, tuyau visible, hauteur sous poutre..."
              onChange={(value) => updateSurvey({ notes: value })}
            />
          </div>
        </div>
      </Card>
    </section>
  )
}

function Card({
  id,
  title,
  subtitle,
  children,
  step,
}: {
  id?: string
  title: string
  subtitle: string
  children: React.ReactNode
  step?: {
    number: string
    title: string
    done: boolean
    locked: boolean
    current: boolean
  }
}) {
  return (
    <div
      id={id}
      className={[
        'bg-white rounded-[28px] border p-6 shadow-[0_16px_40px_rgba(36,31,32,0.06)]',
        step?.current
          ? 'border-[#d8ccbc]'
          : step?.locked
            ? 'border-[#f0e8dc]'
            : 'border-[#ece4d8]',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#8f857d]">{subtitle}</p>
          <h2 className="text-[22px] font-semibold text-[#201d1e] mt-2">{title}</h2>
        </div>
        {step && (
          <span
            className={[
              'rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]',
              step.locked
                ? 'bg-[#f6f1ea] text-[#988f86]'
                : step.done
                  ? 'bg-[#e5f6e6] text-[#276127]'
                  : 'bg-[#fff5d6] text-[#8f6a11]',
            ].join(' ')}
          >
            {step.locked ? 'Verrouillee' : step.done ? 'Completee' : 'En cours'}
          </span>
        )}
      </div>

      {step?.locked && (
        <div className="mb-5">
          <MessageBox tone="warning">
            Termine l etape precedente pour deverrouiller cette section.
          </MessageBox>
        </div>
      )}

      <div className={step?.locked ? 'pointer-events-none opacity-45 select-none' : ''}>
        {children}
      </div>
    </div>
  )
}

function UploadAssetCard({
  label,
  fileName,
  href,
  category,
  categoryOptions,
  deleting = false,
  onCategoryChange,
  onDelete,
}: {
  label: string
  fileName: string
  href: string
  category?: RoomPhotoCategory
  categoryOptions?: { id: string; label: string }[]
  deleting?: boolean
  onCategoryChange?: (value: string) => void
  onDelete: () => void
}) {
  const previewIsImage = isImageAsset(fileName)
  const extension = getFileExtension(fileName).toUpperCase() || 'FICHIER'

  return (
    <div className="rounded-[18px] border border-[#e6dccf] bg-[#fbf8f3] p-3">
      <div className="flex items-start gap-3">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 overflow-hidden rounded-[14px] border border-[#e1d4c4] bg-white"
        >
          {previewIsImage ? (
            <img
              src={href}
              alt={fileName}
              className="h-20 w-20 object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6f6863]">
              {extension}
            </div>
          )}
        </a>

        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8f857d]">{label}</p>
            <p className="mt-1 truncate text-sm font-medium text-[#201d1e]">{fileName}</p>
          </div>

          {category && categoryOptions && onCategoryChange ? (
            <SelectField
              label="Categorie"
              value={category}
              onChange={onCategoryChange}
              options={categoryOptions}
            />
          ) : null}

          <div className="flex flex-wrap gap-2">
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[#d8ccbc] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#201d1e]"
            >
              Ouvrir
            </a>
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="rounded-full border border-[#efc6bc] bg-[#fff1ec] px-3 py-1.5 text-[11px] font-semibold text-[#9b5143] disabled:opacity-60"
            >
              {deleting ? 'Suppression...' : 'Supprimer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SmallAction({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full bg-[#201d1e] px-3 py-1.5 text-[11px] font-semibold text-white"
    >
      {children}
    </button>
  )
}

function MessageBox({
  tone,
  children,
}: {
  tone: 'warning' | 'error' | 'info' | 'success'
  children: React.ReactNode
}) {
  const className =
    tone === 'error'
      ? 'border-[#ecd7cc] bg-[#fff6f2] text-[#8e4f3f]'
      : tone === 'success'
        ? 'border-[#cde4cf] bg-[#eff9f0] text-[#276127]'
        : tone === 'info'
          ? 'border-[#d7d8e9] bg-[#f6f6ff] text-[#3d466d]'
          : 'border-[#fde8c0] bg-[#fffbf0] text-[#92400e]'

  return <div className={`rounded-[14px] border px-3 py-2 text-sm ${className}`}>{children}</div>
}

function InfoNote({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[18px] border border-[#e6dccf] bg-[#f8f4ee] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8f857d]">{title}</p>
      <p className="text-sm text-[#5f5750] mt-2">{children}</p>
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  step = 0.05,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
}) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-[0.16em] text-[#8f857d] mb-2">
        {label}
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-[14px] border border-[#e1d4c4] bg-white px-3 py-2.5 text-sm"
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { id: string; label: string }[]
}) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-[0.16em] text-[#8f857d] mb-2">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[14px] border border-[#e1d4c4] bg-white px-3 py-2.5 text-sm"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-[0.16em] text-[#8f857d] mb-2">
        {label}
      </span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[14px] border border-[#e1d4c4] bg-white px-3 py-2.5 text-sm"
      />
    </label>
  )
}

function TextAreaField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-[0.16em] text-[#8f857d] mb-2">
        {label}
      </span>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        className="w-full rounded-[14px] border border-[#e1d4c4] bg-white px-3 py-2.5 text-sm"
      />
    </label>
  )
}

function CheckboxField({
  label,
  checked,
  onChange,
  compact = false,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  compact?: boolean
}) {
  return (
    <label
      className={[
        'rounded-[14px] border border-[#e1d4c4] bg-white px-3 py-2.5 flex items-center gap-2 text-sm text-[#201d1e]',
        compact ? 'py-2 px-2.5 rounded-[12px]' : '',
      ].join(' ')}
    >
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  )
}
