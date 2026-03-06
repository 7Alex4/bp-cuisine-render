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
    <div className="mt-14 pt-8 border-t border-[#EEEEEE]">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-semibold text-[#1A1A1A]">Rendus precedents</h2>
        <button
          onClick={onClear}
          className="text-xs text-[#AAAAAA] hover:text-[#E30613] transition-colors"
        >
          Effacer l&apos;historique
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className="flex-shrink-0 w-40 text-left group"
          >
            <div className="relative w-40 h-28 bg-[#F5F5F5] rounded-[14px] overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.12)] transition-shadow duration-200">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt="Rendu precedent"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg
                    className="text-[#CCCCCC]"
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
                className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                  item.status === 'succeeded' ? 'bg-emerald-400' : 'bg-red-400'
                }`}
              />
            </div>
            <p className="text-[11px] text-[#AAAAAA] mt-2">{formatDate(item.createdAt)}</p>
            <p className="text-xs text-[#1A1A1A] font-medium truncate mt-0.5">
              {item.style || 'Sans style'}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
