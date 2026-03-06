export const WALL_IDS = ['north', 'east', 'south', 'west'] as const
export const OPENING_KINDS = ['door', 'window'] as const
export const MODULE_KINDS = ['base', 'tall', 'wall', 'island'] as const
export const REVISION_SOURCES = ['seed', 'manual', 'autosave', 'import'] as const

export type WallId = (typeof WALL_IDS)[number]
export type OpeningKind = (typeof OPENING_KINDS)[number]
export type ModuleKind = (typeof MODULE_KINDS)[number]
export type RevisionSource = (typeof REVISION_SOURCES)[number]

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

export interface SceneReferences {
  sketchName: string | null
  roomPhotoName: string | null
}

export interface CameraMatchSpec {
  enabled: boolean
  fov: number
  position: Vector3
  target: Vector3
  lensShiftX: number
  lensShiftY: number
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
    output: { width: number; height: number; format: 'PNG'; samples: number }
    colorManagement: 'Filmic'
  }
}

export function clampSceneNumber(value: number, minimum: number, fallback: number): number {
  if (!Number.isFinite(value) || value < minimum) return fallback
  return value
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

  for (const opening of scene.openings) {
    const wallLength = opening.wall === 'north' || opening.wall === 'south'
      ? scene.room.width
      : scene.room.depth

    if (opening.offset < 0 || opening.offset + opening.width > wallLength) {
      warnings.push(`L'ouverture "${opening.name}" depasse le mur ${opening.wall}.`)
    }

    if (opening.baseHeight + opening.height > scene.room.height) {
      warnings.push(`L'ouverture "${opening.name}" depasse la hauteur de la piece.`)
    }
  }

  for (const moduleSpec of scene.modules) {
    if (moduleSpec.placement.mode === 'wall') {
      const wallLength =
        moduleSpec.placement.wall === 'north' || moduleSpec.placement.wall === 'south'
          ? scene.room.width
          : scene.room.depth
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
