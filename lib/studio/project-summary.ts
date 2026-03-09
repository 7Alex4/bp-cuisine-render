import { getSceneCamera } from './compiler.ts'
import {
  AUTO_CAMERA_PRESET_OPTIONS,
  RENDER_AMBIENCE_OPTIONS,
  RENDER_QUALITY_OPTIONS,
} from './render-presets.ts'
import { summarizeRoomPhotoReferences } from './schema.ts'
import type { PreviewShellMode, StudioScene, WallId } from './schema'

const WALL_ORDER: WallId[] = ['north', 'east', 'south', 'west']
const WALL_LABELS: Record<WallId, string> = {
  north: 'nord',
  east: 'est',
  south: 'sud',
  west: 'ouest',
}

export function getPreviewShellLabel(mode: PreviewShellMode): string {
  if (mode === '2-walls') return '2 murs'
  if (mode === '3-walls') return '3 murs'
  return 'Auto'
}

export function getPreviewDeliveryLabel({
  previewReady,
  renderReady,
  renderQualityPreset,
}: {
  previewReady: boolean
  renderReady: boolean
  renderQualityPreset?: StudioScene['renderQualityPreset']
}): string {
  if (renderReady) return 'Preview ok · rendu pret'
  if (previewReady && renderQualityPreset === 'express') return 'Preview ok · express dispo'
  if (previewReady) return 'Preview ok · rendu verrouille'
  return 'Preview a completer'
}

export function getAutoCameraPresetLabel(
  preset: StudioScene['autoCameraPreset'],
): string {
  return AUTO_CAMERA_PRESET_OPTIONS.find((option) => option.id === preset)?.label || 'Equilibre'
}

export function getRenderAmbienceLabel(
  preset: StudioScene['renderAmbiencePreset'],
): string {
  return (
    RENDER_AMBIENCE_OPTIONS.find((option) => option.id === preset)?.label || 'Jour doux'
  )
}

export function getRenderQualityLabel(
  preset: StudioScene['renderQualityPreset'],
): string {
  return RENDER_QUALITY_OPTIONS.find((option) => option.id === preset)?.label || 'Express'
}

export function getImplantationLabel(scene: Pick<StudioScene, 'modules'>): string {
  const wallModules = Array.from(
    new Set(
      scene.modules.flatMap((moduleSpec) =>
        moduleSpec.placement.mode === 'wall' ? [moduleSpec.placement.wall] : [],
      ),
    ),
  ).sort((left, right) => WALL_ORDER.indexOf(left) - WALL_ORDER.indexOf(right))

  const hasIsland = scene.modules.some((moduleSpec) => moduleSpec.kind === 'island')
  const hasFreeModules = scene.modules.some(
    (moduleSpec) => moduleSpec.placement.mode === 'free' && moduleSpec.kind !== 'island',
  )

  let baseLabel = 'A definir'

  if (wallModules.length === 0) {
    baseLabel = hasIsland ? 'Ilot' : hasFreeModules ? 'Libre' : 'A definir'
  } else if (wallModules.length === 1) {
    baseLabel = 'Lineaire'
  } else if (wallModules.length === 2) {
    baseLabel = areOppositeWalls(wallModules[0], wallModules[1]) ? 'Parallele' : 'En L'
  } else if (wallModules.length === 3) {
    baseLabel = 'En U'
  } else {
    baseLabel = 'Peripherique'
  }

  if (hasIsland && baseLabel !== 'Ilot') {
    return `${baseLabel} + ilot`
  }

  return baseLabel
}

export function getCameraAngleLabel(
  scene: Pick<StudioScene, 'room' | 'cameraMatch'>,
): string {
  if (scene.cameraMatch.enabled) {
    return 'Camera manuelle'
  }

  const camera = getSceneCamera(scene)
  const deltaX = camera.position.x - camera.target.x
  const deltaZ = camera.position.z - camera.target.z
  const absX = Math.abs(deltaX)
  const absZ = Math.abs(deltaZ)

  if (absX < 0.2) {
    return deltaZ >= 0 ? 'Face sud' : 'Face nord'
  }

  if (absZ < 0.2) {
    return deltaX >= 0 ? 'Lateral est' : 'Lateral ouest'
  }

  const vertical = deltaZ >= 0 ? 'sud' : 'nord'
  const horizontal = deltaX >= 0 ? 'est' : 'ouest'
  return `3/4 ${vertical}-${horizontal}`
}

export function getVisualReferencesSummary(
  scene: Pick<StudioScene, 'references' | 'siteSurvey'>,
): { value: string; hint: string } {
  const sketchAttached = Boolean(scene.references.sketchName)
  const coverage = summarizeRoomPhotoReferences(scene.references)

  const valueParts: string[] = []
  valueParts.push(sketchAttached ? 'Croquis joint' : 'Croquis absent')
  valueParts.push(
    coverage.count > 0
      ? `${coverage.count} photo${coverage.count > 1 ? 's' : ''}`
      : 'Aucune photo',
  )

  const hintParts: string[] = []
  if (coverage.wallCoverage.length > 0) {
    hintParts.push(`murs ${coverage.wallCoverage.map((wall) => WALL_LABELS[wall]).join('/')}`)
  } else if (coverage.hasGenericWall) {
    hintParts.push('murs generiques')
  }
  if (coverage.missingWalls.length > 0 && coverage.wallCoverage.length > 0) {
    hintParts.push(`manque ${coverage.missingWalls.map((wall) => WALL_LABELS[wall]).join('/')}`)
  }
  if (coverage.hasFloor || scene.siteSurvey.visualReferences.floorPhotoProvided) {
    hintParts.push('sol ok')
  }
  if (coverage.hasCeiling || scene.siteSurvey.visualReferences.ceilingPhotoProvided) {
    hintParts.push('plafond ok')
  }
  if (
    coverage.wallCoverage.length === 4 ||
    scene.siteSurvey.visualReferences.fullWallSetProvided
  ) {
    hintParts.push('murs complets')
  }
  if (coverage.technicalDetailCount > 0) {
    hintParts.push(`details tech x${coverage.technicalDetailCount}`)
  }
  if (coverage.finishDetailCount > 0) {
    hintParts.push(`details finition x${coverage.finishDetailCount}`)
  }

  return {
    value: valueParts.join(' · '),
    hint: hintParts.join(' · ') || 'References terrain a completer',
  }
}

export function getVisualDossierSummary(
  scene: Pick<StudioScene, 'references' | 'siteSurvey'>,
): {
  status: 'insuffisant' | 'suffisant' | 'complet'
  score: number
  label: string
  hint: string
  missing: string[]
} {
  const coverage = summarizeRoomPhotoReferences(scene.references)
  const visualReferences = scene.siteSurvey.visualReferences
  const sketchAttached = Boolean(scene.references.sketchName) || visualReferences.sketchProvided
  const wallCoveragePartial = coverage.wallCoverage.length >= 2 || coverage.hasGenericWall
  const wallCoverageComplete =
    coverage.wallCoverage.length === 4 || visualReferences.fullWallSetProvided
  const floorCovered = coverage.hasFloor || visualReferences.floorPhotoProvided
  const ceilingCovered = coverage.hasCeiling || visualReferences.ceilingPhotoProvided
  const enoughPhotos = coverage.count >= 2 || visualReferences.roomPhotoCount >= 2
  const strongPhotoSet = coverage.count >= 4 || visualReferences.roomPhotoCount >= 4
  const helpfulDetails = coverage.technicalDetailCount + coverage.finishDetailCount > 0

  const scoreParts = [
    sketchAttached ? 15 : 0,
    enoughPhotos ? 20 : 0,
    wallCoveragePartial ? 15 : 0,
    wallCoverageComplete ? 20 : 0,
    floorCovered ? 10 : 0,
    ceilingCovered ? 10 : 0,
    strongPhotoSet ? 5 : 0,
    helpfulDetails ? 5 : 0,
  ]
  const score = scoreParts.reduce((sum, value) => sum + value, 0)

  const missing: string[] = []
  if (!sketchAttached) {
    missing.push('joindre le croquis ou plan')
  }
  if (!enoughPhotos) {
    missing.push('prendre au moins 2 photos de la piece')
  }
  if (!wallCoveragePartial) {
    missing.push('couvrir au moins 2 murs de la piece')
  }
  if (!floorCovered) {
    missing.push('ajouter une photo du sol')
  }
  if (!ceilingCovered) {
    missing.push('ajouter une photo du plafond')
  }
  if (!wallCoverageComplete) {
    if (coverage.wallCoverage.length > 0 && coverage.missingWalls.length > 0) {
      missing.push(
        `completer les murs ${coverage.missingWalls.map((wall) => WALL_LABELS[wall]).join(', ')}`,
      )
    } else {
      missing.push('completer la serie des 4 murs')
    }
  }

  let status: 'insuffisant' | 'suffisant' | 'complet' = 'insuffisant'
  if (
    sketchAttached &&
    enoughPhotos &&
    wallCoveragePartial &&
    (floorCovered || ceilingCovered)
  ) {
    status = 'suffisant'
  }
  if (
    sketchAttached &&
    enoughPhotos &&
    wallCoverageComplete &&
    floorCovered &&
    ceilingCovered &&
    strongPhotoSet
  ) {
    status = 'complet'
  }

  const label =
    status === 'complet'
      ? 'Dossier visuel complet'
      : status === 'suffisant'
        ? 'Dossier visuel suffisant'
        : 'Dossier visuel insuffisant'

  const hint =
    status === 'complet'
      ? 'Le contexte visuel est bien documente pour produire un rendu client credible.'
      : status === 'suffisant'
        ? 'Le contexte visuel est exploitable, mais il reste des angles utiles a couvrir.'
        : 'Le contexte visuel manque encore d elements pour rassurer sur le rendu client.'

  return { status, score, label, hint, missing }
}

function areOppositeWalls(left: WallId, right: WallId): boolean {
  return (
    (left === 'north' && right === 'south') ||
    (left === 'south' && right === 'north') ||
    (left === 'east' && right === 'west') ||
    (left === 'west' && right === 'east')
  )
}
