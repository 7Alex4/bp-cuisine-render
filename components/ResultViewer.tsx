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
      const a = document.createElement('a')
      a.href = url
      a.download = `bp-cuisine-${renderId}.jpg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // Fallback: open in new tab
      window.open(imageUrl, '_blank', 'noopener,noreferrer')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <div className="bg-white rounded-sm border border-neutral-100 overflow-hidden">
        {/* Image */}
        <div
          className="relative bg-neutral-900 cursor-zoom-in group"
          onClick={() => setIsFullscreen(true)}
        >
          <img
            src={imageUrl}
            alt="Kitchen render"
            className="w-full object-contain max-h-[560px]"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          <div className="absolute bottom-3 right-3 bg-black/50 text-white/80 text-[10px] px-2 py-1 rounded-sm tracking-wide opacity-0 group-hover:opacity-100 transition-opacity">
            Click to expand
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-neutral-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <p className="text-sm font-medium text-neutral-800">Render Complete</p>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5 font-mono">ID: {renderId}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onRegenerate}
              className="px-4 py-2 text-xs font-semibold tracking-wide uppercase border border-neutral-200 rounded-sm text-neutral-600 hover:border-neutral-400 hover:text-neutral-800 transition-colors"
            >
              Regenerate with adjustments
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="px-5 py-2 text-xs font-semibold tracking-wide uppercase bg-[#0A0A0A] text-white rounded-sm hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {downloading ? 'Downloading…' : 'Download 4K'}
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setIsFullscreen(false)}
        >
          <img
            src={imageUrl}
            alt="Kitchen render fullscreen"
            className="max-w-full max-h-full object-contain"
          />
          <button
            className="absolute top-5 right-5 text-white/60 hover:text-white text-2xl transition-colors leading-none"
            onClick={() => setIsFullscreen(false)}
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}
