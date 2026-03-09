export const WALL_IDS = ['north', 'east', 'south', 'west'] as const
export const OPENING_KINDS = ['door', 'window'] as const
export const MODULE_KINDS = ['base', 'tall', 'wall', 'island'] as const
export const REVISION_SOURCES = ['seed', 'manual', 'autosave', 'import'] as const
export const SURVEY_USEFUL_HEIGHT_TARGETS = ['full-room', ...WALL_IDS] as const
export const SURVEY_EQUIPMENT_TYPES = ['sink', 'hob', 'oven', 'fridge', 'dishwasher', 'hood'] as const
export const SURVEY_HOOD_MODES = ['unknown', 'evacuation', 'recycling'] as const
export const SURVEY_COMPLETENESS_STATUS = ['bloquant', 'a_verifier', 'suffisant', 'pret'] as const
export const PREVIEW_SHELL_MODES = ['auto', '2-walls', '3-walls'] as const
export const AUTO_CAMERA_PRESETS = ['balanced', 'hero', 'wide', 'island'] as const
export const RENDER_AMBIENCE_PRESETS = ['soft-daylight', 'warm-showroom', 'graphite-premium'] as const
export const RENDER_QUALITY_PRESETS = ['express', 'refined'] as const
export const ROOM_PHOTO_CATEGORIES = [
  'piece',
  'mur',
  'mur-nord',
  'mur-est',
  'mur-sud',
  'mur-ouest',
  'sol',
  'plafond',
  'detail-technique',
  'detail-finition',
  'autre',
] as const

export type WallId = (typeof WALL_IDS)[number]
export type OpeningKind = (typeof OPENING_KINDS)[number]
export type ModuleKind = (typeof MODULE_KINDS)[number]
export type RevisionSource = (typeof REVISION_SOURCES)[number]
export type SurveyUsefulHeightTarget = (typeof SURVEY_USEFUL_HEIGHT_TARGETS)[number]
export type SurveyEquipmentType = (typeof SURVEY_EQUIPMENT_TYPES)[number]
export type SurveyHoodMode = (typeof SURVEY_HOOD_MODES)[number]
export type SurveyCompletenessStatus = (typeof SURVEY_COMPLETENESS_STATUS)[number]
export type PreviewShellMode = (typeof PREVIEW_SHELL_MODES)[number]
export type AutoCameraPreset = (typeof AUTO_CAMERA_PRESETS)[number]
export type RenderAmbiencePreset = (typeof RENDER_AMBIENCE_PRESETS)[number]
export type RenderQualityPreset = (typeof RENDER_QUALITY_PRESETS)[number]
export type RoomPhotoCategory = (typeof ROOM_PHOTO_CATEGORIES)[number]

export interface Vector2 {
  x: number
  z: number
}

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface RoomSpec {
  width: number
  depth: number
  height: number
  wallThickness: number
}

export interface OpeningSpec {
  id: string
  name: string
  wall: WallId
  kind: OpeningKind
  offset: number
  width: number
  height: number
  baseHeight: number
}

export interface WallPlacement {
  mode: 'wall'
  wall: WallId
  offset: number
}

export interface FreePlacement {
  mode: 'free'
  x: number
  z: number
  rotation: number
}

export type ModulePlacement = WallPlacement | FreePlacement

export interface KitchenModuleSpec {
  id: string
  templateId: string
  sku: string
  label: string
  kind: ModuleKind
  width: number
  depth: number
  height: number
  elevation: number
  placement: ModulePlacement
  frontsMaterialId?: string
  applianceLabel?: string | null
}

export interface MaterialAssignments {
  fronts: string
  worktop: string
  floor: string
  walls: string
}

export interface RoomPhotoReference {
  fileName: string
  category: RoomPhotoCategory
}

export interface RoomPhotoCoverage {
  count: number
  wallCoverage: WallId[]
  missingWalls: WallId[]
  hasGenericWall: boolean
  hasFloor: boolean
  hasCeiling: boolean
  technicalDetailCount: number
  finishDetailCount: number
  otherCount: number
}

export interface SceneReferences {
  sketchName: string | null
  roomPhotoName: string | null
  roomPhotoNames: string[]
  roomPhotoAssets: RoomPhotoReference[]
}

export interface CameraMatchSpec {
  enabled: boolean
  fov: number
  position: Vector3
  target: Vector3
  lensShiftX: number
  lensShiftY: number
}

export interface SiteSurveyDimensions {
  width: number
  depth: number
  height: number
}

export interface SiteSurveyUsefulHeightSpec {
  id: string
  label: string
  target: SurveyUsefulHeightTarget
  height: number
}

export interface SiteSurveyOpeningSpec {
  id: string
  name: string
  wall: WallId
  kind: OpeningKind
  offset: number
  width: number
  height: number
  baseHeight: number
}

export interface SiteSurveyDesiredEquipmentSpec {
  type: SurveyEquipmentType
  required: boolean
  quantity: number
  notes?: string
}

export interface SiteSurveyTechnicalConstraints {
  waterSupplyWall: WallId | 'unknown'
  drainWall: WallId | 'unknown'
  hoodMode: SurveyHoodMode
  dedicatedCircuitAvailable: boolean
  gasSupplyAvailable: boolean
}

export interface SiteSurveyFinishPreferences {
  frontsColor: string
  worktopColor: string
  splashbackColor: string
  handleStyle: string
  applianceFinish: string
}

export interface SiteSurveyVisualReferences {
  sketchProvided: boolean
  roomPhotosProvided: boolean
  roomPhotoCount: number
  floorPhotoProvided: boolean
  ceilingPhotoProvided: boolean
  fullWallSetProvided: boolean
}

export interface SiteSurveyWorkflowChecklist {
  dimensionsVerified: boolean
  heightsVerified: boolean
  openingsVerified: boolean
  technicalVerified: boolean
  clientNeedsVerified: boolean
  finishesVerified: boolean
  photosVerified: boolean
}

export interface SiteSurveyCompleteness {
  score: number
  status: SurveyCompletenessStatus
}

export interface SiteSurvey {
  dimensions: SiteSurveyDimensions
  usefulHeights: SiteSurveyUsefulHeightSpec[]
  openings: SiteSurveyOpeningSpec[]
  desiredEquipment: SiteSurveyDesiredEquipmentSpec[]
  technicalConstraints: SiteSurveyTechnicalConstraints
  finishPreferences: SiteSurveyFinishPreferences
  visualReferences: SiteSurveyVisualReferences
  workflowChecklist: SiteSurveyWorkflowChecklist
  completeness: SiteSurveyCompleteness
  notes: string
}

export interface SiteSurveyValidationResult {
  errors: string[]
  warnings: string[]
  completeness: SiteSurveyCompleteness
  workflow: SiteSurveyWorkflowState
}

export interface SiteSurveyWorkflowState {
  stage: SurveyCompletenessStatus
  previewReady: boolean
  renderReady: boolean
  blockers: string[]
  verificationPoints: string[]
  nextAction: string
}

export interface StudioScene {
  id: string
  version: number
  name: string
  room: RoomSpec
  openings: OpeningSpec[]
  modules: KitchenModuleSpec[]
  materials: MaterialAssignments
  references: SceneReferences
  cameraMatch: CameraMatchSpec
  previewShellMode: PreviewShellMode
  autoCameraPreset: AutoCameraPreset
  renderAmbiencePreset: RenderAmbiencePreset
  renderQualityPreset: RenderQualityPreset
  siteSurvey: SiteSurvey
  notes: string
}

export interface CompiledMesh {
  id: string
  kind: 'floor' | 'ceiling' | 'wall' | 'module' | 'worktop' | 'opening'
  position: Vector3
  size: Vector3
  rotationY: number
  color: string
  opacity?: number
  wireframe?: boolean
}

export interface CompiledLabel {
  id: string
  text: string
  position: Vector3
}

export interface CompiledCamera {
  position: Vector3
  target: Vector3
  fov: number
}

export interface CompiledScene {
  sceneId: string
  bounds: { width: number; depth: number; height: number }
  meshes: CompiledMesh[]
  labels: CompiledLabel[]
  camera: CompiledCamera
  warnings: string[]
}

export interface StudioProjectSummary {
  id: string
  name: string
  status: 'draft' | 'ready' | 'rendering'
  surveyStage: SurveyCompletenessStatus
  visualDossierStatus: 'insuffisant' | 'suffisant' | 'complet'
  visualDossierScore: number
  latestRevisionNumber: number
  createdAt: string
  updatedAt: string
}

export interface StudioProjectRevision {
  id: string
  projectId: string
  revisionNumber: number
  createdAt: string
  source: RevisionSource
  scene: StudioScene
}

export interface StudioProjectRecord extends StudioProjectSummary {
  scene: StudioScene
  revisions: StudioProjectRevision[]
}

export interface BlenderRenderPackage {
  version: '1.0'
  generatedAt: string
  project: {
    id: string
    name: string
    latestRevisionNumber: number
  }
  scene: StudioScene
  compiled: CompiledScene
  renderPreset: {
    engine: 'CYCLES'
    quality: RenderQualityPreset
    ambience: RenderAmbiencePreset
    output: { width: number; height: number; format: 'PNG'; samples: number }
    colorManagement: string
    exposure: number
    backgroundColor: string
    worldStrength: number
    denoise: boolean
    adaptiveThreshold: number
    maxBounces: number
    diffuseBounces: number
    glossyBounces: number
    transmissionBounces: number
    filterWidth: number
    bevelWidth: number
    bevelSegments: number
    lighting: {
      areaEnergyMultiplier: number
      areaColor: string
      fillEnergy: number
      fillColor: string
      rimEnergy: number
      rimColor: string
      sunEnergy: number
      sunColor: string
    }
  }
}

export function clampSceneNumber(value: number, minimum: number, fallback: number): number {
  if (!Number.isFinite(value) || value < minimum) return fallback
  return value
}

function getRoomWallLength(room: Pick<RoomSpec, 'width' | 'depth'>, wall: WallId): number {
  return wall === 'north' || wall === 'south' ? room.width : room.depth
}

function approximatelyEqual(left: number, right: number, tolerance = 0.02): boolean {
  return Math.abs(left - right) <= tolerance
}

function hasText(value: string): boolean {
  return value.trim().length > 0
}

export function normalizeSiteSurvey(siteSurvey: SiteSurvey): SiteSurvey {
  const normalizedStatus = (() => {
    const status = siteSurvey.completeness?.status
    if (status === 'pret' || status === 'suffisant' || status === 'a_verifier' || status === 'bloquant') {
      return status
    }
    if (status === 'a_corriger') return 'bloquant'
    if (status === 'incomplet') return 'a_verifier'
    return 'bloquant'
  })()

  return {
    dimensions: {
      width: siteSurvey.dimensions?.width ?? 0,
      depth: siteSurvey.dimensions?.depth ?? 0,
      height: siteSurvey.dimensions?.height ?? 0,
    },
    usefulHeights: siteSurvey.usefulHeights || [],
    openings: siteSurvey.openings || [],
    desiredEquipment: siteSurvey.desiredEquipment || [],
    technicalConstraints: {
      waterSupplyWall: siteSurvey.technicalConstraints?.waterSupplyWall ?? 'unknown',
      drainWall: siteSurvey.technicalConstraints?.drainWall ?? 'unknown',
      hoodMode: siteSurvey.technicalConstraints?.hoodMode ?? 'unknown',
      dedicatedCircuitAvailable:
        siteSurvey.technicalConstraints?.dedicatedCircuitAvailable ?? false,
      gasSupplyAvailable: siteSurvey.technicalConstraints?.gasSupplyAvailable ?? false,
    },
    finishPreferences: {
      frontsColor: siteSurvey.finishPreferences?.frontsColor ?? '',
      worktopColor: siteSurvey.finishPreferences?.worktopColor ?? '',
      splashbackColor: siteSurvey.finishPreferences?.splashbackColor ?? '',
      handleStyle: siteSurvey.finishPreferences?.handleStyle ?? '',
      applianceFinish: siteSurvey.finishPreferences?.applianceFinish ?? '',
    },
    visualReferences: {
      sketchProvided: siteSurvey.visualReferences?.sketchProvided ?? false,
      roomPhotosProvided: siteSurvey.visualReferences?.roomPhotosProvided ?? false,
      roomPhotoCount: siteSurvey.visualReferences?.roomPhotoCount ?? 0,
      floorPhotoProvided: siteSurvey.visualReferences?.floorPhotoProvided ?? false,
      ceilingPhotoProvided: siteSurvey.visualReferences?.ceilingPhotoProvided ?? false,
      fullWallSetProvided: siteSurvey.visualReferences?.fullWallSetProvided ?? false,
    },
    workflowChecklist: {
      dimensionsVerified: siteSurvey.workflowChecklist?.dimensionsVerified ?? false,
      heightsVerified: siteSurvey.workflowChecklist?.heightsVerified ?? false,
      openingsVerified: siteSurvey.workflowChecklist?.openingsVerified ?? false,
      technicalVerified: siteSurvey.workflowChecklist?.technicalVerified ?? false,
      clientNeedsVerified: siteSurvey.workflowChecklist?.clientNeedsVerified ?? false,
      finishesVerified: siteSurvey.workflowChecklist?.finishesVerified ?? false,
      photosVerified: siteSurvey.workflowChecklist?.photosVerified ?? false,
    },
    completeness: {
      score: siteSurvey.completeness?.score ?? 0,
      status: normalizedStatus,
    },
    notes: siteSurvey.notes || '',
  }
}

export function normalizePreviewShellMode(mode?: string | null): PreviewShellMode {
  if (mode === '2-walls' || mode === '3-walls' || mode === 'auto') return mode
  return 'auto'
}

export function normalizeAutoCameraPreset(preset?: string | null): AutoCameraPreset {
  if (preset === 'balanced' || preset === 'hero' || preset === 'wide' || preset === 'island') {
    return preset
  }
  return 'balanced'
}

export function normalizeRenderAmbiencePreset(preset?: string | null): RenderAmbiencePreset {
  if (
    preset === 'soft-daylight' ||
    preset === 'warm-showroom' ||
    preset === 'graphite-premium'
  ) {
    return preset
  }
  return 'soft-daylight'
}

export function normalizeRenderQualityPreset(preset?: string | null): RenderQualityPreset {
  if (preset === 'express' || preset === 'refined') return preset
  return 'express'
}

export function normalizeRoomPhotoCategory(category?: string | null): RoomPhotoCategory {
  if (
    category === 'piece' ||
    category === 'mur' ||
    category === 'mur-nord' ||
    category === 'mur-est' ||
    category === 'mur-sud' ||
    category === 'mur-ouest' ||
    category === 'sol' ||
    category === 'plafond' ||
    category === 'detail-technique' ||
    category === 'detail-finition' ||
    category === 'autre'
  ) {
    return category
  }
  return 'piece'
}

function normalizeRoomPhotoReferences(references?: Partial<SceneReferences> | null): RoomPhotoReference[] {
  const seen = new Set<string>()
  const normalized: RoomPhotoReference[] = []

  const rawAssets = Array.isArray(references?.roomPhotoAssets) ? references.roomPhotoAssets : []
  for (const asset of rawAssets) {
    const fileName = typeof asset?.fileName === 'string' ? asset.fileName.trim() : ''
    if (!fileName || seen.has(fileName)) continue
    seen.add(fileName)
    normalized.push({
      fileName,
      category: normalizeRoomPhotoCategory(asset?.category),
    })
  }

  if (normalized.length > 0) return normalized

  const legacyNames = [
    ...(Array.isArray(references?.roomPhotoNames) ? references.roomPhotoNames : []),
    typeof references?.roomPhotoName === 'string' ? references.roomPhotoName : null,
  ]

  for (const rawName of legacyNames) {
    const fileName = typeof rawName === 'string' ? rawName.trim() : ''
    if (!fileName || seen.has(fileName)) continue
    seen.add(fileName)
    normalized.push({
      fileName,
      category: 'piece',
    })
  }

  return normalized
}

export function summarizeRoomPhotoReferences(
  references?: Partial<SceneReferences> | null,
): RoomPhotoCoverage {
  const assets = normalizeRoomPhotoReferences(references)
  const wallCoverage = Array.from(
    new Set(
      assets.flatMap((asset) => {
        if (asset.category === 'mur-nord') return ['north']
        if (asset.category === 'mur-est') return ['east']
        if (asset.category === 'mur-sud') return ['south']
        if (asset.category === 'mur-ouest') return ['west']
        return []
      }),
    ),
  ) as WallId[]

  return {
    count: assets.length,
    wallCoverage,
    missingWalls: WALL_IDS.filter((wall) => !wallCoverage.includes(wall)),
    hasGenericWall: assets.some((asset) => asset.category === 'mur'),
    hasFloor: assets.some((asset) => asset.category === 'sol'),
    hasCeiling: assets.some((asset) => asset.category === 'plafond'),
    technicalDetailCount: assets.filter((asset) => asset.category === 'detail-technique').length,
    finishDetailCount: assets.filter((asset) => asset.category === 'detail-finition').length,
    otherCount: assets.filter((asset) => asset.category === 'autre').length,
  }
}

export function normalizeStudioScene(scene: StudioScene): StudioScene {
  const roomPhotoAssets = normalizeRoomPhotoReferences(scene.references)
  const roomPhotoNames = roomPhotoAssets.map((asset) => asset.fileName)
  const roomPhotoCoverage = summarizeRoomPhotoReferences({
    roomPhotoAssets,
    roomPhotoNames,
    roomPhotoName: roomPhotoNames[0] ?? scene.references?.roomPhotoName ?? null,
  })

  return {
    ...scene,
    previewShellMode: normalizePreviewShellMode(scene.previewShellMode),
    autoCameraPreset: normalizeAutoCameraPreset(scene.autoCameraPreset),
    renderAmbiencePreset: normalizeRenderAmbiencePreset(scene.renderAmbiencePreset),
    renderQualityPreset: normalizeRenderQualityPreset(scene.renderQualityPreset),
    references: {
      sketchName: scene.references?.sketchName ?? null,
      roomPhotoName: roomPhotoNames[0] ?? scene.references?.roomPhotoName ?? null,
      roomPhotoNames,
      roomPhotoAssets,
    },
    siteSurvey: {
      ...scene.siteSurvey,
      visualReferences: {
        ...scene.siteSurvey.visualReferences,
        sketchProvided:
          Boolean(scene.references?.sketchName) ||
          Boolean(scene.siteSurvey.visualReferences?.sketchProvided),
        roomPhotosProvided:
          roomPhotoNames.length > 0 || Boolean(scene.siteSurvey.visualReferences?.roomPhotosProvided),
        roomPhotoCount:
          roomPhotoNames.length > 0
            ? roomPhotoNames.length
            : scene.siteSurvey.visualReferences?.roomPhotoCount ?? 0,
        floorPhotoProvided:
          roomPhotoCoverage.hasFloor ||
          Boolean(scene.siteSurvey.visualReferences?.floorPhotoProvided),
        ceilingPhotoProvided:
          roomPhotoCoverage.hasCeiling ||
          Boolean(scene.siteSurvey.visualReferences?.ceilingPhotoProvided),
        fullWallSetProvided:
          roomPhotoCoverage.wallCoverage.length === 4 ||
          Boolean(scene.siteSurvey.visualReferences?.fullWallSetProvided),
      },
    },
  }
}

function buildSiteSurveyCompleteness(
  checks: boolean[],
  stage: SurveyCompletenessStatus,
): SiteSurveyCompleteness {
  const total = checks.length || 1
  const passed = checks.filter(Boolean).length
  const score = Math.max(0, Math.min(100, Math.round((passed / total) * 100)))
  return { score, status: stage }
}

export function validateSiteSurvey(siteSurvey: SiteSurvey): SiteSurveyValidationResult {
  siteSurvey = normalizeSiteSurvey(siteSurvey)
  const errors: string[] = []
  const warnings: string[] = []
  const checks: boolean[] = []

  const dimensionsValid =
    Number.isFinite(siteSurvey.dimensions.width) &&
    Number.isFinite(siteSurvey.dimensions.depth) &&
    Number.isFinite(siteSurvey.dimensions.height) &&
    siteSurvey.dimensions.width > 0 &&
    siteSurvey.dimensions.depth > 0 &&
    siteSurvey.dimensions.height > 0

  checks.push(dimensionsValid)

  if (!dimensionsValid) {
    errors.push('Les dimensions du releve chantier doivent etre strictement positives.')
  } else {
    if (siteSurvey.dimensions.width < 2 || siteSurvey.dimensions.depth < 2) {
      warnings.push('La piece relevee semble petite pour une implantation cuisine standard.')
    }
    if (siteSurvey.dimensions.height < 2.2) {
      warnings.push('La hauteur relevee semble faible pour une cuisine standard.')
    }
  }

  const usefulHeightsProvided = siteSurvey.usefulHeights.length > 0
  if (!usefulHeightsProvided) {
    warnings.push('Ajoutez au moins une sous-hauteur utile dans le releve chantier.')
  }

  let usefulHeightsValid = usefulHeightsProvided
  for (const usefulHeight of siteSurvey.usefulHeights) {
    if (!Number.isFinite(usefulHeight.height) || usefulHeight.height <= 0) {
      errors.push(`La sous-hauteur "${usefulHeight.label}" doit etre strictement positive.`)
      usefulHeightsValid = false
      continue
    }
    if (dimensionsValid && usefulHeight.height > siteSurvey.dimensions.height) {
      errors.push(`La sous-hauteur "${usefulHeight.label}" depasse la hauteur relevee.`)
      usefulHeightsValid = false
    }
  }
  checks.push(usefulHeightsProvided && usefulHeightsValid)

  const openingsProvided = siteSurvey.openings.length > 0
  if (!openingsProvided) {
    warnings.push('Aucune ouverture renseignee dans le releve chantier.')
  }

  let openingsValid = openingsProvided
  for (const opening of siteSurvey.openings) {
    const wallLength = getRoomWallLength(siteSurvey.dimensions, opening.wall)
    if (
      !Number.isFinite(opening.width) ||
      !Number.isFinite(opening.offset) ||
      opening.width <= 0 ||
      opening.offset < 0 ||
      opening.offset + opening.width > wallLength
    ) {
      errors.push(`L'ouverture relevee "${opening.name}" est incoherente sur le mur ${opening.wall}.`)
      openingsValid = false
    }

    if (
      !Number.isFinite(opening.height) ||
      !Number.isFinite(opening.baseHeight) ||
      opening.height <= 0 ||
      opening.baseHeight < 0 ||
      opening.baseHeight + opening.height > siteSurvey.dimensions.height
    ) {
      errors.push(`L'ouverture relevee "${opening.name}" depasse la hauteur de la piece.`)
      openingsValid = false
    }

    if (opening.kind === 'door' && opening.baseHeight > 0.05) {
      warnings.push(`La porte "${opening.name}" a une allege non standard (${opening.baseHeight} m).`)
    }
  }
  checks.push(openingsProvided && openingsValid)

  const desiredEquipmentProvided = siteSurvey.desiredEquipment.length > 0
  if (!desiredEquipmentProvided) {
    warnings.push('Aucun equipement souhaite n est renseigne dans le releve chantier.')
  }

  let desiredEquipmentValid = desiredEquipmentProvided
  let hasRequiredEquipment = false

  for (const equipment of siteSurvey.desiredEquipment) {
    if (!Number.isInteger(equipment.quantity) || equipment.quantity < 0) {
      errors.push(`La quantite de l equipement "${equipment.type}" doit etre un entier positif.`)
      desiredEquipmentValid = false
      continue
    }
    if (equipment.required && equipment.quantity < 1) {
      errors.push(`L equipement "${equipment.type}" est requis mais sans quantite exploitable.`)
      desiredEquipmentValid = false
    }
    if (equipment.required && equipment.quantity > 0) {
      hasRequiredEquipment = true
    }
  }

  if (!hasRequiredEquipment) {
    warnings.push('Aucun equipement marque comme requis dans le releve chantier.')
  }
  checks.push(desiredEquipmentProvided && desiredEquipmentValid && hasRequiredEquipment)

  const requiredEquipment = new Set(
    siteSurvey.desiredEquipment
      .filter((equipment) => equipment.required && equipment.quantity > 0)
      .map((equipment) => equipment.type),
  )

  let constraintsComplete = true
  if (
    requiredEquipment.has('sink') &&
    (siteSurvey.technicalConstraints.waterSupplyWall === 'unknown' ||
      siteSurvey.technicalConstraints.drainWall === 'unknown')
  ) {
    errors.push('Evier requis: renseigner les murs d alimentation et d evacuation.')
    constraintsComplete = false
  }

  if (
    requiredEquipment.has('hob') &&
    !siteSurvey.technicalConstraints.dedicatedCircuitAvailable &&
    !siteSurvey.technicalConstraints.gasSupplyAvailable
  ) {
    errors.push('Plaque requise: preciser une alimentation electrique dediee ou le gaz.')
    constraintsComplete = false
  }

  if (requiredEquipment.has('hood') && siteSurvey.technicalConstraints.hoodMode === 'unknown') {
    warnings.push('Hotte requise: renseigner si evacuation ou recyclage.')
    constraintsComplete = false
  }
  checks.push(constraintsComplete)

  const finishPreferences = siteSurvey.finishPreferences
  const finishPreferencesValid =
    hasText(finishPreferences.frontsColor) &&
    hasText(finishPreferences.worktopColor) &&
    hasText(finishPreferences.handleStyle)

  if (!hasText(finishPreferences.frontsColor)) {
    warnings.push('Renseignez une couleur ou finition générique pour les façades.')
  }
  if (!hasText(finishPreferences.worktopColor)) {
    warnings.push('Renseignez une couleur ou finition générique pour le plan de travail.')
  }
  if (!hasText(finishPreferences.handleStyle)) {
    warnings.push('Renseignez un style de poignée ou indiquez "sans poignée".')
  }
  checks.push(finishPreferencesValid)

  const visualReferences = siteSurvey.visualReferences
  let visualReferencesValid =
    visualReferences.sketchProvided || visualReferences.roomPhotosProvided

  if (!Number.isInteger(visualReferences.roomPhotoCount) || visualReferences.roomPhotoCount < 0) {
    errors.push('Le nombre de photos de pièce doit être un entier positif ou nul.')
    visualReferencesValid = false
  }

  if (!visualReferences.sketchProvided) {
    warnings.push('Le croquis ou plan de référence manque dans le relevé chantier.')
  }

  if (!visualReferences.roomPhotosProvided) {
    warnings.push('Ajoutez des photos de la pièce pour préparer le futur matching visuel.')
    visualReferencesValid = false
  } else {
    if (visualReferences.roomPhotoCount < 2) {
      warnings.push('Prévoyez au moins 2 photos de pièce pour couvrir l’environnement.')
      visualReferencesValid = false
    }
    if (!visualReferences.floorPhotoProvided) {
      warnings.push('Ajoutez au moins une photo montrant bien le sol.')
      visualReferencesValid = false
    }
    if (!visualReferences.ceilingPhotoProvided) {
      warnings.push('Ajoutez au moins une photo montrant bien le plafond et les hauteurs.')
      visualReferencesValid = false
    }
    if (!visualReferences.fullWallSetProvided) {
      warnings.push('Toutes les faces de mur ne semblent pas couvertes par les photos.')
      visualReferencesValid = false
    }
  }
  checks.push(visualReferencesValid)

  const workflowChecklist = siteSurvey.workflowChecklist
  const workflowChecklistValid =
    workflowChecklist.dimensionsVerified &&
    workflowChecklist.heightsVerified &&
    workflowChecklist.openingsVerified &&
    workflowChecklist.technicalVerified &&
    workflowChecklist.clientNeedsVerified &&
    workflowChecklist.finishesVerified &&
    workflowChecklist.photosVerified

  if (!workflowChecklistValid) {
    warnings.push('La checklist opérateur de fin de relevé n est pas complètement validée.')
  }
  checks.push(workflowChecklistValid)

  const geometryReady = dimensionsValid && usefulHeightsProvided && usefulHeightsValid
  const openingsReady = openingsProvided && openingsValid
  const equipmentReady = desiredEquipmentProvided && desiredEquipmentValid && hasRequiredEquipment
  const technicalReady = constraintsComplete
  const finishesReady = finishPreferencesValid
  const visualReady = visualReferencesValid
  const checklistReady = workflowChecklistValid

  const blockers: string[] = []
  const verificationPoints: string[] = []
  let stage: SurveyCompletenessStatus = 'pret'

  if (errors.length > 0 || !geometryReady) {
    stage = 'bloquant'
    if (!dimensionsValid) blockers.push('Mesurer largeur, profondeur et hauteur de la piece.')
    if (!usefulHeightsProvided || !usefulHeightsValid) {
      blockers.push('Completer les sous-hauteurs utiles pour verrouiller la geometrie.')
    }
    if (errors.length > 0) blockers.push('Corriger les incoherences de mesures signalees plus bas.')
  } else if (!openingsReady || !equipmentReady || !technicalReady) {
    stage = 'a_verifier'
    if (!openingsReady) {
      verificationPoints.push('Completer les portes et fenetres avec mur, offset, largeur, hauteur et allege.')
    }
    if (!equipmentReady) {
      verificationPoints.push('Renseigner les equipements vraiment requis par le client avec une quantite exploitable.')
    }
    if (!technicalReady) {
      verificationPoints.push('Verifier les contraintes techniques qui conditionnent l implantation.')
    }
  } else if (!finishesReady || !visualReady || !checklistReady) {
    stage = 'suffisant'
    if (!finishesReady) {
      verificationPoints.push('Ajouter les finitions generiques pour rendre le projet lisible au client.')
    }
    if (!visualReady) {
      verificationPoints.push('Completer croquis et photos pour fiabiliser la lecture visuelle de la piece.')
    }
    if (!checklistReady) {
      verificationPoints.push('Terminer la checklist operateur avant de lancer un rendu Blender.')
    }
  }

  const workflow: SiteSurveyWorkflowState = {
    stage,
    previewReady: stage === 'suffisant' || stage === 'pret',
    renderReady: stage === 'pret',
    blockers,
    verificationPoints,
    nextAction:
      stage === 'bloquant'
        ? 'Corriger les mesures de base avant de poursuivre.'
        : stage === 'a_verifier'
          ? 'Verifier les ouvertures, les equipements et les contraintes avant de fiabiliser le projet.'
          : stage === 'suffisant'
            ? 'Le projet peut etre previsualise. Completer les finitions, les photos et la checklist avant rendu.'
            : 'Le releve est pret pour un rendu interne Blender.',
  }

  const completeness = buildSiteSurveyCompleteness(checks, stage)

  if (
    siteSurvey.completeness.score !== completeness.score ||
    siteSurvey.completeness.status !== completeness.status
  ) {
    warnings.push('Le score de completude du releve chantier n est pas a jour.')
  }

  return { errors, warnings, completeness, workflow }
}

export function validateStudioScene(scene: StudioScene): string[] {
  const warnings: string[] = []

  if (!scene.name.trim()) warnings.push('Le projet doit avoir un nom.')
  if (scene.room.width < 2 || scene.room.depth < 2) {
    warnings.push('La piece est trop petite pour une implantation cuisine realiste.')
  }
  if (scene.room.height < 2.2) {
    warnings.push('La hauteur sous plafond semble faible pour une cuisine standard.')
  }

  if (!scene.siteSurvey) {
    warnings.push('[Releve chantier] Bloc releve chantier manquant dans la scene.')
  } else {
    const siteSurveyValidation = validateSiteSurvey(scene.siteSurvey)
    warnings.push(
      ...siteSurveyValidation.errors.map((error) => `[Releve chantier] ${error}`),
      ...siteSurveyValidation.warnings.map((warning) => `[Releve chantier] ${warning}`),
    )

    if (
      !approximatelyEqual(scene.room.width, scene.siteSurvey.dimensions.width) ||
      !approximatelyEqual(scene.room.depth, scene.siteSurvey.dimensions.depth) ||
      !approximatelyEqual(scene.room.height, scene.siteSurvey.dimensions.height)
    ) {
      warnings.push('[Releve chantier] Les dimensions de la scene canonique divergent du releve.')
    }

    if (scene.openings.length !== scene.siteSurvey.openings.length) {
      warnings.push('[Releve chantier] Le nombre d ouvertures diverge entre releve et scene canonique.')
    }

    const openingsById = new Map(scene.siteSurvey.openings.map((opening) => [opening.id, opening]))
    for (const opening of scene.openings) {
      const measured = openingsById.get(opening.id)
      if (!measured) {
        warnings.push(`[Releve chantier] L'ouverture "${opening.name}" manque dans le releve.`)
        continue
      }

      if (
        measured.wall !== opening.wall ||
        !approximatelyEqual(measured.offset, opening.offset, 0.03) ||
        !approximatelyEqual(measured.width, opening.width, 0.03) ||
        !approximatelyEqual(measured.height, opening.height, 0.03) ||
        !approximatelyEqual(measured.baseHeight, opening.baseHeight, 0.03)
      ) {
        warnings.push(`[Releve chantier] L'ouverture "${opening.name}" diverge du releve mesure.`)
      }
    }

    if (siteSurveyValidation.workflow.stage !== 'pret') {
      warnings.push(
        `[Releve chantier] Completude ${siteSurveyValidation.completeness.score}% (${siteSurveyValidation.workflow.stage}).`,
      )
    }
  }

  for (const opening of scene.openings) {
    const wallLength = getRoomWallLength(scene.room, opening.wall)

    if (opening.offset < 0 || opening.offset + opening.width > wallLength) {
      warnings.push(`L'ouverture "${opening.name}" depasse le mur ${opening.wall}.`)
    }

    if (opening.baseHeight + opening.height > scene.room.height) {
      warnings.push(`L'ouverture "${opening.name}" depasse la hauteur de la piece.`)
    }
  }

  for (const moduleSpec of scene.modules) {
    if (moduleSpec.placement.mode === 'wall') {
      const wallLength = getRoomWallLength(scene.room, moduleSpec.placement.wall)
      if (
        moduleSpec.placement.offset < 0 ||
        moduleSpec.placement.offset + moduleSpec.width > wallLength
      ) {
        warnings.push(
          `Le module "${moduleSpec.label}" depasse le mur ${moduleSpec.placement.wall}.`,
        )
      }
    } else {
      if (Math.abs(moduleSpec.placement.x) + moduleSpec.width / 2 > scene.room.width / 2) {
        warnings.push(`Le module "${moduleSpec.label}" sort de la piece en X.`)
      }
      if (Math.abs(moduleSpec.placement.z) + moduleSpec.depth / 2 > scene.room.depth / 2) {
        warnings.push(`Le module "${moduleSpec.label}" sort de la piece en Z.`)
      }
    }
  }

  return warnings
}
