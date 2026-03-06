'use client'

import type { MaterialsData } from '@/types'

const STYLE_OPTIONS = [
  'Contemporary',
  'Scandinavian',
  'Industrial',
  'Minimalist',
  'Classic French',
  'Mediterranean',
  'Japandi',
  'Traditional Swiss',
  'Bauhaus',
  'Transitional',
]

interface Props {
  data: MaterialsData
  onChange: (data: MaterialsData) => void
  disabled?: boolean
}

const labelClass =
  'block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#999999] mb-2'
const inputClass =
  'w-full bg-[#FAFAFA] border border-[#E8E8E8] rounded-[10px] px-4 py-3 text-sm text-[#1A1A1A] placeholder-[#BBBBBB] focus:outline-none focus:border-[#E30613] transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const dimInputClass =
  'flex-1 bg-[#FAFAFA] border border-[#E8E8E8] rounded-[10px] px-3 py-3 text-sm text-[#1A1A1A] placeholder-[#BBBBBB] focus:outline-none focus:border-[#E30613] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-center'

export default function MaterialsForm({ data, onChange, disabled = false }: Props) {
  const update = (key: keyof MaterialsData, value: string) => onChange({ ...data, [key]: value })

  return (
    <div className="space-y-5">
      <div>
        <label className={labelClass}>Description du projet</label>
        <textarea
          value={data.prompt}
          onChange={(event) => update('prompt', event.target.value)}
          disabled={disabled}
          placeholder="Decrivez la cuisine souhaitee : ambiance, implantation, ilot, circulation, elements cles, preferences du client..."
          rows={4}
          className={`${inputClass} resize-none`}
        />
      </div>

      <div>
        <label className={labelClass}>Style de cuisine</label>
        <select
          value={data.style}
          onChange={(event) => update('style', event.target.value)}
          disabled={disabled}
          className={inputClass}
        >
          <option value="">Selectionnez un style...</option>
          {STYLE_OPTIONS.map((style) => (
            <option key={style} value={style}>
              {style}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Dimensions de la piece (m)</label>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <input
              type="number"
              min="0"
              step="0.1"
              value={data.width}
              onChange={(event) => update('width', event.target.value)}
              disabled={disabled}
              placeholder="L (m)"
              className={dimInputClass}
            />
            <p className="text-[10px] text-[#AAAAAA] mt-1 text-center">Longueur</p>
          </div>
          <div>
            <input
              type="number"
              min="0"
              step="0.1"
              value={data.depth}
              onChange={(event) => update('depth', event.target.value)}
              disabled={disabled}
              placeholder="P (m)"
              className={dimInputClass}
            />
            <p className="text-[10px] text-[#AAAAAA] mt-1 text-center">Profondeur</p>
          </div>
          <div>
            <input
              type="number"
              min="0"
              step="0.1"
              value={data.height}
              onChange={(event) => update('height', event.target.value)}
              disabled={disabled}
              placeholder="H (m)"
              className={dimInputClass}
            />
            <p className="text-[10px] text-[#AAAAAA] mt-1 text-center">Hauteur</p>
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass}>Materiaux et finitions</label>
        <textarea
          value={data.materials}
          onChange={(event) => update('materials', event.target.value)}
          disabled={disabled}
          placeholder="ex. facades laque blanc mat, plan de travail marbre Calacatta, robinetterie laiton brosse, appareils integres..."
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>
    </div>
  )
}
