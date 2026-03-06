'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Header from '@/components/Header'
import { pollRender } from '@/lib/api'
import type { RenderStatus } from '@/types'

const POLL_INTERVAL_MS = 3_000
const POLL_MAX_NET_ERRORS = 3

export default function ResultPage() {
  const { id } = useParams<{ id: string }>()

  const [status, setStatus] = useState<RenderStatus>('processing')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | undefined>()
  const [downloading, setDownloading] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    scheduleTick(controller.signal, POLL_INTERVAL_MS, 0)

    return () => {
      controller.abort()
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function scheduleTick(signal: AbortSignal, delayMs: number, netErrors: number) {
    pollTimerRef.current = setTimeout(async () => {
      if (signal.aborted) return

      try {
        const job = await pollRender(id, signal)

        if (job.status === 'succeeded') {
          if (!job.outputUrl) {
            setStatus('failed')
            setErrorMsg("Le rendu a reussi mais le serveur n'a retourne aucune URL d'image.")
            return
          }
          setStatus('succeeded')
          setImageUrl(job.outputUrl)
          return
        }

        if (job.status === 'failed') {
          setStatus('failed')
          setErrorMsg(job.error ?? 'Le rendu a echoue. Veuillez reessayer.')
          return
        }

        scheduleTick(signal, POLL_INTERVAL_MS, 0)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return

        const nextErrors = netErrors + 1
        if (nextErrors >= POLL_MAX_NET_ERRORS) {
          setStatus('failed')
          setErrorMsg(
            error instanceof Error
              ? `Erreur reseau : ${error.message}`
              : 'Connexion perdue lors de la verification du statut.',
          )
          return
        }

        scheduleTick(signal, POLL_INTERVAL_MS * 2, nextErrors)
      }
    }, delayMs)
  }

  async function handleDownload() {
    if (!imageUrl) return
    setDownloading(true)

    try {
      const res = await fetch(imageUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `bp-cuisine-${id}.jpg`
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

  const pageTitle =
    status === 'processing'
      ? 'Generation en cours...'
      : status === 'succeeded'
        ? 'Rendu genere'
        : 'Rendu echoue'

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <Header />

      <main className="max-w-[1100px] mx-auto px-5 sm:px-10 py-12 pb-24">
        <div className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#999999] mb-1">
            Resultat du rendu
          </p>
          <h1 className="text-[24px] font-bold text-[#1A1A1A]">{pageTitle}</h1>
          <p className="text-[11px] text-[#AAAAAA] font-mono mt-1">#{id.slice(-8)}</p>
        </div>

        <div className="bg-white rounded-[20px] shadow-[0_10px_30px_rgba(0,0,0,0.08)] overflow-hidden">
          {status === 'processing' && <ProcessingState />}
          {status === 'succeeded' && imageUrl && (
            <SucceededState imageUrl={imageUrl} onZoom={() => setIsFullscreen(true)} />
          )}
          {status === 'failed' && <FailedState error={errorMsg} />}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/"
            className="px-6 py-3 text-sm font-medium text-[#555555] border border-[#E0E0E0] bg-white rounded-[14px] hover:border-[#AAAAAA] hover:text-[#1A1A1A] transition-all duration-200"
          >
            Creer un nouveau rendu
          </Link>

          {status === 'succeeded' && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="px-8 py-3 text-sm font-semibold bg-[#111111] text-white rounded-[14px] hover:bg-[#333333] active:scale-[0.98] transition-all duration-200 disabled:opacity-60 flex items-center gap-2"
            >
              {downloading ? (
                <>
                  <SpinnerIcon />
                  Telechargement...
                </>
              ) : (
                <>
                  <DownloadIcon />
                  Telecharger l&apos;image
                </>
              )}
            </button>
          )}
        </div>
      </main>

      {isFullscreen && imageUrl && (
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
    </div>
  )
}

function ProcessingState() {
  return (
    <div className="min-h-[480px] flex flex-col items-center justify-center text-center p-10">
      <div className="w-16 h-16 rounded-full border-[3px] border-[#E30613] border-t-transparent animate-spin mb-6" />
      <p className="text-lg font-semibold text-[#1A1A1A]">Generation du rendu en cours...</p>
      <p className="text-sm text-[#AAAAAA] mt-2">Cela peut prendre quelques minutes</p>
    </div>
  )
}

function SucceededState({ imageUrl, onZoom }: { imageUrl: string; onZoom: () => void }) {
  return (
    <div className="relative bg-[#111111] cursor-zoom-in group" onClick={onZoom}>
      <img
        src={imageUrl}
        alt="Rendu cuisine"
        className="w-full object-contain max-h-[620px]"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors" />
      <div className="absolute bottom-3 right-3 bg-black/60 text-white/90 text-[10px] px-3 py-1.5 rounded-full tracking-wide opacity-0 group-hover:opacity-100 transition-opacity">
        Cliquez pour agrandir
      </div>
    </div>
  )
}

function FailedState({ error }: { error?: string }) {
  return (
    <div className="min-h-[320px] flex flex-col items-center justify-center text-center p-10">
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-5">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E30613" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
      <p className="text-base font-semibold text-[#1A1A1A]">Le rendu a echoue</p>
      {error && <p className="text-sm text-[#777777] mt-2 max-w-md leading-relaxed">{error}</p>}
    </div>
  )
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  )
}
