'use client'

import type { HistoryItem } from '@/types'

interface Props {
  items: HistoryItem[]
  onClear: () => void
  onSelect: (item: HistoryItem) => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

export default function HistoryPanel({ items, onClear, onSelect }: Props) {
  if (items.length === 0) return null

  return (
    <div className="mt-12 pt-8 border-t border-neutral-200">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Recent Renders
        </h2>
        <button
          onClick={onClear}
          className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
        >
          Clear history
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className="flex-shrink-0 w-36 text-left group"
          >
            <div className="relative w-36 h-24 bg-neutral-100 rounded-sm overflow-hidden">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt="Past render"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg
                    className="text-neutral-300"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
              )}
              <div
                className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                  item.status === 'succeeded' ? 'bg-emerald-400' : 'bg-red-400'
                }`}
              />
            </div>
            <p className="text-[11px] text-neutral-400 mt-1.5">{formatDate(item.createdAt)}</p>
            <p className="text-xs text-neutral-700 font-medium truncate">
              {item.style || 'No style'}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
