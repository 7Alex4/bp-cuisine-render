'use client'

import {
  MATERIAL_PRESETS,
  MODULE_TEMPLATES,
  createModuleFromTemplate,
} from '@/lib/studio/catalog'
import type { Dispatch, SetStateAction } from 'react'
import type { KitchenModuleSpec, OpeningKind, OpeningSpec, StudioScene, WallId } from '@/lib/studio/schema'

const WALL_OPTIONS: { id: WallId; label: string }[] = [
  { id: 'north', label: 'Nord' },
  { id: 'east', label: 'Est' },
  { id: 'south', label: 'Sud' },
  { id: 'west', label: 'Ouest' },
]

export default function StudioFormPanel({
  scene,
  setScene,
}: {
  scene: StudioScene
  setScene: Dispatch<SetStateAction<StudioScene | null>>
}) {
  function updateRoom<K extends keyof StudioScene['room']>(key: K, value: number) {
    setScene((current) => (current ? { ...current, room: { ...current.room, [key]: value } } : current))
  }

  function updateMaterial<K extends keyof StudioScene['materials']>(key: K, value: string) {
    setScene((current) =>
      current ? { ...current, materials: { ...current.materials, [key]: value } } : current,
    )
  }

  function updateCameraNumber<K extends keyof StudioScene['cameraMatch']>(
    key: K,
    value: StudioScene['cameraMatch'][K],
  ) {
    setScene((current) =>
      current ? { ...current, cameraMatch: { ...current.cameraMatch, [key]: value } } : current,
    )
  }

  function updateCameraVector(key: 'position' | 'target', axis: 'x' | 'y' | 'z', value: number) {
    setScene((current) =>
      current
        ? {
            ...current,
            cameraMatch: {
              ...current.cameraMatch,
              [key]: { ...current.cameraMatch[key], [axis]: value },
            },
          }
        : current,
    )
  }

  function addOpening(kind: OpeningKind) {
    const opening: OpeningSpec = {
      id: crypto.randomUUID(),
      name: kind === 'door' ? 'Nouvelle porte' : 'Nouvelle fenetre',
      kind,
      wall: 'north',
      offset: 0.3,
      width: kind === 'door' ? 0.9 : 1.2,
      height: kind === 'door' ? 2.05 : 1.2,
      baseHeight: kind === 'door' ? 0 : 0.95,
    }
    setScene((current) => (current ? { ...current, openings: [...current.openings, opening] } : current))
  }

  function updateOpening(id: string, patch: Partial<OpeningSpec>) {
    setScene((current) =>
      current
        ? {
            ...current,
            openings: current.openings.map((opening) =>
              opening.id === id ? { ...opening, ...patch } : opening,
            ),
          }
        : current,
    )
  }

  function removeOpening(id: string) {
    setScene((current) =>
      current ? { ...current, openings: current.openings.filter((opening) => opening.id !== id) } : current,
    )
  }

  function addModule(templateId: string) {
    setScene((current) =>
      current
        ? {
            ...current,
            modules: [...current.modules, createModuleFromTemplate(templateId, current.modules.length)],
          }
        : current,
    )
  }

  function updateModule(id: string, patch: Partial<KitchenModuleSpec>) {
    setScene((current) =>
      current
        ? {
            ...current,
            modules: current.modules.map((moduleSpec) =>
              moduleSpec.id === id ? { ...moduleSpec, ...patch } : moduleSpec,
            ),
          }
        : current,
    )
  }

  function updateModulePlacement(
    id: string,
    patch:
      | { mode: 'wall'; wall?: WallId; offset?: number }
      | { mode: 'free'; x?: number; z?: number; rotation?: number },
  ) {
    setScene((current) =>
      current
        ? {
            ...current,
            modules: current.modules.map((moduleSpec) => {
              if (moduleSpec.id !== id) return moduleSpec

              if (patch.mode === 'wall') {
                const currentWall =
                  moduleSpec.placement.mode === 'wall'
                    ? moduleSpec.placement
                    : { mode: 'wall' as const, wall: 'north' as WallId, offset: 0 }

                return {
                  ...moduleSpec,
                  placement: {
                    mode: 'wall',
                    wall: patch.wall ?? currentWall.wall,
                    offset: patch.offset ?? currentWall.offset,
                  },
                }
              }

              const currentFree =
                moduleSpec.placement.mode === 'free'
                  ? moduleSpec.placement
                  : { mode: 'free' as const, x: 0, z: 0, rotation: 0 }

              return {
                ...moduleSpec,
                placement: {
                  mode: 'free',
                  x: patch.x ?? currentFree.x,
                  z: patch.z ?? currentFree.z,
                  rotation: patch.rotation ?? currentFree.rotation,
                },
              }
            }),
          }
        : current,
    )
  }

  function removeModule(id: string) {
    setScene((current) =>
      current
        ? { ...current, modules: current.modules.filter((moduleSpec) => moduleSpec.id !== id) }
        : current,
    )
  }

  return (
    <section className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6">
      <Card title="Piece et ouvertures" subtitle="Metres reels et percements">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Largeur (m)" value={scene.room.width} onChange={(value) => updateRoom('width', value)} />
            <NumberField label="Profondeur (m)" value={scene.room.depth} onChange={(value) => updateRoom('depth', value)} />
            <NumberField label="Hauteur (m)" value={scene.room.height} onChange={(value) => updateRoom('height', value)} />
            <NumberField label="Epaisseur mur (m)" value={scene.room.wallThickness} onChange={(value) => updateRoom('wallThickness', value)} step={0.01} />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-semibold text-[#201d1e]">Ouvertures</h3>
              <div className="flex gap-2">
                <SmallAction onClick={() => addOpening('door')}>Ajouter porte</SmallAction>
                <SmallAction onClick={() => addOpening('window')}>Ajouter fenetre</SmallAction>
              </div>
            </div>

            <div className="space-y-3">
              {scene.openings.map((opening) => (
                <div key={opening.id} className="rounded-[20px] border border-[#ebe1d5] bg-[#faf7f2] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <input
                      value={opening.name}
                      onChange={(event) => updateOpening(opening.id, { name: event.target.value })}
                      className="w-full rounded-[12px] border border-[#e1d4c4] bg-white px-3 py-2 text-sm"
                    />
                    <button onClick={() => removeOpening(opening.id)} className="text-xs text-[#9b5143] font-semibold">
                      Supprimer
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <SelectField label="Mur" value={opening.wall} onChange={(value) => updateOpening(opening.id, { wall: value as WallId })} options={WALL_OPTIONS} />
                    <SelectField
                      label="Type"
                      value={opening.kind}
                      onChange={(value) => updateOpening(opening.id, { kind: value as OpeningKind })}
                      options={[
                        { id: 'door', label: 'Porte' },
                        { id: 'window', label: 'Fenetre' },
                      ]}
                    />
                    <NumberField label="Offset (m)" value={opening.offset} onChange={(value) => updateOpening(opening.id, { offset: value })} />
                    <NumberField label="Largeur (m)" value={opening.width} onChange={(value) => updateOpening(opening.id, { width: value })} />
                    <NumberField label="Hauteur (m)" value={opening.height} onChange={(value) => updateOpening(opening.id, { height: value })} />
                    <NumberField label="Allege (m)" value={opening.baseHeight} onChange={(value) => updateOpening(opening.id, { baseHeight: value })} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        <Card title="Catalogue BP et implantation" subtitle="Modules parametrables">
          <div className="flex flex-wrap gap-2 mb-5">
            {MODULE_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => addModule(template.id)}
                className="rounded-full border border-[#e0d4c4] bg-[#faf7f2] px-4 py-2 text-xs font-semibold text-[#201d1e]"
              >
                {template.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {scene.modules.map((moduleSpec) => (
              <div key={moduleSpec.id} className="rounded-[20px] border border-[#ebe1d5] bg-[#faf7f2] p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <input
                    value={moduleSpec.label}
                    onChange={(event) => updateModule(moduleSpec.id, { label: event.target.value })}
                    className="w-full rounded-[12px] border border-[#e1d4c4] bg-white px-3 py-2 text-sm"
                  />
                  <button onClick={() => removeModule(moduleSpec.id)} className="text-xs text-[#9b5143] font-semibold">
                    Supprimer
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <NumberField label="Largeur" value={moduleSpec.width} onChange={(value) => updateModule(moduleSpec.id, { width: value })} />
                  <NumberField label="Profondeur" value={moduleSpec.depth} onChange={(value) => updateModule(moduleSpec.id, { depth: value })} />
                  <NumberField label="Hauteur" value={moduleSpec.height} onChange={(value) => updateModule(moduleSpec.id, { height: value })} />
                  <NumberField label="Elevation" value={moduleSpec.elevation} onChange={(value) => updateModule(moduleSpec.id, { elevation: value })} />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <SelectField
                    label="Mode"
                    value={moduleSpec.placement.mode}
                    onChange={(value) =>
                      updateModulePlacement(
                        moduleSpec.id,
                        value === 'wall'
                          ? { mode: 'wall', wall: 'north', offset: 0.3 }
                          : { mode: 'free', x: 0, z: 0, rotation: 0 },
                      )
                    }
                    options={[
                      { id: 'wall', label: 'Contre mur' },
                      { id: 'free', label: 'Libre' },
                    ]}
                  />

                  {moduleSpec.placement.mode === 'wall' ? (
                    <>
                      <SelectField label="Mur" value={moduleSpec.placement.wall} onChange={(value) => updateModulePlacement(moduleSpec.id, { mode: 'wall', wall: value as WallId })} options={WALL_OPTIONS} />
                      <NumberField label="Offset" value={moduleSpec.placement.offset} onChange={(value) => updateModulePlacement(moduleSpec.id, { mode: 'wall', offset: value })} />
                      <SelectField
                        label="Facades"
                        value={moduleSpec.frontsMaterialId || scene.materials.fronts}
                        onChange={(value) => updateModule(moduleSpec.id, { frontsMaterialId: value })}
                        options={MATERIAL_PRESETS.filter((preset) => preset.id.startsWith('fronts-')).map((preset) => ({ id: preset.id, label: preset.label }))}
                      />
                    </>
                  ) : (
                    <>
                      <NumberField label="X" value={moduleSpec.placement.x} onChange={(value) => updateModulePlacement(moduleSpec.id, { mode: 'free', x: value })} />
                      <NumberField label="Z" value={moduleSpec.placement.z} onChange={(value) => updateModulePlacement(moduleSpec.id, { mode: 'free', z: value })} />
                      <NumberField label="Rotation" value={(moduleSpec.placement.rotation * 180) / Math.PI} onChange={(value) => updateModulePlacement(moduleSpec.id, { mode: 'free', rotation: (value * Math.PI) / 180 })} />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Materiaux et camera" subtitle="Parite preview / Blender">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SelectField
              label="Facades"
              value={scene.materials.fronts}
              onChange={(value) => updateMaterial('fronts', value)}
              options={MATERIAL_PRESETS.filter((preset) => preset.id.startsWith('fronts-')).map((preset) => ({ id: preset.id, label: preset.label }))}
            />
            <SelectField
              label="Plan de travail"
              value={scene.materials.worktop}
              onChange={(value) => updateMaterial('worktop', value)}
              options={MATERIAL_PRESETS.filter((preset) => preset.id.startsWith('worktop-')).map((preset) => ({ id: preset.id, label: preset.label }))}
            />
            <SelectField
              label="Sol"
              value={scene.materials.floor}
              onChange={(value) => updateMaterial('floor', value)}
              options={MATERIAL_PRESETS.filter((preset) => preset.id.startsWith('floor-')).map((preset) => ({ id: preset.id, label: preset.label }))}
            />
            <SelectField
              label="Murs"
              value={scene.materials.walls}
              onChange={(value) => updateMaterial('walls', value)}
              options={MATERIAL_PRESETS.filter((preset) => preset.id.startsWith('walls-')).map((preset) => ({ id: preset.id, label: preset.label }))}
            />
          </div>

          <div className="mt-5 rounded-[20px] border border-[#ebe1d5] bg-[#faf7f2] p-4 space-y-3">
            <label className="flex items-center gap-3 text-sm font-medium text-[#201d1e]">
              <input type="checkbox" checked={scene.cameraMatch.enabled} onChange={(event) => updateCameraNumber('enabled', event.target.checked)} />
              Activer camera match photo
            </label>

            <div className="grid grid-cols-3 gap-3">
              <NumberField label="Cam X" value={scene.cameraMatch.position.x} onChange={(value) => updateCameraVector('position', 'x', value)} />
              <NumberField label="Cam Y" value={scene.cameraMatch.position.y} onChange={(value) => updateCameraVector('position', 'y', value)} />
              <NumberField label="Cam Z" value={scene.cameraMatch.position.z} onChange={(value) => updateCameraVector('position', 'z', value)} />
              <NumberField label="Target X" value={scene.cameraMatch.target.x} onChange={(value) => updateCameraVector('target', 'x', value)} />
              <NumberField label="Target Y" value={scene.cameraMatch.target.y} onChange={(value) => updateCameraVector('target', 'y', value)} />
              <NumberField label="Target Z" value={scene.cameraMatch.target.z} onChange={(value) => updateCameraVector('target', 'z', value)} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <NumberField label="FOV" value={scene.cameraMatch.fov} onChange={(value) => updateCameraNumber('fov', value)} step={1} />
              <NumberField label="Lens shift X" value={scene.cameraMatch.lensShiftX} onChange={(value) => updateCameraNumber('lensShiftX', value)} step={0.01} />
              <NumberField label="Lens shift Y" value={scene.cameraMatch.lensShiftY} onChange={(value) => updateCameraNumber('lensShiftY', value)} step={0.01} />
            </div>
          </div>
        </Card>
      </div>
    </section>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[28px] border border-[#ece4d8] p-6 shadow-[0_16px_40px_rgba(36,31,32,0.06)]">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#8f857d]">{subtitle}</p>
      <h2 className="text-[22px] font-semibold text-[#201d1e] mt-2 mb-5">{title}</h2>
      {children}
    </div>
  )
}

function SmallAction({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-full bg-[#201d1e] px-3 py-1.5 text-[11px] font-semibold text-white">
      {children}
    </button>
  )
}

function NumberField({ label, value, onChange, step = 0.05 }: { label: string; value: number; onChange: (value: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-[0.16em] text-[#8f857d] mb-2">{label}</span>
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

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { id: string; label: string }[] }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-[0.16em] text-[#8f857d] mb-2">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-[14px] border border-[#e1d4c4] bg-white px-3 py-2.5 text-sm">
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
