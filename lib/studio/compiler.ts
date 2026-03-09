import { getMaterialPreset } from './catalog.ts'
import { getAutoCamera } from './render-presets.ts'
import type {
  CompiledCamera,
  CompiledLabel,
  CompiledMesh,
  CompiledScene,
  KitchenModuleSpec,
  OpeningSpec,
  PreviewShellMode,
  StudioScene,
  Vector3,
  WallId,
} from './schema.ts'
import { validateStudioScene } from './schema.ts'

const WALL_COLOR = '#ece7df'
const OPENING_COLOR = '#6db6d9'
const CEILING_COLOR = '#f6f3ed'
const WALL_ORDER: WallId[] = ['north', 'east', 'south', 'west']
const TWO_WALL_CANDIDATES: WallId[][] = [
  ['north', 'west'],
  ['north', 'east'],
  ['south', 'west'],
  ['south', 'east'],
]
const THREE_WALL_CANDIDATES: WallId[][] = [
  ['north', 'east', 'west'],
  ['north', 'south', 'west'],
  ['north', 'east', 'south'],
  ['east', 'south', 'west'],
]

export function compileStudioScene(scene: StudioScene): CompiledScene {
  const warnings = validateStudioScene(scene)
  const meshes: CompiledMesh[] = []
  const labels: CompiledLabel[] = []

  meshes.push(
    {
      id: 'floor',
      kind: 'floor',
      position: { x: 0, y: -0.025, z: 0 },
      size: { x: scene.room.width, y: 0.05, z: scene.room.depth },
      rotationY: 0,
      color: getMaterialColor(scene.materials.floor, '#ccb184'),
    },
    {
      id: 'ceiling',
      kind: 'ceiling',
      position: { x: 0, y: scene.room.height + 0.02, z: 0 },
      size: { x: scene.room.width, y: 0.04, z: scene.room.depth },
      rotationY: 0,
      color: CEILING_COLOR,
    },
  )

  meshes.push(...buildWallMeshes(scene))
  meshes.push(...buildModuleMeshes(scene))
  meshes.push(...buildWorktopMeshes(scene))
  labels.push(...buildLabels(scene))

  return {
    sceneId: scene.id,
    bounds: {
      width: scene.room.width,
      depth: scene.room.depth,
      height: scene.room.height,
    },
    meshes,
    labels,
    camera: getSceneCamera(scene),
    warnings,
  }
}

export function getSceneCamera(
  scene: Pick<StudioScene, 'room' | 'cameraMatch'> & { autoCameraPreset?: StudioScene['autoCameraPreset'] },
): CompiledCamera {
  if (scene.cameraMatch.enabled) {
    return {
      position: scene.cameraMatch.position,
      target: scene.cameraMatch.target,
      fov: scene.cameraMatch.fov,
    }
  }

  return getAutoCamera(scene.room, scene.autoCameraPreset ?? 'balanced')
}

export function getPreviewVisibleWalls(
  scene: Pick<StudioScene, 'modules' | 'openings' | 'previewShellMode'>,
): WallId[] {
  const moduleWalls = Array.from(
    new Set(
      scene.modules.flatMap((moduleSpec) =>
        moduleSpec.placement.mode === 'wall' ? [moduleSpec.placement.wall] : [],
      ),
    ),
  ).sort((left, right) => WALL_ORDER.indexOf(left) - WALL_ORDER.indexOf(right))

  const openingWalls = Array.from(new Set(scene.openings.map((opening) => opening.wall))).sort(
    (left, right) => WALL_ORDER.indexOf(left) - WALL_ORDER.indexOf(right),
  )

  const mode = scene.previewShellMode
  const targetWallCount = getPreviewTargetWallCount(mode, moduleWalls.length)
  const candidates = targetWallCount === 3 ? THREE_WALL_CANDIDATES : TWO_WALL_CANDIDATES
  const weights = new Map<WallId, number>(WALL_ORDER.map((wall) => [wall, 0]))

  for (const wall of moduleWalls) {
    weights.set(wall, (weights.get(wall) || 0) + 5)
  }

  if (moduleWalls.length === 0) {
    for (const wall of openingWalls) {
      weights.set(wall, (weights.get(wall) || 0) + 2)
    }
  }

  const bestCandidate = candidates.reduce(
    (best, candidate, index) => {
      const score = candidate.reduce((total, wall) => total + (weights.get(wall) || 0), 0)
      if (!best || score > best.score) {
        return { candidate, score, index }
      }
      return best
    },
    null as { candidate: WallId[]; score: number; index: number } | null,
  )

  if (!bestCandidate) {
    return targetWallCount === 3 ? THREE_WALL_CANDIDATES[0] : TWO_WALL_CANDIDATES[0]
  }

  if (bestCandidate.score === 0) {
    return bestCandidate.candidate
  }

  return bestCandidate.candidate
}

function getPreviewTargetWallCount(mode: PreviewShellMode, moduleWallCount: number): 2 | 3 {
  if (mode === '2-walls') return 2
  if (mode === '3-walls') return 3
  return moduleWallCount >= 3 ? 3 : 2
}

function buildWallMeshes(scene: StudioScene): CompiledMesh[] {
  const meshes: CompiledMesh[] = []

  for (const wall of ['north', 'east', 'south', 'west'] as WallId[]) {
    const openings = scene.openings.filter((opening) => opening.wall === wall)
    const wallLength = wall === 'north' || wall === 'south' ? scene.room.width : scene.room.depth
    const wallThickness = scene.room.wallThickness
    const isHorizontal = wall === 'north' || wall === 'south'
    const baseCenter = getWallCenter(scene, wall)

    if (openings.length === 0) {
      meshes.push({
        id: `wall-${wall}`,
        kind: 'wall',
        position: { x: baseCenter.x, y: scene.room.height / 2, z: baseCenter.z },
        size: isHorizontal
          ? { x: wallLength, y: scene.room.height, z: wallThickness }
          : { x: wallThickness, y: scene.room.height, z: wallLength },
        rotationY: 0,
        color: WALL_COLOR,
      })
      continue
    }

    const sorted = [...openings].sort((left, right) => left.offset - right.offset)
    let cursor = 0

    for (const opening of sorted) {
      const before = opening.offset - cursor
      if (before > 0.02) {
        meshes.push(
          createWallStripMesh({
            id: `wall-${wall}-axis-${opening.id}-before`,
            wall,
            room: scene.room,
            start: cursor,
            length: before,
            bottom: 0,
            top: scene.room.height,
          }),
        )
      }

      if (opening.baseHeight > 0.02) {
        meshes.push(
          createWallStripMesh({
            id: `wall-${wall}-sill-${opening.id}`,
            wall,
            room: scene.room,
            start: opening.offset,
            length: opening.width,
            bottom: 0,
            top: opening.baseHeight,
          }),
        )
      }

      const headerBottom = opening.baseHeight + opening.height
      if (headerBottom < scene.room.height - 0.02) {
        meshes.push(
          createWallStripMesh({
            id: `wall-${wall}-header-${opening.id}`,
            wall,
            room: scene.room,
            start: opening.offset,
            length: opening.width,
            bottom: headerBottom,
            top: scene.room.height,
          }),
        )
      }

      meshes.push(createOpeningGuideMesh(scene, opening))
      cursor = opening.offset + opening.width
    }

    const remaining = wallLength - cursor
    if (remaining > 0.02) {
      meshes.push(
        createWallStripMesh({
          id: `wall-${wall}-tail`,
          wall,
          room: scene.room,
          start: cursor,
          length: remaining,
          bottom: 0,
          top: scene.room.height,
        }),
      )
    }
  }

  return meshes
}

function createWallStripMesh({
  id,
  wall,
  room,
  start,
  length,
  bottom,
  top,
}: {
  id: string
  wall: WallId
  room: StudioScene['room']
  start: number
  length: number
  bottom: number
  top: number
}): CompiledMesh {
  const isHorizontal = wall === 'north' || wall === 'south'
  const height = top - bottom
  const center = getWallStripCenter(room, wall, start, length, bottom, top)
  return {
    id,
    kind: 'wall',
    position: center,
    size: isHorizontal
      ? { x: length, y: height, z: room.wallThickness }
      : { x: room.wallThickness, y: height, z: length },
    rotationY: 0,
    color: WALL_COLOR,
  }
}

function createOpeningGuideMesh(scene: StudioScene, opening: OpeningSpec): CompiledMesh {
  const isHorizontal = opening.wall === 'north' || opening.wall === 'south'
  const center = getWallStripCenter(
    scene.room,
    opening.wall,
    opening.offset,
    opening.width,
    opening.baseHeight,
    opening.baseHeight + opening.height,
  )

  return {
    id: `opening-${opening.id}`,
    kind: 'opening',
    position: center,
    size: isHorizontal
      ? { x: opening.width, y: opening.height, z: scene.room.wallThickness * 1.15 }
      : { x: scene.room.wallThickness * 1.15, y: opening.height, z: opening.width },
    rotationY: 0,
    color: OPENING_COLOR,
    opacity: 0.35,
  }
}

function buildModuleMeshes(scene: StudioScene): CompiledMesh[] {
  return scene.modules.map((moduleSpec) => {
    const transform = getModuleTransform(scene, moduleSpec)
    return {
      id: moduleSpec.id,
      kind: 'module',
      position: transform.position,
      size: { x: moduleSpec.width, y: moduleSpec.height, z: moduleSpec.depth },
      rotationY: transform.rotationY,
      color: getMaterialColor(moduleSpec.frontsMaterialId || scene.materials.fronts, '#f4f2ee'),
    }
  })
}

function buildWorktopMeshes(scene: StudioScene): CompiledMesh[] {
  return scene.modules
    .filter((moduleSpec) => moduleSpec.kind === 'base' || moduleSpec.kind === 'island')
    .map((moduleSpec) => {
      const transform = getModuleTransform(scene, moduleSpec)
      return {
        id: `${moduleSpec.id}-worktop`,
        kind: 'worktop',
        position: {
          x: transform.position.x,
          y: moduleSpec.elevation + moduleSpec.height + 0.02,
          z: transform.position.z,
        },
        size: {
          x: moduleSpec.width + (moduleSpec.kind === 'island' ? 0.1 : 0),
          y: 0.04,
          z: moduleSpec.depth + (moduleSpec.kind === 'island' ? 0.1 : 0.03),
        },
        rotationY: transform.rotationY,
        color: getMaterialColor(scene.materials.worktop, '#d8d1c6'),
      }
    })
}

function buildLabels(scene: StudioScene): CompiledLabel[] {
  const moduleLabels = scene.modules.map((moduleSpec) => {
    const transform = getModuleTransform(scene, moduleSpec)
    return {
      id: `label-${moduleSpec.id}`,
      text: moduleSpec.label,
      position: {
        x: transform.position.x,
        y: moduleSpec.elevation + moduleSpec.height + 0.18,
        z: transform.position.z,
      },
    }
  })

  return [
    {
      id: 'room-size',
      text: `${scene.room.width.toFixed(2)} m x ${scene.room.depth.toFixed(2)} m`,
      position: { x: 0, y: scene.room.height + 0.45, z: 0 },
    },
    ...moduleLabels,
  ]
}

function getModuleTransform(
  scene: StudioScene,
  moduleSpec: KitchenModuleSpec,
): { position: Vector3; rotationY: number } {
  if (moduleSpec.placement.mode === 'free') {
    return {
      position: {
        x: moduleSpec.placement.x,
        y: moduleSpec.elevation + moduleSpec.height / 2,
        z: moduleSpec.placement.z,
      },
      rotationY: moduleSpec.placement.rotation,
    }
  }

  const halfWidth = scene.room.width / 2
  const halfDepth = scene.room.depth / 2
  const halfModuleDepth = moduleSpec.depth / 2
  const baseY = moduleSpec.elevation + moduleSpec.height / 2

  switch (moduleSpec.placement.wall) {
    case 'north':
      return {
        position: {
          x: -halfWidth + moduleSpec.placement.offset + moduleSpec.width / 2,
          y: baseY,
          z: -halfDepth + halfModuleDepth,
        },
        rotationY: 0,
      }
    case 'south':
      return {
        position: {
          x: -halfWidth + moduleSpec.placement.offset + moduleSpec.width / 2,
          y: baseY,
          z: halfDepth - halfModuleDepth,
        },
        rotationY: Math.PI,
      }
    case 'west':
      return {
        position: {
          x: -halfWidth + halfModuleDepth,
          y: baseY,
          z: -halfDepth + moduleSpec.placement.offset + moduleSpec.width / 2,
        },
        rotationY: Math.PI / 2,
      }
    case 'east':
      return {
        position: {
          x: halfWidth - halfModuleDepth,
          y: baseY,
          z: -halfDepth + moduleSpec.placement.offset + moduleSpec.width / 2,
        },
        rotationY: -Math.PI / 2,
      }
  }
}

function getWallCenter(scene: StudioScene, wall: WallId): Vector3 {
  const halfWidth = scene.room.width / 2
  const halfDepth = scene.room.depth / 2
  const halfThickness = scene.room.wallThickness / 2

  switch (wall) {
    case 'north':
      return { x: 0, y: scene.room.height / 2, z: -halfDepth - halfThickness }
    case 'south':
      return { x: 0, y: scene.room.height / 2, z: halfDepth + halfThickness }
    case 'west':
      return { x: -halfWidth - halfThickness, y: scene.room.height / 2, z: 0 }
    case 'east':
      return { x: halfWidth + halfThickness, y: scene.room.height / 2, z: 0 }
  }
}

function getWallStripCenter(
  room: StudioScene['room'],
  wall: WallId,
  start: number,
  length: number,
  bottom: number,
  top: number,
): Vector3 {
  const halfWidth = room.width / 2
  const halfDepth = room.depth / 2
  const halfThickness = room.wallThickness / 2
  const centerAxis = start + length / 2
  const centerY = bottom + (top - bottom) / 2

  switch (wall) {
    case 'north':
      return { x: -halfWidth + centerAxis, y: centerY, z: -halfDepth - halfThickness }
    case 'south':
      return { x: -halfWidth + centerAxis, y: centerY, z: halfDepth + halfThickness }
    case 'west':
      return { x: -halfWidth - halfThickness, y: centerY, z: -halfDepth + centerAxis }
    case 'east':
      return { x: halfWidth + halfThickness, y: centerY, z: -halfDepth + centerAxis }
  }
}

function getMaterialColor(materialId: string, fallback: string): string {
  return getMaterialPreset(materialId)?.previewColor || fallback
}
