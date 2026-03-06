'use client'

import { getMaterialPreset } from '@/lib/studio/catalog'
import type { KitchenModuleSpec, OpeningSpec, StudioScene } from '@/lib/studio/schema'

interface Props {
  scene: StudioScene
}

const VIEWBOX_WIDTH = 860
const VIEWBOX_HEIGHT = 620
const PADDING = 70

export default function Plan2DCanvas({ scene }: Props) {
  const scale = Math.min(
    (VIEWBOX_WIDTH - PADDING * 2) / scene.room.width,
    (VIEWBOX_HEIGHT - PADDING * 2) / scene.room.depth,
  )

  const roomWidthPx = scene.room.width * scale
  const roomDepthPx = scene.room.depth * scale
  const roomX = (VIEWBOX_WIDTH - roomWidthPx) / 2
  const roomY = (VIEWBOX_HEIGHT - roomDepthPx) / 2

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className="w-full h-full rounded-[24px] bg-[#fbfaf8]"
    >
      <defs>
        <pattern id="studio-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#efe9df" strokeWidth="1" />
        </pattern>
      </defs>

      <rect x="0" y="0" width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="url(#studio-grid)" />

      <rect
        x={roomX}
        y={roomY}
        width={roomWidthPx}
        height={roomDepthPx}
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
          roomX={roomX}
          roomY={roomY}
          scale={scale}
        />
      ))}

      {scene.modules.map((moduleSpec) => (
        <ModuleShape
          key={moduleSpec.id}
          moduleSpec={moduleSpec}
          scene={scene}
          roomX={roomX}
          roomY={roomY}
          scale={scale}
        />
      ))}

      <text
        x={VIEWBOX_WIDTH / 2}
        y={roomY - 18}
        textAnchor="middle"
        className="fill-[#5f5750] text-[16px] font-semibold"
      >
        Plan parametrique {scene.room.width.toFixed(2)} m x {scene.room.depth.toFixed(2)} m
      </text>
    </svg>
  )
}

function OpeningShape({
  opening,
  scene,
  roomX,
  roomY,
  scale,
}: {
  opening: OpeningSpec
  scene: StudioScene
  roomX: number
  roomY: number
  scale: number
}) {
  const widthPx = opening.width * scale
  const offsetPx = opening.offset * scale
  const roomWidthPx = scene.room.width * scale
  const roomDepthPx = scene.room.depth * scale

  if (opening.wall === 'north' || opening.wall === 'south') {
    const y = opening.wall === 'north' ? roomY - 6 : roomY + roomDepthPx - 6
    return (
      <g>
        <rect x={roomX + offsetPx} y={y} width={widthPx} height={12} fill="#6db6d9" rx="3" />
        <text x={roomX + offsetPx + widthPx / 2} y={y - 6} textAnchor="middle" className="fill-[#5f5750] text-[12px]">
          {opening.name}
        </text>
      </g>
    )
  }

  const x = opening.wall === 'west' ? roomX - 6 : roomX + roomWidthPx - 6
  return (
    <g>
      <rect x={x} y={roomY + offsetPx} width={12} height={widthPx} fill="#6db6d9" rx="3" />
      <text x={x + 18} y={roomY + offsetPx + widthPx / 2} className="fill-[#5f5750] text-[12px]">
        {opening.name}
      </text>
    </g>
  )
}

function ModuleShape({
  moduleSpec,
  scene,
  roomX,
  roomY,
  scale,
}: {
  moduleSpec: KitchenModuleSpec
  scene: StudioScene
  roomX: number
  roomY: number
  scale: number
}) {
  const { x, y, width, height, rotate } = getModuleRect(moduleSpec, scene, roomX, roomY, scale)
  const materialColor =
    getMaterialPreset(moduleSpec.frontsMaterialId || scene.materials.fronts)?.previewColor ||
    '#f4f2ee'

  return (
    <g transform={rotate ? `rotate(${rotate} ${x + width / 2} ${y + height / 2})` : undefined}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={materialColor}
        stroke="#242122"
        strokeWidth="3"
        rx="5"
      />
      <text
        x={x + width / 2}
        y={y + height / 2 - 2}
        textAnchor="middle"
        className="fill-[#221f20] text-[12px] font-semibold"
      >
        {moduleSpec.label}
      </text>
      <text
        x={x + width / 2}
        y={y + height / 2 + 14}
        textAnchor="middle"
        className="fill-[#6c645f] text-[11px]"
      >
        {(moduleSpec.width * 1000).toFixed(0)} mm
      </text>
    </g>
  )
}

function getModuleRect(
  moduleSpec: KitchenModuleSpec,
  scene: StudioScene,
  roomX: number,
  roomY: number,
  scale: number,
): { x: number; y: number; width: number; height: number; rotate: number } {
  if (moduleSpec.placement.mode === 'free') {
    return {
      x:
        roomX + scene.room.width * scale / 2 + (moduleSpec.placement.x - moduleSpec.width / 2) * scale,
      y:
        roomY + scene.room.depth * scale / 2 + (moduleSpec.placement.z - moduleSpec.depth / 2) * scale,
      width: moduleSpec.width * scale,
      height: moduleSpec.depth * scale,
      rotate: (moduleSpec.placement.rotation * 180) / Math.PI,
    }
  }

  if (moduleSpec.placement.wall === 'north') {
    return {
      x: roomX + moduleSpec.placement.offset * scale,
      y: roomY,
      width: moduleSpec.width * scale,
      height: moduleSpec.depth * scale,
      rotate: 0,
    }
  }

  if (moduleSpec.placement.wall === 'south') {
    return {
      x: roomX + moduleSpec.placement.offset * scale,
      y: roomY + scene.room.depth * scale - moduleSpec.depth * scale,
      width: moduleSpec.width * scale,
      height: moduleSpec.depth * scale,
      rotate: 0,
    }
  }

  if (moduleSpec.placement.wall === 'west') {
    return {
      x: roomX,
      y: roomY + moduleSpec.placement.offset * scale,
      width: moduleSpec.depth * scale,
      height: moduleSpec.width * scale,
      rotate: 0,
    }
  }

  return {
    x: roomX + scene.room.width * scale - moduleSpec.depth * scale,
    y: roomY + moduleSpec.placement.offset * scale,
    width: moduleSpec.depth * scale,
    height: moduleSpec.width * scale,
    rotate: 0,
  }
}
