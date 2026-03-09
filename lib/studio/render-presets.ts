import type {
  AutoCameraPreset,
  CompiledCamera,
  RenderAmbiencePreset,
  RenderQualityPreset,
  RoomSpec,
} from './schema.ts'

export const AUTO_CAMERA_PRESET_OPTIONS: { id: AutoCameraPreset; label: string; hint: string }[] = [
  { id: 'balanced', label: 'Equilibre', hint: 'Vue 3/4 sobre pour la plupart des cuisines.' },
  { id: 'hero', label: 'Hero', hint: 'Angle plus vendeur pour un premier effet waouh.' },
  { id: 'wide', label: 'Large', hint: 'Vue plus ouverte pour mieux lire la piece.' },
  { id: 'island', label: 'Ilot', hint: 'Met l ilot ou l espace central en avant.' },
]

export const RENDER_AMBIENCE_OPTIONS: {
  id: RenderAmbiencePreset
  label: string
  hint: string
}[] = [
  { id: 'soft-daylight', label: 'Jour doux', hint: 'Ambiance claire et neutre.' },
  { id: 'warm-showroom', label: 'Showroom chaud', hint: 'Plus chaleureux, plus vendeur.' },
  { id: 'graphite-premium', label: 'Premium contraste', hint: 'Plus dense et plus haut de gamme.' },
]

export const RENDER_QUALITY_OPTIONS: {
  id: RenderQualityPreset
  label: string
  hint: string
}[] = [
  { id: 'express', label: 'Express', hint: 'Plus rapide pour un premier rendu sur place.' },
  { id: 'refined', label: 'Affine', hint: 'Un peu plus lent, mais plus propre.' },
]

export function getAutoCamera(
  room: Pick<RoomSpec, 'width' | 'depth' | 'height'>,
  preset: AutoCameraPreset,
): CompiledCamera {
  if (preset === 'hero') {
    return {
      position: {
        x: room.width * 0.62,
        y: room.height * 0.56,
        z: room.depth * 0.88,
      },
      target: { x: 0, y: room.height * 0.41, z: -room.depth * 0.08 },
      fov: 38,
    }
  }

  if (preset === 'wide') {
    return {
      position: {
        x: room.width * 0.08,
        y: room.height * 0.62,
        z: room.depth * 1.5,
      },
      target: { x: 0, y: room.height * 0.44, z: 0 },
      fov: 54,
    }
  }

  if (preset === 'island') {
    return {
      position: {
        x: room.width * 0.68,
        y: room.height * 0.56,
        z: room.depth * 0.94,
      },
      target: { x: 0, y: room.height * 0.41, z: -room.depth * 0.12 },
      fov: 42,
    }
  }

  return {
    position: {
      x: room.width * 0.48,
      y: room.height * 0.58,
      z: room.depth * 1.08,
    },
    target: { x: 0, y: room.height * 0.42, z: 0 },
    fov: 42,
  }
}

export function getRenderAmbienceSettings(preset: RenderAmbiencePreset): {
  backgroundColor: string
  previewBackgroundColor: string
  ambientIntensity: number
  sunIntensity: number
  colorManagement: string
  exposure: number
  worldStrength: number
  areaEnergyMultiplier: number
  areaColor: string
  fillEnergy: number
  fillColor: string
  rimEnergy: number
  rimColor: string
  sunEnergy: number
  sunColor: string
} {
  if (preset === 'warm-showroom') {
    return {
      backgroundColor: '#f4eee6',
      previewBackgroundColor: '#f8f2ea',
      ambientIntensity: 1.1,
      sunIntensity: 1.85,
      colorManagement: 'AgX - Medium Contrast',
      exposure: 0.5,
      worldStrength: 0.72,
      areaEnergyMultiplier: 1.18,
      areaColor: '#fff4e3',
      fillEnergy: 480,
      fillColor: '#ffe7c7',
      rimEnergy: 190,
      rimColor: '#fff7ed',
      sunEnergy: 1.9,
      sunColor: '#ffe9c7',
    }
  }

  if (preset === 'graphite-premium') {
    return {
      backgroundColor: '#ece7e2',
      previewBackgroundColor: '#f0ebe5',
      ambientIntensity: 0.92,
      sunIntensity: 1.55,
      colorManagement: 'AgX - Medium High Contrast',
      exposure: 0.18,
      worldStrength: 0.58,
      areaEnergyMultiplier: 1.02,
      areaColor: '#f8f1ea',
      fillEnergy: 360,
      fillColor: '#f5ebe2',
      rimEnergy: 220,
      rimColor: '#ffffff',
      sunEnergy: 1.5,
      sunColor: '#fff1dc',
    }
  }

  return {
    backgroundColor: '#f6f1ea',
    previewBackgroundColor: '#f8f5f0',
    ambientIntensity: 1.2,
    sunIntensity: 2.2,
    colorManagement: 'AgX - Base Contrast',
    exposure: 0.32,
    worldStrength: 0.8,
    areaEnergyMultiplier: 1.0,
    areaColor: '#ffffff',
    fillEnergy: 420,
    fillColor: '#eef5ff',
    rimEnergy: 120,
    rimColor: '#fffef8',
    sunEnergy: 2.2,
    sunColor: '#fff9f0',
  }
}

export function getRenderQualitySettings(preset: RenderQualityPreset): {
  width: number
  height: number
  samples: number
  denoise: boolean
  adaptiveThreshold: number
  maxBounces: number
  diffuseBounces: number
  glossyBounces: number
  transmissionBounces: number
  filterWidth: number
  bevelWidth: number
  bevelSegments: number
} {
  if (preset === 'refined') {
    return {
      width: 2200,
      height: 1466,
      samples: 192,
      denoise: true,
      adaptiveThreshold: 0.015,
      maxBounces: 8,
      diffuseBounces: 4,
      glossyBounces: 4,
      transmissionBounces: 8,
      filterWidth: 1.0,
      bevelWidth: 0.008,
      bevelSegments: 3,
    }
  }

  return {
    width: 1600,
    height: 1066,
    samples: 96,
    denoise: true,
    adaptiveThreshold: 0.028,
    maxBounces: 6,
    diffuseBounces: 3,
    glossyBounces: 3,
    transmissionBounces: 6,
    filterWidth: 1.15,
    bevelWidth: 0.006,
    bevelSegments: 2,
  }
}
