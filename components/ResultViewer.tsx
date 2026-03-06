'use client'

import { useState } from 'react'

interface Props {
  imageUrl: string
  renderId: string
  onRegenerate: () => void
}

export default function ResultViewer({ imageUrl, renderId, onRegenerate }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await fetch(imageUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `bp-cuisine-${renderId}.jpg`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } catch {
      window.open(imageUrl, '_blank', 'noopener,noreferrer')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <div className="bg-white rounded-[20px] overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
        <div className="px-6 pt-5 pb-3 flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <p className="text-sm font-semibold text-[#1A1A1A]">Rendu genere</p>
          <p className="text-[11px] text-[#AAAAAA] font-mono ml-auto">#{renderId.slice(-8)}</p>
        </div>

        <div
          className="relative bg-[#111111] cursor-zoom-in group"
          onClick={() => setIsFullscreen(true)}
        >
          <img
            src={imageUrl}
            alt="Rendu cuisine"
            className="w-full object-contain max-h-[520px] transition-opacity duration-300"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors" />
          <div className="absolute bottom-3 right-3 bg-black/60 text-white/90 text-[10px] px-3 py-1.5 rounded-full tracking-wide opacity-0 group-hover:opacity-100 transition-opacity">
            Cliquez pour agrandir
          </div>
        </div>

        <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#F5F5F5]">
          <button
            onClick={onRegenerate}
            className="px-5 py-2.5 text-sm font-medium text-[#555555] border border-[#E0E0E0] rounded-[12px] hover:border-[#AAAAAA] hover:text-[#1A1A1A] transition-all duration-200"
          >
            Nouveau rendu
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="px-6 py-2.5 text-sm font-semibold bg-[#111111] text-white rounded-[12px] hover:bg-[#333333] active:scale-[0.98] transition-all duration-200 disabled:opacity-60 flex items-center gap-2"
          >
            {downloading ? (
              <>
                <svg
                  className="animate-spin"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
                </svg>
                Telechargement...
              </>
            ) : (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Telecharger
              </>
            )}
          </button>
        </div>
      </div>

      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setIsFullscreen(false)}
        >
          <img
            src={imageUrl}
            alt="Rendu cuisine plein ecran"
            className="max-w-full max-h-full object-contain"
          />
          <button
            aria-label="Fermer"
            className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onClick={() => setIsFullscreen(false)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="1" y1="1" x2="13" y2="13" />
              <line x1="13" y1="1" x2="1" y2="13" />
            </svg>
          </button>
        </div>
      )}
    </>
  )
}
