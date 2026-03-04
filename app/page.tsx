'use client'

import { useEffect, useRef, useState } from 'react'
import Header from '@/components/Header'
import UploadZone from '@/components/UploadZone'
import MaterialsForm from '@/components/MaterialsForm'
import ProgressSection from '@/components/ProgressSection'
import ResultViewer from '@/components/ResultViewer'
import HistoryPanel from '@/components/HistoryPanel'
import { startRender, pollRender } from '@/lib/api'
import { addToHistory, clearHistory, getHistory } from '@/lib/history'
import type { HistoryItem, MaterialsData, RenderStatus } from '@/types'

// ── Polling constants ─────────────────────────────────────────────────────────
const POLL_BASE_MS = 4_000
const POLL_SLOW_INTERVAL_MS = 10_000
const POLL_MAX_BACKOFF_MS = 30_000
const POLL_MAX_NET_ERRORS = 3   // give up after 3 consecutive network errors
const POLL_SLOW_AFTER_MS = 3 * 60 * 1_000  // switch to slow poll after 3 min

const DEFAULT_MATERIALS: MaterialsData = {
  prompt: '',
  style: '',
  width: '',
  depth: '',
  height: '',
  materials: '',
}

export default function Dashboard() {
  const [roomImage, setRoomImage] = useState<File | null>(null)
  const [sketchImage, setSketchImage] = useState<File | null>(null)
  const [materials, setMaterials] = useState<MaterialsData>(DEFAULT_MATERIALS)
  const [status, setStatus] = useState<RenderStatus>('idle')
  const [renderId, setRenderId] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | undefined>()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isSlowPoll, setIsSlowPoll] = useState(false)

  // Single timer for the next scheduled poll tick
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Soft timeout — switches to slow poll mode after 3 min
  const globalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Cancels any in-flight fetch (upload OR poll)
  const abortRef = useRef<AbortController | null>(null)
  // Ref mirror of isSlowPoll to avoid stale closures in scheduleTick
  const slowRef = useRef(false)
  const resultRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHistory(getHistory())
    return () => stopAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Cancel everything in flight, clear all timers, reset slow-poll state. */
  function stopAll() {
    if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null }
    if (globalTimerRef.current) { clearTimeout(globalTimerRef.current); globalTimerRef.current = null }
    abortRef.current?.abort()
    abortRef.current = null
    slowRef.current = false
    setIsSlowPoll(false)
  }

  /**
   * Recursive, backoff-aware polling loop.
   *
   * - Each successful HTTP response (any job status) resets the error counter.
   * - Each network error doubles the delay (4 s → 8 s → 16 s).
   * - After POLL_MAX_NET_ERRORS consecutive network errors the render is marked failed.
   * - An AbortError (user cancel / unmount) exits silently.
   */
  function beginPolling(id: string, snap: MaterialsData, pollUrl?: string) {
    function saveAndRefresh(st: 'succeeded' | 'failed', imageUrl?: string) {
      addToHistory({
        id,
        createdAt: new Date().toISOString(),
        status: st,
        imageUrl,
        prompt: snap.prompt,
        style: snap.style,
      })
      setHistory(getHistory())
    }

    function scheduleTick(delayMs: number, netErrors: number) {
      pollTimerRef.current = setTimeout(async () => {
        // Grab the signal that was current when this tick was scheduled.
        // If stopAll() was called before we fired, abortRef is null → we bail.
        const signal = abortRef.current?.signal
        if (!signal || signal.aborted) return

        try {
          const job = await pollRender(id, signal, pollUrl)

          if (job.status === 'succeeded') {
            stopAll()
            setStatus('succeeded')
            setResultUrl(job.outputUrl ?? null)
            saveAndRefresh('succeeded', job.outputUrl)
            setTimeout(
              () => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
              100,
            )
          } else if (job.status === 'failed') {
            stopAll()
            setStatus('failed')
            setErrorMsg(job.error ?? 'The render failed. Please check your inputs and try again.')
            saveAndRefresh('failed')
          } else {
            // 'pending' | 'processing' → still running; schedule next tick
            const base = slowRef.current ? POLL_SLOW_INTERVAL_MS : POLL_BASE_MS
            scheduleTick(base, 0)
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return

          const nextErrors = netErrors + 1
          if (nextErrors >= POLL_MAX_NET_ERRORS) {
            stopAll()
            setStatus('failed')
            setErrorMsg(
              err instanceof Error
                ? `Network error: ${err.message}`
                : 'Lost connection while checking render status.',
            )
            return
          }
          // Exponential backoff, capped; respect slow-poll base
          const base = slowRef.current ? POLL_SLOW_INTERVAL_MS : POLL_BASE_MS
          const backoff = Math.min(base * 2 ** nextErrors, POLL_MAX_BACKOFF_MS)
          scheduleTick(backoff, nextErrors)
        }
      }, delayMs)
    }

    // Soft timeout — switch to slow-poll mode; user can still cancel
    globalTimerRef.current = setTimeout(() => {
      slowRef.current = true
      setIsSlowPoll(true)
    }, POLL_SLOW_AFTER_MS)

    scheduleTick(POLL_BASE_MS, 0)
  }

  async function handleGenerate() {
    if (!roomImage || !sketchImage) return
    if (status === 'uploading' || status === 'processing') return

    stopAll()

    // Fresh controller for this entire job (upload + all poll ticks share it)
    abortRef.current = new AbortController()
    const { signal } = abortRef.current

    setStatus('uploading')
    setErrorMsg(undefined)
    setResultUrl(null)
    setRenderId(null)

    const fd = new FormData()
    fd.append('room', roomImage)
    fd.append('sketch', sketchImage)
    fd.append('prompt', materials.prompt)
    fd.append('style', materials.style)
    fd.append('dimensions', JSON.stringify({
      width: parseFloat(materials.width) || 0,
      depth: parseFloat(materials.depth) || 0,
      height: parseFloat(materials.height) || 0,
    }))
    fd.append('materials', JSON.stringify({ description: materials.materials }))

    try {
      const start = await startRender(fd, signal)
      setRenderId(start.id)

      // Backend may return an immediate terminal state (rare but valid)
      if (start.status === 'succeeded') {
        setStatus('succeeded')
        setResultUrl(start.outputUrl ?? null)
        addToHistory({
          id: start.id,
          createdAt: new Date().toISOString(),
          status: 'succeeded',
          imageUrl: start.outputUrl,
          prompt: materials.prompt,
          style: materials.style,
        })
        setHistory(getHistory())
        abortRef.current = null
        return
      }

      if (start.status === 'failed') {
        setStatus('failed')
        setErrorMsg(start.error ?? 'Render failed immediately. Please try again.')
        addToHistory({
          id: start.id,
          createdAt: new Date().toISOString(),
          status: 'failed',
          prompt: materials.prompt,
          style: materials.style,
        })
        setHistory(getHistory())
        abortRef.current = null
        return
      }

      // 'pending' | 'processing' → enter polling loop
      setStatus('processing')
      beginPolling(start.id, materials, start.pollUrl)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setStatus('failed')
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to start render. Check your connection.',
      )
    }
  }

  /** User-initiated cancel during upload or polling. */
  function handleCancel() {
    stopAll()
    setStatus('idle')
    setErrorMsg(undefined)
  }

  function handleRegenerate() {
    stopAll()
    setStatus('idle')
    setResultUrl(null)
    setRenderId(null)
    setErrorMsg(undefined)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleHistorySelect(item: HistoryItem) {
    if (!item.imageUrl) return
    setResultUrl(item.imageUrl)
    setRenderId(item.id)
    setStatus('succeeded')
    setTimeout(
      () => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      50,
    )
  }

  function handleClearHistory() {
    clearHistory()
    setHistory([])
  }

  const isBusy = status === 'uploading' || status === 'processing'
  const canGenerate = !!roomImage && !!sketchImage && !isBusy

  return (
    <div className="min-h-screen bg-[#F5F4F1]">
      <Header />

      <main className="max-w-4xl mx-auto px-5 sm:px-6 py-10 pb-24">
        {/* Page heading */}
        <div className="mb-8">
          <h2 className="text-2xl font-light tracking-tight text-[#1A1A1A]">New Render</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Upload your room photo and floor sketch, then describe the kitchen you envision.
          </p>
        </div>

        <div className="space-y-6">
          {/* ── Upload row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500 mb-2">
                Room Photo
              </p>
              <UploadZone
                label="Empty kitchen space"
                sublabel="JPG or PNG · up to 20 MB"
                icon={<RoomIcon />}
                capture="environment"
                file={roomImage}
                onFile={setRoomImage}
                disabled={isBusy}
              />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500 mb-2">
                2D Sketch
              </p>
              <UploadZone
                label="Floor plan or hand drawing"
                sublabel="JPG or PNG · up to 20 MB"
                icon={<SketchIcon />}
                capture="environment"
                file={sketchImage}
                onFile={setSketchImage}
                disabled={isBusy}
              />
            </div>
          </div>

          {/* ── Design specifications ── */}
          <div className="bg-white rounded-sm border border-neutral-100 px-6 py-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500 mb-5">
              Design Specifications
            </h3>
            <MaterialsForm data={materials} onChange={setMaterials} disabled={isBusy} />
          </div>

          {/* ── Upload hint ── */}
          {(!roomImage || !sketchImage) && status === 'idle' && (
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <InfoIcon />
              {!roomImage && !sketchImage
                ? 'Upload a room photo and a 2D sketch to get started.'
                : !roomImage
                  ? 'A room photo is still required.'
                  : 'A 2D sketch is still required.'}
            </div>
          )}

          {/* ── Generate / Cancel buttons ── */}
          <div className="flex items-center justify-end gap-3">
            {isBusy && (
              <button
                onClick={handleCancel}
                className="px-5 py-3 text-sm font-medium text-neutral-500 border border-neutral-200 rounded-sm hover:border-neutral-400 hover:text-neutral-700 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={[
                'px-8 py-3 text-sm font-semibold tracking-wide rounded-sm transition-all duration-200',
                canGenerate
                  ? 'bg-[#0A0A0A] text-white hover:bg-neutral-800 active:scale-[0.98]'
                  : 'bg-neutral-200 text-neutral-400 cursor-not-allowed',
              ].join(' ')}
            >
              {isBusy ? (
                <span className="flex items-center gap-2">
                  <SpinnerIcon />
                  Rendering…
                </span>
              ) : (
                'Generate 4K Render'
              )}
            </button>
          </div>

          {/* ── Progress ── */}
          {status !== 'idle' && (
            <div className="transition-all duration-300">
              <ProgressSection status={status} error={errorMsg} slowPoll={isSlowPoll} />
            </div>
          )}

          {/* ── Result ── */}
          {status === 'succeeded' && resultUrl && renderId && (
            <div ref={resultRef}>
              <ResultViewer
                imageUrl={resultUrl}
                renderId={renderId}
                onRegenerate={handleRegenerate}
              />
            </div>
          )}
        </div>

        {/* ── History ── */}
        <HistoryPanel
          items={history}
          onClear={handleClearHistory}
          onSelect={handleHistorySelect}
        />
      </main>
    </div>
  )
}

// ── Inline SVG icons ─────────────────────────────────────────────────────────

function RoomIcon() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <path d="M3 9.5L12 3l9 6.5V21H3V9.5z" />
      <path d="M9 21V13h6v8" />
    </svg>
  )
}

function SketchIcon() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <path d="M7 7h2v2H7zM7 13h2v2H7z" />
      <path d="M12 7h5M12 10h5M12 13h5M12 16h5" />
      <line x1="3" y1="11" x2="21" y2="11" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg
      className="animate-spin"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}
