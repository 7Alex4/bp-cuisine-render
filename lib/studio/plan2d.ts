import type { KitchenModuleSpec, ModulePlacement, OpeningSpec, StudioScene, WallId } from './schema.ts'

export const PLAN_VIEWBOX_WIDTH = 860
export const PLAN_VIEWBOX_HEIGHT = 620
export const PLAN_PADDING = 70
export const MODULE_JOINT_GAP = 0.02

export interface PlanLayout {
  scale: number
  roomWidthPx: number
  roomDepthPx: number
  roomX: number
  roomY: number
}

export interface RoomPoint2D {
  x: number
  z: number
}

export interface ModulePlanRect {
  x: number
  y: number
  width: number
  height: number
  rotate: number
}

export type PlanSnapReason = 'free' | 'module' | 'opening' | 'boundary' | 'collision'

export interface PlanDragResolution {
  placement: ModulePlacement
  wall: WallId | null
  snapReason: PlanSnapReason
}

export interface ModuleFootprintBounds {
  centerX: number
  centerZ: number
  halfX: number
  halfZ: number
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface OpeningDragResolution {
  wall: WallId
  offset: number
}

export function buildDuplicatedModule(
  scene: Pick<StudioScene, 'room' | 'modules' | 'openings'>,
  moduleSpec: KitchenModuleSpec,
): KitchenModuleSpec {
  const baseLabel = moduleSpec.label.includes(' copie')
    ? moduleSpec.label
    : `${moduleSpec.label} copie`

  if (moduleSpec.placement.mode === 'wall') {
    const targetCenter = getPlacementCenter(scene, moduleSpec, {
      mode: 'wall',
      wall: moduleSpec.placement.wall,
      offset: moduleSpec.placement.offset + moduleSpec.width + 0.1,
    })
    const resolution = resolveDraggedPlacement(scene, moduleSpec, targetCenter)

    return {
      ...moduleSpec,
      id: crypto.randomUUID(),
      label: baseLabel,
      placement: resolution.placement,
    }
  }

  const duplicatedFreePlacement = {
    ...moduleSpec.placement,
    x: moduleSpec.placement.x + 0.35,
    z: moduleSpec.placement.z + 0.35,
  }
  const targetCenter = getPlacementCenter(scene, moduleSpec, duplicatedFreePlacement)
  const resolution = resolveDraggedPlacement(
    scene,
    { ...moduleSpec, placement: duplicatedFreePlacement },
    targetCenter,
  )

  return {
    ...moduleSpec,
    id: crypto.randomUUID(),
    label: baseLabel,
    placement: resolution.placement,
  }
}

export function getPlanLayout(scene: Pick<StudioScene, 'room'>): PlanLayout {
  const scale = Math.min(
    (PLAN_VIEWBOX_WIDTH - PLAN_PADDING * 2) / scene.room.width,
    (PLAN_VIEWBOX_HEIGHT - PLAN_PADDING * 2) / scene.room.depth,
  )

  const roomWidthPx = scene.room.width * scale
  const roomDepthPx = scene.room.depth * scale

  return {
    scale,
    roomWidthPx,
    roomDepthPx,
    roomX: (PLAN_VIEWBOX_WIDTH - roomWidthPx) / 2,
    roomY: (PLAN_VIEWBOX_HEIGHT - roomDepthPx) / 2,
  }
}

export function getModulePlanRect(
  moduleSpec: KitchenModuleSpec,
  scene: Pick<StudioScene, 'room'>,
  layout: PlanLayout,
): ModulePlanRect {
  if (moduleSpec.placement.mode === 'free') {
    return {
      x: layout.roomX + scene.room.width * layout.scale / 2 + (moduleSpec.placement.x - moduleSpec.width / 2) * layout.scale,
      y: layout.roomY + scene.room.depth * layout.scale / 2 + (moduleSpec.placement.z - moduleSpec.depth / 2) * layout.scale,
      width: moduleSpec.width * layout.scale,
      height: moduleSpec.depth * layout.scale,
      rotate: (moduleSpec.placement.rotation * 180) / Math.PI,
    }
  }

  if (moduleSpec.placement.wall === 'north') {
    return {
      x: layout.roomX + moduleSpec.placement.offset * layout.scale,
      y: layout.roomY,
      width: moduleSpec.width * layout.scale,
      height: moduleSpec.depth * layout.scale,
      rotate: 0,
    }
  }

  if (moduleSpec.placement.wall === 'south') {
    return {
      x: layout.roomX + moduleSpec.placement.offset * layout.scale,
      y: layout.roomY + scene.room.depth * layout.scale - moduleSpec.depth * layout.scale,
      width: moduleSpec.width * layout.scale,
      height: moduleSpec.depth * layout.scale,
      rotate: 0,
    }
  }

  if (moduleSpec.placement.wall === 'west') {
    return {
      x: layout.roomX,
      y: layout.roomY + moduleSpec.placement.offset * layout.scale,
      width: moduleSpec.depth * layout.scale,
      height: moduleSpec.width * layout.scale,
      rotate: 0,
    }
  }

  return {
    x: layout.roomX + scene.room.width * layout.scale - moduleSpec.depth * layout.scale,
    y: layout.roomY + moduleSpec.placement.offset * layout.scale,
    width: moduleSpec.depth * layout.scale,
    height: moduleSpec.width * layout.scale,
    rotate: 0,
  }
}

export function getModulePlanCenter(
  moduleSpec: KitchenModuleSpec,
  scene: Pick<StudioScene, 'room'>,
): RoomPoint2D {
  return getPlacementCenter(scene, moduleSpec, moduleSpec.placement)
}

export function getOpeningPlanCenter(
  opening: OpeningSpec,
  scene: Pick<StudioScene, 'room'>,
): RoomPoint2D {
  const centerOffset = opening.offset + opening.width / 2

  if (opening.wall === 'north') {
    return { x: centerOffset, z: 0 }
  }

  if (opening.wall === 'south') {
    return { x: centerOffset, z: scene.room.depth }
  }

  if (opening.wall === 'west') {
    return { x: 0, z: centerOffset }
  }

  return { x: scene.room.width, z: centerOffset }
}

export function getPlacementCenter(
  scene: Pick<StudioScene, 'room'>,
  moduleSpec: KitchenModuleSpec,
  placement: ModulePlacement,
): RoomPoint2D {
  if (placement.mode === 'free') {
    return {
      x: scene.room.width / 2 + placement.x,
      z: scene.room.depth / 2 + placement.z,
    }
  }

  if (placement.wall === 'north') {
    return { x: placement.offset + moduleSpec.width / 2, z: moduleSpec.depth / 2 }
  }

  if (placement.wall === 'south') {
    return {
      x: placement.offset + moduleSpec.width / 2,
      z: scene.room.depth - moduleSpec.depth / 2,
    }
  }

  if (placement.wall === 'west') {
    return { x: moduleSpec.depth / 2, z: placement.offset + moduleSpec.width / 2 }
  }

  return {
    x: scene.room.width - moduleSpec.depth / 2,
    z: placement.offset + moduleSpec.width / 2,
  }
}

export function getModuleFootprintBounds(
  scene: Pick<StudioScene, 'room'>,
  moduleSpec: KitchenModuleSpec,
  placement: ModulePlacement = moduleSpec.placement,
): ModuleFootprintBounds {
  const center = getPlacementCenter(scene, moduleSpec, placement)
  const rotation = placement.mode === 'free' ? placement.rotation : 0
  const { halfX, halfZ } = getRotatedHalfExtents(moduleSpec.width, moduleSpec.depth, rotation)

  return {
    centerX: center.x,
    centerZ: center.z,
    halfX,
    halfZ,
    minX: center.x - halfX,
    maxX: center.x + halfX,
    minZ: center.z - halfZ,
    maxZ: center.z + halfZ,
  }
}

export function clampRoomPoint(
  scene: Pick<StudioScene, 'room'>,
  point: RoomPoint2D,
): RoomPoint2D {
  return {
    x: Math.max(0, Math.min(scene.room.width, point.x)),
    z: Math.max(0, Math.min(scene.room.depth, point.z)),
  }
}

export function getRoomPointFromSvg(
  scene: Pick<StudioScene, 'room'>,
  svgPoint: RoomPoint2D,
): RoomPoint2D {
  const layout = getPlanLayout(scene)
  return clampRoomPoint(scene, {
    x: (svgPoint.x - layout.roomX) / layout.scale,
    z: (svgPoint.z - layout.roomY) / layout.scale,
  })
}

export function deriveDraggedPlacement(
  scene: Pick<StudioScene, 'room' | 'modules' | 'openings'>,
  moduleSpec: KitchenModuleSpec,
  targetCenter: RoomPoint2D,
): ModulePlacement {
  return resolveDraggedPlacement(scene, moduleSpec, targetCenter).placement
}

export function resolveDraggedPlacement(
  scene: Pick<StudioScene, 'room' | 'modules' | 'openings'>,
  moduleSpec: KitchenModuleSpec,
  targetCenter: RoomPoint2D,
): PlanDragResolution {
  const clampedCenter = clampRoomPoint(scene, targetCenter)

  if (moduleSpec.kind === 'island' || moduleSpec.placement.mode === 'free') {
    return resolveFreePlacement(scene, moduleSpec, clampedCenter)
  }

  const sortedWalls = getWallsByDistance(scene, clampedCenter)

  for (const wall of sortedWalls) {
    const resolved = resolveWallPlacement(scene, moduleSpec, wall, clampedCenter)
    if (resolved) {
      return {
        placement: resolved,
        wall,
        snapReason: resolved.offset === getDesiredWallOffset(wall, moduleSpec, clampedCenter)
          ? 'free'
          : resolved.snapReason,
      }
    }
  }

  const fallbackWall = sortedWalls[0] || 'north'
  return {
    placement: {
      mode: 'wall',
      wall: fallbackWall,
      offset: clampOffset(
        getDesiredWallOffset(fallbackWall, moduleSpec, clampedCenter),
        getWallLength(scene, fallbackWall),
        moduleSpec.width,
      ),
    },
    wall: fallbackWall,
    snapReason: 'boundary',
  }
}

export function resolveDraggedOpening(
  scene: Pick<StudioScene, 'room' | 'openings'>,
  opening: OpeningSpec,
  targetCenter: RoomPoint2D,
): OpeningDragResolution {
  const clampedCenter = clampRoomPoint(scene, targetCenter)
  const sortedWalls = getWallsByDistance(scene, clampedCenter)

  for (const wall of sortedWalls) {
    const wallLength = getWallLength(scene, wall)
    const desiredOffset = clampOffset(
      getDesiredOpeningWallOffset(wall, opening, clampedCenter),
      wallLength,
      opening.width,
    )
    const ranges = getAllowedOpeningOffsetRanges(scene, opening, wall)

    if (ranges.length === 0) continue

    const bestRange = ranges.reduce((best, range) => {
      const distance =
        desiredOffset < range.start
          ? range.start - desiredOffset
          : desiredOffset > range.end
            ? desiredOffset - range.end
            : 0

      if (!best || distance < best.distance) {
        return { range, distance }
      }

      return best
    }, null as { range: AllowedOffsetRange; distance: number } | null)?.range

    if (!bestRange) continue

    return {
      wall,
      offset: Math.max(bestRange.start, Math.min(bestRange.end, desiredOffset)),
    }
  }

  return {
    wall: sortedWalls[0] || opening.wall,
    offset: clampOffset(
      getDesiredOpeningWallOffset(sortedWalls[0] || opening.wall, opening, clampedCenter),
      getWallLength(scene, sortedWalls[0] || opening.wall),
      opening.width,
    ),
  }
}

function getWallsByDistance(
  scene: Pick<StudioScene, 'room'>,
  point: RoomPoint2D,
): WallId[] {
  const distances: Array<{ wall: WallId; distance: number }> = [
    { wall: 'north', distance: point.z },
    { wall: 'east', distance: scene.room.width - point.x },
    { wall: 'south', distance: scene.room.depth - point.z },
    { wall: 'west', distance: point.x },
  ]

  return distances
    .sort((left, right) => left.distance - right.distance)
    .map((entry) => entry.wall)
}

function clampOffset(offset: number, wallLength: number, moduleWidth: number): number {
  return Math.max(0, Math.min(wallLength - moduleWidth, offset))
}

function clampAxis(offsetFromCenter: number, roomLength: number, moduleLength: number): number {
  const min = -roomLength / 2 + moduleLength / 2
  const max = roomLength / 2 - moduleLength / 2
  return Math.max(min, Math.min(max, offsetFromCenter))
}

function clampAxisWithHalfExtent(offsetFromCenter: number, roomLength: number, halfExtent: number): number {
  const min = -roomLength / 2 + halfExtent
  const max = roomLength / 2 - halfExtent
  return Math.max(min, Math.min(max, offsetFromCenter))
}

function getWallLength(
  scene: Pick<StudioScene, 'room'>,
  wall: WallId,
): number {
  return wall === 'north' || wall === 'south' ? scene.room.width : scene.room.depth
}

function getDesiredWallOffset(
  wall: WallId,
  moduleSpec: KitchenModuleSpec,
  center: RoomPoint2D,
): number {
  return wall === 'north' || wall === 'south'
    ? center.x - moduleSpec.width / 2
    : center.z - moduleSpec.width / 2
}

function getDesiredOpeningWallOffset(
  wall: WallId,
  opening: OpeningSpec,
  center: RoomPoint2D,
): number {
  return wall === 'north' || wall === 'south'
    ? center.x - opening.width / 2
    : center.z - opening.width / 2
}

function resolveWallPlacement(
  scene: Pick<StudioScene, 'room' | 'modules' | 'openings'>,
  moduleSpec: KitchenModuleSpec,
  wall: WallId,
  center: RoomPoint2D,
): ({ mode: 'wall'; wall: WallId; offset: number } & { snapReason: PlanSnapReason }) | null {
  const wallLength = getWallLength(scene, wall)
  const desiredOffset = clampOffset(getDesiredWallOffset(wall, moduleSpec, center), wallLength, moduleSpec.width)
  const ranges = getAllowedOffsetRanges(scene, moduleSpec, wall)

  if (ranges.length === 0) return null

  const bestRange = ranges.reduce((best, range) => {
    const distance = desiredOffset < range.start ? range.start - desiredOffset : desiredOffset > range.end ? desiredOffset - range.end : 0
    if (!best || distance < best.distance) {
      return { range, distance }
    }
    return best
  }, null as { range: AllowedOffsetRange; distance: number } | null)?.range

  if (!bestRange) return null

  let offset = clampOffset(desiredOffset, bestRange.end + moduleSpec.width, moduleSpec.width)
  offset = Math.max(bestRange.start, Math.min(bestRange.end, offset))

  const SNAP_THRESHOLD = 0.12
  const snapCandidates = [
    { offset: bestRange.start, reason: toSnapReason(bestRange.startBound) },
    { offset: bestRange.end, reason: toSnapReason(bestRange.endBound) },
  ]

  let snapReason: PlanSnapReason = 'free'
  const nearestSnap = snapCandidates.reduce((best, candidate) => {
    const distance = Math.abs(offset - candidate.offset)
    if (!best || distance < best.distance) {
      return { candidate, distance }
    }
    return best
  }, null as { candidate: { offset: number; reason: PlanSnapReason }; distance: number } | null)

  if (nearestSnap && nearestSnap.distance <= SNAP_THRESHOLD) {
    offset = nearestSnap.candidate.offset
    snapReason = nearestSnap.candidate.reason
  } else if (bestRange.start > desiredOffset || bestRange.end < desiredOffset) {
    snapReason =
      Math.abs(offset - bestRange.start) <= Math.abs(offset - bestRange.end)
        ? toSnapReason(bestRange.startBound)
        : toSnapReason(bestRange.endBound)
  }

  return { mode: 'wall', wall, offset, snapReason }
}

type BoundType = 'room-start' | 'room-end' | 'opening' | 'module'

interface AllowedOffsetRange {
  start: number
  end: number
  startBound: BoundType
  endBound: BoundType
}

interface BlockedInterval {
  start: number
  end: number
  type: 'opening' | 'module'
}

function getAllowedOffsetRanges(
  scene: Pick<StudioScene, 'room' | 'modules' | 'openings'>,
  moduleSpec: KitchenModuleSpec,
  wall: WallId,
): AllowedOffsetRange[] {
  const wallLength = getWallLength(scene, wall)
  const blocked = mergeBlockedIntervals(
    [
      ...scene.openings
        .filter((opening) => opening.wall === wall)
        .map((opening) => ({
          start: opening.offset,
          end: opening.offset + opening.width,
          type: 'opening' as const,
        })),
      ...scene.modules
        .filter(
          (
            candidate,
          ): candidate is KitchenModuleSpec & { placement: { mode: 'wall'; wall: WallId; offset: number } } =>
            candidate.id !== moduleSpec.id &&
            candidate.placement.mode === 'wall' &&
            candidate.placement.wall === wall,
        )
        .map((candidate) => ({
          start: candidate.placement.offset,
          end: candidate.placement.offset + candidate.width,
          type: 'module' as const,
        })),
    ],
    wallLength,
  )

  const ranges: AllowedOffsetRange[] = []
  let cursor = 0
  let cursorBound: BoundType = 'room-start'

  for (const interval of blocked) {
    const rangeStart = cursor + (cursorBound === 'module' ? MODULE_JOINT_GAP : 0)
    const rangeEnd = interval.start - moduleSpec.width - (interval.type === 'module' ? MODULE_JOINT_GAP : 0)
    if (rangeEnd >= rangeStart) {
      ranges.push({
        start: rangeStart,
        end: rangeEnd,
        startBound: cursorBound,
        endBound: interval.type,
      })
    }

    cursor = Math.max(cursor, interval.end)
    cursorBound = interval.type
  }

  const tailStart = cursor + (cursorBound === 'module' ? MODULE_JOINT_GAP : 0)
  const tailEnd = wallLength - moduleSpec.width
  if (tailEnd >= tailStart) {
    ranges.push({
      start: tailStart,
      end: tailEnd,
      startBound: cursorBound,
      endBound: 'room-end',
    })
  }

  return ranges
}

function getAllowedOpeningOffsetRanges(
  scene: Pick<StudioScene, 'room' | 'openings'>,
  opening: OpeningSpec,
  wall: WallId,
): AllowedOffsetRange[] {
  const wallLength = getWallLength(scene, wall)
  const blocked = mergeBlockedIntervals(
    scene.openings
      .filter((candidate) => candidate.id !== opening.id && candidate.wall === wall)
      .map((candidate) => ({
        start: candidate.offset,
        end: candidate.offset + candidate.width,
        type: 'opening' as const,
      })),
    wallLength,
  )

  const ranges: AllowedOffsetRange[] = []
  let cursor = 0
  let cursorBound: BoundType = 'room-start'

  for (const interval of blocked) {
    const rangeEnd = interval.start - opening.width
    if (rangeEnd >= cursor) {
      ranges.push({
        start: cursor,
        end: rangeEnd,
        startBound: cursorBound,
        endBound: interval.type,
      })
    }

    cursor = Math.max(cursor, interval.end)
    cursorBound = interval.type
  }

  const tailEnd = wallLength - opening.width
  if (tailEnd >= cursor) {
    ranges.push({
      start: cursor,
      end: tailEnd,
      startBound: cursorBound,
      endBound: 'room-end',
    })
  }

  return ranges
}

function mergeBlockedIntervals(intervals: BlockedInterval[], wallLength: number): BlockedInterval[] {
  const sorted = intervals
    .map((interval) => ({
      ...interval,
      start: Math.max(0, Math.min(wallLength, interval.start)),
      end: Math.max(0, Math.min(wallLength, interval.end)),
    }))
    .filter((interval) => interval.end > interval.start)
    .sort((left, right) => left.start - right.start)

  const merged: BlockedInterval[] = []

  for (const interval of sorted) {
    const previous = merged[merged.length - 1]
    if (!previous || interval.start > previous.end) {
      merged.push({ ...interval })
      continue
    }

    previous.end = Math.max(previous.end, interval.end)
    if (interval.type === 'opening') {
      previous.type = 'opening'
    }
  }

  return merged
}

function toSnapReason(bound: BoundType): PlanSnapReason {
  if (bound === 'module') return 'module'
  if (bound === 'opening') return 'opening'
  if (bound === 'room-start' || bound === 'room-end') return 'boundary'
  return 'free'
}

function resolveFreePlacement(
  scene: Pick<StudioScene, 'room' | 'modules'>,
  moduleSpec: KitchenModuleSpec,
  targetCenter: RoomPoint2D,
): PlanDragResolution {
  const rotation = moduleSpec.placement.mode === 'free' ? moduleSpec.placement.rotation : 0
  const extents = getRotatedHalfExtents(moduleSpec.width, moduleSpec.depth, rotation)
  let centerX = clampAxisWithHalfExtent(
    targetCenter.x - scene.room.width / 2,
    scene.room.width,
    extents.halfX,
  ) + scene.room.width / 2
  let centerZ = clampAxisWithHalfExtent(
    targetCenter.z - scene.room.depth / 2,
    scene.room.depth,
    extents.halfZ,
  ) + scene.room.depth / 2

  let snapReason: PlanSnapReason = 'free'

  if (
    Math.abs(centerX - targetCenter.x) > 0.001 ||
    Math.abs(centerZ - targetCenter.z) > 0.001
  ) {
    snapReason = 'boundary'
  }

  const otherFloorModules = scene.modules.filter((candidate) => candidate.id !== moduleSpec.id)

  for (let index = 0; index < 6; index += 1) {
    const selfBounds = getModuleFootprintBounds(scene, moduleSpec, {
      mode: 'free',
      x: centerX - scene.room.width / 2,
      z: centerZ - scene.room.depth / 2,
      rotation,
    })

    let moved = false

    for (const candidate of otherFloorModules) {
      const candidateBounds = getModuleFootprintBounds(scene, candidate)
      const overlapX =
        Math.min(selfBounds.maxX, candidateBounds.maxX) -
        Math.max(selfBounds.minX, candidateBounds.minX)
      const overlapZ =
        Math.min(selfBounds.maxZ, candidateBounds.maxZ) -
        Math.max(selfBounds.minZ, candidateBounds.minZ)

      if (overlapX <= 0 || overlapZ <= 0) continue

      snapReason = 'collision'
      const resolved = findNonCollidingFreeCenter(scene, moduleSpec, extents, {
        x: centerX,
        z: centerZ,
      })
      centerX = resolved.x
      centerZ = resolved.z
      moved = true
    }

    if (!moved) break
  }

  return {
    placement: {
      mode: 'free',
      x: centerX - scene.room.width / 2,
      z: centerZ - scene.room.depth / 2,
      rotation,
    },
    wall: null,
    snapReason,
  }
}

function findNonCollidingFreeCenter(
  scene: Pick<StudioScene, 'room' | 'modules'>,
  moduleSpec: KitchenModuleSpec,
  extents: { halfX: number; halfZ: number },
  currentCenter: RoomPoint2D,
): RoomPoint2D {
  const otherFloorModules = scene.modules.filter((candidate) => candidate.id !== moduleSpec.id)

  const candidates: RoomPoint2D[] = [currentCenter]

  for (const candidate of otherFloorModules) {
    const bounds = getModuleFootprintBounds(scene, candidate)
    candidates.push(
      { x: bounds.minX - extents.halfX, z: currentCenter.z },
      { x: bounds.maxX + extents.halfX, z: currentCenter.z },
      { x: currentCenter.x, z: bounds.minZ - extents.halfZ },
      { x: currentCenter.x, z: bounds.maxZ + extents.halfZ },
    )
  }

  const normalized = candidates
    .map((candidate) => ({
      x:
        clampAxisWithHalfExtent(candidate.x - scene.room.width / 2, scene.room.width, extents.halfX) +
        scene.room.width / 2,
      z:
        clampAxisWithHalfExtent(candidate.z - scene.room.depth / 2, scene.room.depth, extents.halfZ) +
        scene.room.depth / 2,
    }))
    .filter(
      (candidate, index, list) =>
        list.findIndex(
          (entry) =>
            Math.abs(entry.x - candidate.x) < 0.001 &&
            Math.abs(entry.z - candidate.z) < 0.001,
        ) === index,
    )

  const best = normalized.reduce((bestCandidate, candidate) => {
    const overlaps = otherFloorModules.some((otherModule) =>
      footprintsOverlap(
        getModuleFootprintBounds(scene, moduleSpec, {
          mode: 'free',
          x: candidate.x - scene.room.width / 2,
          z: candidate.z - scene.room.depth / 2,
          rotation: moduleSpec.placement.mode === 'free' ? moduleSpec.placement.rotation : 0,
        }),
        getModuleFootprintBounds(scene, otherModule),
      ),
    )

    const distance = Math.hypot(candidate.x - currentCenter.x, candidate.z - currentCenter.z)
    const score = overlaps ? distance + 1000 : distance

    if (!bestCandidate || score < bestCandidate.score) {
      return { point: candidate, score }
    }

    return bestCandidate
  }, null as { point: RoomPoint2D; score: number } | null)

  return best?.point || currentCenter
}

function footprintsOverlap(left: ModuleFootprintBounds, right: ModuleFootprintBounds): boolean {
  const overlapX = Math.min(left.maxX, right.maxX) - Math.max(left.minX, right.minX)
  const overlapZ = Math.min(left.maxZ, right.maxZ) - Math.max(left.minZ, right.minZ)
  return overlapX > 0 && overlapZ > 0
}

function getRotatedHalfExtents(width: number, depth: number, rotation: number): {
  halfX: number
  halfZ: number
} {
  const cos = Math.abs(Math.cos(rotation))
  const sin = Math.abs(Math.sin(rotation))
  return {
    halfX: (width * cos + depth * sin) / 2,
    halfZ: (width * sin + depth * cos) / 2,
  }
}
