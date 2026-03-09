'use client'

import { useEffect, useRef, useState } from 'react'
import { getMaterialPreset } from '@/lib/studio/catalog'
import {
  PLAN_VIEWBOX_HEIGHT,
  PLAN_VIEWBOX_WIDTH,
  type PlanDragResolution,
  buildDuplicatedModule,
  getModuleFootprintBounds,
  getModulePlanCenter,
  getModulePlanRect,
  getOpeningPlanCenter,
  getPlanLayout,
  getRoomPointFromSvg,
  resolveDraggedOpening,
  resolveDraggedPlacement,
} from '@/lib/studio/plan2d'
import type { KitchenModuleSpec, ModulePlacement, OpeningSpec, StudioScene } from '@/lib/studio/schema'

interface Props {
  scene: StudioScene
  selectedModuleId?: string | null
  onSelectModule?: (moduleId: string | null) => void
  onModulePlacementChange?: (moduleId: string, placement: ModulePlacement) => void
  onModuleDuplicate?: (moduleSpec: KitchenModuleSpec) => void
  onModuleRemove?: (moduleId: string) => void
  onOpeningChange?: (openingId: string, patch: Pick<OpeningSpec, 'wall' | 'offset'>) => void
}

type DragState =
  | {
      kind: 'module'
      moduleId: string
      pointerOffset: { x: number; z: number }
      resolution: PlanDragResolution | null
    }
  | {
      kind: 'opening'
      openingId: string
      pointerOffset: { x: number; z: number }
      resolution: Pick<OpeningSpec, 'wall' | 'offset'>
    }

export default function Plan2DCanvas({
  scene,
  selectedModuleId,
  onSelectModule,
  onModulePlacementChange,
  onModuleDuplicate,
  onModuleRemove,
  onOpeningChange,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const layout = getPlanLayout(scene)

  useEffect(() => {
    if (!dragState) return

    const handlePointerMove = (event: PointerEvent) => {
      if (!svgRef.current) return
      const svgPoint = getSvgPoint(svgRef.current, event.clientX, event.clientY)
      const roomPoint = getRoomPointFromSvg(scene, svgPoint)
      if (dragState.kind === 'module') {
        if (!onModulePlacementChange) return
        const moduleSpec = scene.modules.find((candidate) => candidate.id === dragState.moduleId)
        if (!moduleSpec) return

        const resolution = resolveDraggedPlacement(scene, moduleSpec, {
          x: roomPoint.x - dragState.pointerOffset.x,
          z: roomPoint.z - dragState.pointerOffset.z,
        })

        setDragState((current) =>
          current && current.kind === 'module' && current.moduleId === moduleSpec.id
            ? { ...current, resolution }
            : current,
        )

        onModulePlacementChange(moduleSpec.id, resolution.placement)
        return
      }

      if (!onOpeningChange) return
      const opening = scene.openings.find((candidate) => candidate.id === dragState.openingId)
      if (!opening) return

      const resolution = resolveDraggedOpening(scene, opening, {
        x: roomPoint.x - dragState.pointerOffset.x,
        z: roomPoint.z - dragState.pointerOffset.z,
      })

      setDragState((current) =>
        current && current.kind === 'opening' && current.openingId === opening.id
          ? { ...current, resolution }
          : current,
      )

      onOpeningChange(opening.id, resolution)
    }

    const handlePointerUp = () => {
      if (dragState.kind === 'module') {
        onSelectModule?.(null)
      }
      setDragState(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragState, onModulePlacementChange, onOpeningChange, onSelectModule, scene])

  function startModuleDrag(event: React.PointerEvent<SVGGElement>, moduleSpec: KitchenModuleSpec) {
    if (!onModulePlacementChange || !svgRef.current) return

    onSelectModule?.(moduleSpec.id)
    const svgPoint = getSvgPoint(svgRef.current, event.clientX, event.clientY)
    const roomPoint = getRoomPointFromSvg(scene, svgPoint)
    const center = getModulePlanCenter(moduleSpec, scene)

    setDragState({
      kind: 'module',
      moduleId: moduleSpec.id,
      pointerOffset: {
        x: roomPoint.x - center.x,
        z: roomPoint.z - center.z,
      },
      resolution: {
        placement: moduleSpec.placement,
        wall: moduleSpec.placement.mode === 'wall' ? moduleSpec.placement.wall : null,
        snapReason: 'free',
      },
    })
  }

  function startOpeningDrag(event: React.PointerEvent<SVGGElement>, opening: OpeningSpec) {
    if (!onOpeningChange || !svgRef.current) return

    onSelectModule?.(null)
    const svgPoint = getSvgPoint(svgRef.current, event.clientX, event.clientY)
    const roomPoint = getRoomPointFromSvg(scene, svgPoint)
    const center = getOpeningPlanCenter(opening, scene)

    setDragState({
      kind: 'opening',
      openingId: opening.id,
      pointerOffset: {
        x: roomPoint.x - center.x,
        z: roomPoint.z - center.z,
      },
      resolution: {
        wall: opening.wall,
        offset: opening.offset,
      },
    })
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${PLAN_VIEWBOX_WIDTH} ${PLAN_VIEWBOX_HEIGHT}`}
      className="h-full w-full rounded-[24px] bg-[#fbfaf8]"
      style={{ touchAction: 'none' }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onSelectModule?.(null)
        }
      }}
    >
      <defs>
        <pattern id="studio-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#efe9df" strokeWidth="1" />
        </pattern>
      </defs>

      <rect x="0" y="0" width={PLAN_VIEWBOX_WIDTH} height={PLAN_VIEWBOX_HEIGHT} fill="url(#studio-grid)" />

      <rect
        x={layout.roomX}
        y={layout.roomY}
        width={layout.roomWidthPx}
        height={layout.roomDepthPx}
        fill="#fffefb"
        stroke="#231f20"
        strokeWidth="10"
        rx="8"
      />

      {scene.openings.map((opening) => (
        <OpeningShape
          key={opening.id}
          opening={opening}
          scene={scene}
          roomX={layout.roomX}
          roomY={layout.roomY}
          scale={layout.scale}
          dragging={dragState?.kind === 'opening' && dragState.openingId === opening.id}
          onPointerDown={startOpeningDrag}
        />
      ))}

      {scene.modules.map((moduleSpec) => (
        <ModuleShape
          key={moduleSpec.id}
          moduleSpec={moduleSpec}
          scene={scene}
          dragging={dragState?.kind === 'module' && dragState.moduleId === moduleSpec.id}
          selected={selectedModuleId === moduleSpec.id}
          onPointerDown={startModuleDrag}
        />
      ))}

      {dragState?.kind === 'module' && dragState.resolution ? (
        <DragGuides
          scene={scene}
          moduleSpec={
            scene.modules.find((candidate) => candidate.id === dragState.moduleId) || null
          }
          resolution={dragState.resolution}
        />
      ) : null}

      {selectedModuleId ? (
        <SelectedModuleControls
          scene={scene}
          moduleSpec={scene.modules.find((candidate) => candidate.id === selectedModuleId) || null}
          onDuplicate={() => {
            const moduleSpec = scene.modules.find((candidate) => candidate.id === selectedModuleId)
            if (!moduleSpec || !onModuleDuplicate) return
            const duplicated = buildDuplicatedModule(scene, moduleSpec)
            onModuleDuplicate(duplicated)
            onSelectModule?.(duplicated.id)
          }}
          onRemove={() => {
            if (!selectedModuleId || !onModuleRemove) return
            onModuleRemove(selectedModuleId)
            onSelectModule?.(null)
          }}
          onRotate={(delta) => {
            const moduleSpec = scene.modules.find((candidate) => candidate.id === selectedModuleId)
            if (!moduleSpec || moduleSpec.placement.mode !== 'free' || !onModulePlacementChange) return

            const nextRotation = normalizeRotation(moduleSpec.placement.rotation + delta)
            const rotatedModule: KitchenModuleSpec = {
              ...moduleSpec,
              placement: {
                ...moduleSpec.placement,
                rotation: nextRotation,
              },
            }
            const resolution = resolveDraggedPlacement(
              scene,
              rotatedModule,
              getModulePlanCenter(moduleSpec, scene),
            )
            onModulePlacementChange(moduleSpec.id, resolution.placement)
          }}
        />
      ) : null}

      <text
        x={PLAN_VIEWBOX_WIDTH / 2}
        y={layout.roomY - 18}
        textAnchor="middle"
        className="fill-[#5f5750] text-[16px] font-semibold"
      >
        Plan parametrique {scene.room.width.toFixed(2)} m x {scene.room.depth.toFixed(2)} m
      </text>

      <g transform={`translate(24 ${PLAN_VIEWBOX_HEIGHT - 70})`}>
        <rect x="0" y="0" width="280" height="52" rx="16" fill="#fffaf2" stroke="#e7ddcf" />
        <text x="16" y="20" className="fill-[#201d1e] text-[12px] font-semibold">
          Glisser-deposer meubles et ouvertures
        </text>
        <text x="16" y="36" className="fill-[#6c645f] text-[11px]">
          Les meubles se deselectionnent apres drag. Les fenetres se replacent aussi ici.
        </text>
      </g>
    </svg>
  )
}

function OpeningShape({
  opening,
  scene,
  roomX,
  roomY,
  scale,
  dragging,
  onPointerDown,
}: {
  opening: OpeningSpec
  scene: StudioScene
  roomX: number
  roomY: number
  scale: number
  dragging: boolean
  onPointerDown: (event: React.PointerEvent<SVGGElement>, opening: OpeningSpec) => void
}) {
  const widthPx = opening.width * scale
  const offsetPx = opening.offset * scale
  const roomWidthPx = scene.room.width * scale
  const roomDepthPx = scene.room.depth * scale

  if (opening.wall === 'north' || opening.wall === 'south') {
    const y = opening.wall === 'north' ? roomY - 6 : roomY + roomDepthPx - 6
    return (
      <g onPointerDown={(event) => onPointerDown(event, opening)} style={{ cursor: dragging ? 'grabbing' : 'grab' }}>
        <rect
          x={roomX + offsetPx}
          y={y}
          width={widthPx}
          height={12}
          fill={dragging ? '#3b91c8' : '#6db6d9'}
          stroke={dragging ? '#1f6f9f' : '#4f93b2'}
          strokeWidth={dragging ? 3 : 2}
          rx="3"
        />
        <text x={roomX + offsetPx + widthPx / 2} y={y - 6} textAnchor="middle" className="fill-[#5f5750] text-[12px]">
          {opening.name}
        </text>
      </g>
    )
  }

  const x = opening.wall === 'west' ? roomX - 6 : roomX + roomWidthPx - 6
  return (
    <g onPointerDown={(event) => onPointerDown(event, opening)} style={{ cursor: dragging ? 'grabbing' : 'grab' }}>
      <rect
        x={x}
        y={roomY + offsetPx}
        width={12}
        height={widthPx}
        fill={dragging ? '#3b91c8' : '#6db6d9'}
        stroke={dragging ? '#1f6f9f' : '#4f93b2'}
        strokeWidth={dragging ? 3 : 2}
        rx="3"
      />
      <text x={x + 18} y={roomY + offsetPx + widthPx / 2} className="fill-[#5f5750] text-[12px]">
        {opening.name}
      </text>
    </g>
  )
}

function ModuleShape({
  moduleSpec,
  scene,
  dragging,
  selected,
  onPointerDown,
}: {
  moduleSpec: KitchenModuleSpec
  scene: StudioScene
  dragging: boolean
  selected: boolean
  onPointerDown: (event: React.PointerEvent<SVGGElement>, moduleSpec: KitchenModuleSpec) => void
}) {
  const rect = getModulePlanRect(moduleSpec, scene, getPlanLayout(scene))
  const materialColor =
    getMaterialPreset(moduleSpec.frontsMaterialId || scene.materials.fronts)?.previewColor ||
    '#f4f2ee'

  return (
    <g
      transform={rect.rotate ? `rotate(${rect.rotate} ${rect.x + rect.width / 2} ${rect.y + rect.height / 2})` : undefined}
      onPointerDown={(event) => onPointerDown(event, moduleSpec)}
      style={{ cursor: dragging ? 'grabbing' : 'grab' }}
    >
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill={materialColor}
        stroke={dragging ? '#c24f2c' : selected ? '#7c5f38' : '#242122'}
        strokeWidth={dragging ? 5 : selected ? 4 : 3}
        rx="5"
      />
      {selected ? (
        <>
          <rect
            x={rect.x - 6}
            y={rect.y - 6}
            width={rect.width + 12}
            height={rect.height + 12}
            fill="none"
            stroke="#d1a96e"
            strokeWidth="2"
            strokeDasharray="4 3"
            rx="9"
          />
          <g transform={`translate(${rect.x + rect.width / 2 - 42} ${rect.y - 24})`}>
            <rect x="0" y="0" width="84" height="18" rx="9" fill="#201d1e" opacity="0.92" />
            <text x="42" y="12" textAnchor="middle" className="fill-white text-[10px] font-semibold">
              Selectionne
            </text>
          </g>
        </>
      ) : null}
      <text
        x={rect.x + rect.width / 2}
        y={rect.y + rect.height / 2 - 2}
        textAnchor="middle"
        pointerEvents="none"
        className="fill-[#221f20] text-[12px] font-semibold"
      >
        {moduleSpec.label}
      </text>
      <text
        x={rect.x + rect.width / 2}
        y={rect.y + rect.height / 2 + 14}
        textAnchor="middle"
        pointerEvents="none"
        className="fill-[#6c645f] text-[11px]"
      >
        {(moduleSpec.width * 1000).toFixed(0)} mm
      </text>
    </g>
  )
}

function DragGuides({
  scene,
  moduleSpec,
  resolution,
}: {
  scene: StudioScene
  moduleSpec: KitchenModuleSpec | null
  resolution: PlanDragResolution
}) {
  if (!moduleSpec) return null

  const layout = getPlanLayout(scene)
  const previewModule = { ...moduleSpec, placement: resolution.placement }
  const rect = getModulePlanRect(previewModule, scene, layout)
  const bounds = getModuleFootprintBounds(scene, moduleSpec, resolution.placement)
  const wallGuide = resolution.wall ? getWallGuide(layout, scene, resolution.wall) : null
  const reasonLabel =
    resolution.snapReason === 'module'
      ? 'Snap module'
      : resolution.snapReason === 'opening'
        ? 'Evite ouverture'
        : resolution.snapReason === 'collision'
          ? 'Evite collision'
        : resolution.snapReason === 'boundary'
          ? 'Snap limite'
          : 'Placement libre'

  return (
    <g pointerEvents="none">
      {wallGuide ? (
        <line
          x1={wallGuide.x1}
          y1={wallGuide.y1}
          x2={wallGuide.x2}
          y2={wallGuide.y2}
          stroke="#c24f2c"
          strokeWidth="4"
          strokeDasharray="10 8"
          opacity="0.8"
        />
      ) : null}

      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        rx="6"
        fill="none"
        stroke="#c24f2c"
        strokeWidth="3"
        strokeDasharray="8 6"
      />

      <g transform={`translate(${rect.x + 8} ${Math.max(18, rect.y - 14)})`}>
        <rect x="0" y="-14" width="112" height="22" rx="11" fill="#201d1e" opacity="0.9" />
        <text x="10" y="1" className="fill-white text-[11px] font-semibold">
          {reasonLabel}
        </text>
      </g>

      {resolution.placement.mode === 'wall' && resolution.wall ? (
        <WallMeasurements
          scene={scene}
          moduleSpec={moduleSpec}
          wall={resolution.wall}
          offset={resolution.placement.offset}
          layout={layout}
        />
      ) : (
        <FreeMeasurements scene={scene} bounds={bounds} layout={layout} />
      )}
    </g>
  )
}

function WallMeasurements({
  scene,
  moduleSpec,
  wall,
  offset,
  layout,
}: {
  scene: StudioScene
  moduleSpec: KitchenModuleSpec
  wall: 'north' | 'east' | 'south' | 'west'
  offset: number
  layout: ReturnType<typeof getPlanLayout>
}) {
  const wallLength = wall === 'north' || wall === 'south' ? scene.room.width : scene.room.depth
  const remaining = Math.max(0, wallLength - offset - moduleSpec.width)
  const labelY = wall === 'north' ? layout.roomY + 22 : layout.roomY + layout.roomDepthPx - 14
  const labelX = wall === 'west' ? layout.roomX + 16 : layout.roomX + layout.roomWidthPx - 90

  return (
    <g>
      <rect
        x={labelX}
        y={labelY}
        width="74"
        height="36"
        rx="12"
        fill="#fffaf2"
        stroke="#e7caa2"
      />
      <text x={labelX + 10} y={labelY + 15} className="fill-[#6c645f] text-[10px] font-semibold">
        Debut {formatMeters(offset)}
      </text>
      <text x={labelX + 10} y={labelY + 28} className="fill-[#6c645f] text-[10px] font-semibold">
        Fin {formatMeters(remaining)}
      </text>
    </g>
  )
}

function FreeMeasurements({
  scene,
  bounds,
  layout,
}: {
  scene: StudioScene
  bounds: ReturnType<typeof getModuleFootprintBounds>
  layout: ReturnType<typeof getPlanLayout>
}) {
  const left = bounds.minX
  const right = scene.room.width - bounds.maxX
  const top = bounds.minZ
  const bottom = scene.room.depth - bounds.maxZ
  const topY = layout.roomY + bounds.minZ * layout.scale - 10
  const leftX = layout.roomX + bounds.minX * layout.scale - 4

  return (
    <g>
      <line
        x1={layout.roomX}
        y1={topY}
        x2={layout.roomX + bounds.minX * layout.scale}
        y2={topY}
        stroke="#7c5f38"
        strokeWidth="2"
        strokeDasharray="6 5"
      />
      <line
        x1={layout.roomX + bounds.maxX * layout.scale}
        y1={topY}
        x2={layout.roomX + scene.room.width * layout.scale}
        y2={topY}
        stroke="#7c5f38"
        strokeWidth="2"
        strokeDasharray="6 5"
      />
      <line
        x1={leftX}
        y1={layout.roomY}
        x2={leftX}
        y2={layout.roomY + bounds.minZ * layout.scale}
        stroke="#7c5f38"
        strokeWidth="2"
        strokeDasharray="6 5"
      />
      <line
        x1={leftX}
        y1={layout.roomY + bounds.maxZ * layout.scale}
        x2={leftX}
        y2={layout.roomY + scene.room.depth * layout.scale}
        stroke="#7c5f38"
        strokeWidth="2"
        strokeDasharray="6 5"
      />

      <MeasurementChip x={layout.roomX + bounds.minX * layout.scale / 2} y={topY - 8} label={formatMeters(left)} />
      <MeasurementChip
        x={layout.roomX + bounds.maxX * layout.scale + (scene.room.width - bounds.maxX) * layout.scale / 2}
        y={topY - 8}
        label={formatMeters(right)}
      />
      <MeasurementChip x={leftX - 8} y={layout.roomY + bounds.minZ * layout.scale / 2} label={formatMeters(top)} vertical />
      <MeasurementChip
        x={leftX - 8}
        y={layout.roomY + bounds.maxZ * layout.scale + (scene.room.depth - bounds.maxZ) * layout.scale / 2}
        label={formatMeters(bottom)}
        vertical
      />
    </g>
  )
}

function MeasurementChip({
  x,
  y,
  label,
  vertical = false,
}: {
  x: number
  y: number
  label: string
  vertical?: boolean
}) {
  return (
    <g transform={`translate(${x} ${y}) ${vertical ? 'rotate(-90)' : ''}`}>
      <rect x="-24" y="-10" width="48" height="20" rx="10" fill="#fffaf2" stroke="#e7caa2" />
      <text x="0" y="4" textAnchor="middle" className="fill-[#6c645f] text-[10px] font-semibold">
        {label}
      </text>
    </g>
  )
}

function SelectedModuleControls({
  scene,
  moduleSpec,
  onDuplicate,
  onRemove,
  onRotate,
}: {
  scene: StudioScene
  moduleSpec: KitchenModuleSpec | null
  onDuplicate: () => void
  onRemove: () => void
  onRotate: (delta: number) => void
}) {
  if (!moduleSpec) return null

  const layout = getPlanLayout(scene)
  const rect = getModulePlanRect(moduleSpec, scene, layout)
  const x = rect.x + rect.width + 10
  const y = rect.y + rect.height / 2 - (moduleSpec.placement.mode === 'free' ? 56 : 26)

  return (
    <g>
      <ActionButton x={x} y={y} label="Dupl." onClick={onDuplicate} />
      <ActionButton x={x} y={y + 30} label="Suppr." destructive onClick={onRemove} />
      {moduleSpec.placement.mode === 'free' ? (
        <>
          <ActionButton x={x} y={y + 60} label="-15°" onClick={() => onRotate(-Math.PI / 12)} />
          <ActionButton x={x} y={y + 90} label="+15°" onClick={() => onRotate(Math.PI / 12)} />
        </>
      ) : null}
    </g>
  )
}

function ActionButton({
  x,
  y,
  label,
  destructive = false,
  onClick,
}: {
  x: number
  y: number
  label: string
  destructive?: boolean
  onClick: () => void
}) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      style={{ cursor: 'pointer' }}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
    >
      <rect
        x="0"
        y="0"
        width="54"
        height="24"
        rx="12"
        fill={destructive ? '#9b5143' : '#201d1e'}
        opacity="0.92"
      />
      <text x="27" y="16" textAnchor="middle" className="fill-white text-[10px] font-semibold">
        {label}
      </text>
    </g>
  )
}

function getWallGuide(
  layout: ReturnType<typeof getPlanLayout>,
  scene: StudioScene,
  wall: 'north' | 'east' | 'south' | 'west',
) {
  const inset = 20

  if (wall === 'north') {
    return {
      x1: layout.roomX + inset,
      y1: layout.roomY + inset,
      x2: layout.roomX + scene.room.width * layout.scale - inset,
      y2: layout.roomY + inset,
    }
  }

  if (wall === 'south') {
    return {
      x1: layout.roomX + inset,
      y1: layout.roomY + scene.room.depth * layout.scale - inset,
      x2: layout.roomX + scene.room.width * layout.scale - inset,
      y2: layout.roomY + scene.room.depth * layout.scale - inset,
    }
  }

  if (wall === 'west') {
    return {
      x1: layout.roomX + inset,
      y1: layout.roomY + inset,
      x2: layout.roomX + inset,
      y2: layout.roomY + scene.room.depth * layout.scale - inset,
    }
  }

  return {
    x1: layout.roomX + scene.room.width * layout.scale - inset,
    y1: layout.roomY + inset,
    x2: layout.roomX + scene.room.width * layout.scale - inset,
    y2: layout.roomY + scene.room.depth * layout.scale - inset,
  }
}

function getSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; z: number } {
  const rect = svg.getBoundingClientRect()
  const scaleX = PLAN_VIEWBOX_WIDTH / rect.width
  const scaleY = PLAN_VIEWBOX_HEIGHT / rect.height

  return {
    x: (clientX - rect.left) * scaleX,
    z: (clientY - rect.top) * scaleY,
  }
}

function normalizeRotation(rotation: number): number {
  const fullTurn = Math.PI * 2
  let normalized = rotation % fullTurn
  if (normalized > Math.PI) normalized -= fullTurn
  if (normalized < -Math.PI) normalized += fullTurn
  return normalized
}

function formatMeters(value: number): string {
  return `${value.toFixed(2)} m`
}
