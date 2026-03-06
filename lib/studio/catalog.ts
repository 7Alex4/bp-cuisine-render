import type {
  CameraMatchSpec,
  KitchenModuleSpec,
  MaterialAssignments,
  ModuleKind,
  StudioScene,
} from './schema.ts'

export interface MaterialPreset {
  id: string
  label: string
  previewColor: string
}

export interface ModuleTemplate {
  id: string
  sku: string
  label: string
  kind: ModuleKind
  width: number
  depth: number
  height: number
  elevation: number
  defaultPlacement: KitchenModuleSpec['placement']
  applianceLabel?: string | null
}

export const MATERIAL_PRESETS: MaterialPreset[] = [
  { id: 'fronts-matte-white', label: 'Facades laque mat blanc', previewColor: '#f4f2ee' },
  { id: 'fronts-warm-oak', label: 'Facades chene naturel', previewColor: '#bf9560' },
  { id: 'worktop-quartz-ivory', label: 'Quartz ivoire', previewColor: '#d8d1c6' },
  { id: 'worktop-graphite-stone', label: 'Pierre graphite', previewColor: '#575653' },
  { id: 'floor-light-oak', label: 'Parquet chene clair', previewColor: '#ccb184' },
  { id: 'floor-warm-concrete', label: 'Beton cire chaud', previewColor: '#b8aea0' },
  { id: 'walls-soft-white', label: 'Mur blanc casse', previewColor: '#f8f6f2' },
  { id: 'walls-greige', label: 'Mur greige', previewColor: '#d8d0c6' },
]

export const MODULE_TEMPLATES: ModuleTemplate[] = [
  {
    id: 'tall-oven-600',
    sku: 'BP-TALL-OVEN-600',
    label: 'Colonne fours 600',
    kind: 'tall',
    width: 0.6,
    depth: 0.62,
    height: 2.2,
    elevation: 0,
    defaultPlacement: { mode: 'wall', wall: 'north', offset: 0.2 },
    applianceLabel: 'Double four',
  },
  {
    id: 'base-hob-900',
    sku: 'BP-BASE-HOB-900',
    label: 'Bas plaque 900',
    kind: 'base',
    width: 0.9,
    depth: 0.62,
    height: 0.9,
    elevation: 0,
    defaultPlacement: { mode: 'wall', wall: 'north', offset: 0.9 },
    applianceLabel: 'Plaque induction',
  },
  {
    id: 'base-sink-900',
    sku: 'BP-BASE-SINK-900',
    label: 'Bas evier 900',
    kind: 'base',
    width: 0.9,
    depth: 0.62,
    height: 0.9,
    elevation: 0,
    defaultPlacement: { mode: 'wall', wall: 'north', offset: 1.9 },
    applianceLabel: 'Evier sous-plan',
  },
  {
    id: 'fridge-tall-600',
    sku: 'BP-TALL-FRIDGE-600',
    label: 'Colonne refrigerateur 600',
    kind: 'tall',
    width: 0.6,
    depth: 0.66,
    height: 2.2,
    elevation: 0,
    defaultPlacement: { mode: 'wall', wall: 'east', offset: 0.35 },
    applianceLabel: 'Frigo integre',
  },
  {
    id: 'wall-cab-900',
    sku: 'BP-WALL-900',
    label: 'Meuble haut 900',
    kind: 'wall',
    width: 0.9,
    depth: 0.38,
    height: 0.92,
    elevation: 1.45,
    defaultPlacement: { mode: 'wall', wall: 'north', offset: 1.9 },
  },
  {
    id: 'island-1800',
    sku: 'BP-ISLAND-1800',
    label: 'Ilot 1800',
    kind: 'island',
    width: 1.8,
    depth: 0.95,
    height: 0.9,
    elevation: 0,
    defaultPlacement: { mode: 'free', x: 0, z: 0.35, rotation: 0 },
  },
]

export const DEFAULT_MATERIAL_ASSIGNMENTS: MaterialAssignments = {
  fronts: 'fronts-matte-white',
  worktop: 'worktop-quartz-ivory',
  floor: 'floor-light-oak',
  walls: 'walls-soft-white',
}

export const DEFAULT_CAMERA_MATCH: CameraMatchSpec = {
  enabled: false,
  fov: 44,
  position: { x: 2.8, y: 1.65, z: 4.1 },
  target: { x: 0, y: 1.05, z: 0 },
  lensShiftX: 0,
  lensShiftY: 0,
}

export function getModuleTemplate(templateId: string): ModuleTemplate | undefined {
  return MODULE_TEMPLATES.find((template) => template.id === templateId)
}

export function getMaterialPreset(materialId: string): MaterialPreset | undefined {
  return MATERIAL_PRESETS.find((preset) => preset.id === materialId)
}

export function createModuleFromTemplate(
  templateId: string,
  index: number,
  overrides: Partial<KitchenModuleSpec> = {},
): KitchenModuleSpec {
  const template = getModuleTemplate(templateId)
  if (!template) {
    throw new Error(`Unknown module template: ${templateId}`)
  }

  return {
    id: overrides.id || crypto.randomUUID(),
    templateId: template.id,
    sku: template.sku,
    label: overrides.label || template.label,
    kind: template.kind,
    width: template.width,
    depth: template.depth,
    height: template.height,
    elevation: template.elevation,
    placement:
      template.defaultPlacement.mode === 'wall'
        ? {
            mode: 'wall',
            wall: template.defaultPlacement.wall,
            offset: template.defaultPlacement.offset + index * 0.05,
          }
        : {
            mode: 'free',
            x: template.defaultPlacement.x,
            z: template.defaultPlacement.z + index * 0.05,
            rotation: template.defaultPlacement.rotation,
          },
    frontsMaterialId: DEFAULT_MATERIAL_ASSIGNMENTS.fronts,
    applianceLabel: template.applianceLabel || null,
    ...overrides,
  }
}

export function createDefaultStudioScene(projectId: string, name = 'Projet cuisine'): StudioScene {
  return {
    id: projectId,
    version: 1,
    name,
    room: {
      width: 5.2,
      depth: 3.6,
      height: 2.7,
      wallThickness: 0.12,
    },
    openings: [
      {
        id: crypto.randomUUID(),
        name: 'Fenetre facade',
        wall: 'south',
        kind: 'window',
        offset: 0.6,
        width: 1.4,
        height: 1.35,
        baseHeight: 0.9,
      },
      {
        id: crypto.randomUUID(),
        name: 'Porte entree',
        wall: 'west',
        kind: 'door',
        offset: 0.35,
        width: 0.9,
        height: 2.05,
        baseHeight: 0,
      },
    ],
    modules: [
      createModuleFromTemplate('tall-oven-600', 0),
      createModuleFromTemplate('base-hob-900', 0),
      createModuleFromTemplate('base-sink-900', 0),
      createModuleFromTemplate('wall-cab-900', 0),
      createModuleFromTemplate('fridge-tall-600', 0),
      createModuleFromTemplate('island-1800', 0),
    ],
    materials: { ...DEFAULT_MATERIAL_ASSIGNMENTS },
    references: {
      sketchName: null,
      roomPhotoName: null,
    },
    cameraMatch: { ...DEFAULT_CAMERA_MATCH },
    notes:
      'Pipeline parametrique : le plan 2D et les dimensions deviennent la source de verite pour le preview 3D et le package Blender.',
  }
}
