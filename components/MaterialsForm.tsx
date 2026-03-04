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
  'block text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-2'
const inputClass =
  'w-full bg-white border border-neutral-200 rounded-sm px-4 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-[#C5A35E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const dimInputClass =
  'flex-1 bg-white border border-neutral-200 rounded-sm px-3 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-[#C5A35E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-center'

export default function MaterialsForm({ data, onChange, disabled = false }: Props) {
  const update = (key: keyof MaterialsData, value: string) =>
    onChange({ ...data, [key]: value })

  return (
    <div className="space-y-5">
      <div>
        <label className={labelClass}>Design Prompt</label>
        <textarea
          value={data.prompt}
          onChange={(e) => update('prompt', e.target.value)}
          disabled={disabled}
          placeholder="Describe the kitchen you envision — layout, atmosphere, key elements, client preferences…"
          rows={4}
          className={`${inputClass} resize-none`}
        />
      </div>

      <div>
        <label className={labelClass}>Kitchen Style</label>
        <select
          value={data.style}
          onChange={(e) => update('style', e.target.value)}
          disabled={disabled}
          className={inputClass}
        >
          <option value="">Select a style…</option>
          {STYLE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Room Dimensions (m)</label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            min="0"
            step="0.1"
            value={data.width}
            onChange={(e) => update('width', e.target.value)}
            disabled={disabled}
            placeholder="W"
            className={dimInputClass}
          />
          <span className="text-neutral-300 text-sm select-none">×</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={data.depth}
            onChange={(e) => update('depth', e.target.value)}
            disabled={disabled}
            placeholder="D"
            className={dimInputClass}
          />
          <span className="text-neutral-300 text-sm select-none">×</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={data.height}
            onChange={(e) => update('height', e.target.value)}
            disabled={disabled}
            placeholder="H"
            className={dimInputClass}
          />
          <span className="text-[11px] text-neutral-400 shrink-0 ml-1">m</span>
        </div>
        <p className="text-[11px] text-neutral-400 mt-1.5">Width × Depth × Height</p>
      </div>

      <div>
        <label className={labelClass}>Materials & Finishes</label>
        <textarea
          value={data.materials}
          onChange={(e) => update('materials', e.target.value)}
          disabled={disabled}
          placeholder="e.g. matte white lacquer cabinets, Calacatta marble countertop, brushed brass hardware, integrated Miele appliances…"
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>
    </div>
  )
}
