'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import DebugPanel from '@/components/DebugPanel'
import Header from '@/components/Header'
import MaterialsForm from '@/components/MaterialsForm'
import UploadZone from '@/components/UploadZone'
import { startRender } from '@/lib/api'
import { prepareRoomImage, prepareSketchImage } from '@/lib/client/image-processing'
import { parseLocaleNumber } from '@/lib/inputs'
import type { MaterialsData } from '@/types'

const DEFAULT_MATERIALS: MaterialsData = {
  prompt: '',
  style: '',
  width: '',
  depth: '',
  height: '',
  materials: '',
}

export default function ConfigPage() {
  const router = useRouter()
  const [roomImage, setRoomImage] = useState<File | null>(null)
  const [sketchImage, setSketchImage] = useState<File | null>(null)
  const [materials, setMaterials] = useState<MaterialsData>(DEFAULT_MATERIALS)
  const [isUploading, setIsUploading] = useState(false)
  const [pendingPreparations, setPendingPreparations] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | undefined>()
  const abortRef = useRef<AbortController | null>(null)
  const isPreparingFiles = pendingPreparations > 0

  const canGenerate = !!roomImage && !!sketchImage && !isUploading && !isPreparingFiles

  function appendSharedFields(formData: FormData) {
    formData.append('prompt', materials.prompt)
    formData.append('style', materials.style)
    formData.append(
      'dimensions',
      JSON.stringify({
        width: parseLocaleNumber(materials.width),
        depth: parseLocaleNumber(materials.depth),
        height: parseLocaleNumber(materials.height),
      }),
    )
    formData.append('materials', JSON.stringify({ description: materials.materials }))
  }

  async function handleGenerate() {
    if (!canGenerate) return

    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const { signal } = abortRef.current

    setIsUploading(true)
    setErrorMsg(undefined)

    const formData = new FormData()
    formData.append('room', roomImage!)
    formData.append('sketch', sketchImage!)
    appendSharedFields(formData)

    try {
      const start = await startRender(formData, signal)

      if (!start?.id || !start?.status) {
        setErrorMsg(
          `Reponse inattendue du serveur - attendu {id, status}. Recu : ${JSON.stringify(start)}`,
        )
        setIsUploading(false)
        return
      }

      router.push(`/result/${start.id}`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Echec du demarrage du rendu. Verifiez votre connexion.',
      )
      setIsUploading(false)
    }
  }

  function handleCancel() {
    abortRef.current?.abort()
    abortRef.current = null
    setIsUploading(false)
    setErrorMsg(undefined)
  }

  async function handleRoomFile(nextFile: File | null) {
    if (!nextFile) {
      setRoomImage(null)
      return
    }

    setPendingPreparations((value) => value + 1)
    try {
      setRoomImage(await prepareRoomImage(nextFile))
    } catch (error) {
      console.error('[page] room preprocessing failed, using original file:', error)
      setRoomImage(nextFile)
    } finally {
      setPendingPreparations((value) => value - 1)
    }
  }

  async function handleSketchFile(nextFile: File | null) {
    if (!nextFile) {
      setSketchImage(null)
      return
    }

    setPendingPreparations((value) => value + 1)
    try {
      setSketchImage(await prepareSketchImage(nextFile))
    } catch (error) {
      console.error('[page] sketch preprocessing failed, using original file:', error)
      setSketchImage(nextFile)
    } finally {
      setPendingPreparations((value) => value - 1)
    }
  }

  async function debugStartTest(): Promise<unknown> {
    if (!roomImage || !sketchImage) {
      return { _error: 'Upload both the room image and the sketch before running the test.' }
    }

    const formData = new FormData()
    formData.append('room', roomImage)
    formData.append('sketch', sketchImage)
    appendSharedFields(formData)

    try {
      const res = await fetch('/api/render/start', {
        method: 'POST',
        body: formData,
        cache: 'no-store',
      })
      const body = await res.json().catch(async () => ({
        _raw: await res.text().catch(() => '(unreadable)'),
      }))
      return { _http: res.status, ...(body && typeof body === 'object' ? body : { _body: body }) }
    } catch (error) {
      return { _error: String(error) }
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <Header />

      <main className="max-w-[900px] mx-auto px-5 sm:px-8 py-12 pb-24">
        <div className="mb-10 text-center">
          <h1 className="text-[28px] font-bold text-[#1A1A1A] leading-tight">
            Creer un rendu cuisine
          </h1>
          <p className="text-sm text-[#777777] mt-2">
            Importez la photo de la piece et un croquis 2D pour guider le rendu.
          </p>
        </div>

        <div className="space-y-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#999999] mb-3">
              Fichiers source
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#999999] mb-2">
                  Photo de la piece
                </p>
                <UploadZone
                  label="Espace cuisine vide"
                  sublabel="JPG ou PNG - 20 Mo max - rotation corrigee automatiquement"
                  icon={<RoomIcon />}
                  capture="environment"
                  file={roomImage}
                  onFile={handleRoomFile}
                  disabled={isUploading || isPreparingFiles}
                />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#999999] mb-2">
                  Croquis 2D
                </p>
                <UploadZone
                  label="Plan ou dessin a main levee"
                  sublabel="Requis - nettoye en noir et blanc pour mieux guider l'implantation"
                  icon={<SketchIcon />}
                  capture="environment"
                  file={sketchImage}
                  onFile={handleSketchFile}
                  disabled={isUploading || isPreparingFiles}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[20px] shadow-[0_10px_30px_rgba(0,0,0,0.07)] px-6 py-6">
            <h3 className="text-[18px] font-semibold text-[#1A1A1A] mb-6">
              Configuration de la cuisine
            </h3>
            <MaterialsForm data={materials} onChange={setMaterials} disabled={isUploading} />
          </div>

          {errorMsg && (
            <div className="rounded-[10px] bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          {!roomImage && !sketchImage && !isUploading && !errorMsg && (
            <p className="text-xs text-[#AAAAAA] text-center">
              Importez une photo de la piece et un croquis 2D pour commencer.
            </p>
          )}

          {isPreparingFiles && !isUploading && !errorMsg && (
            <p className="text-xs text-[#AAAAAA] text-center">
              Preparation des images en cours...
            </p>
          )}

          {roomImage && !sketchImage && !isUploading && !isPreparingFiles && !errorMsg && (
            <p className="text-xs text-[#AAAAAA] text-center">
              Le croquis 2D est maintenant requis pour contraindre la geometrie du rendu.
            </p>
          )}

          <div className="flex items-center justify-center gap-3">
            {isUploading && (
              <button
                onClick={handleCancel}
                className="px-5 py-3 text-sm font-medium text-[#666666] border border-[#E0E0E0] bg-white rounded-[14px] hover:border-[#AAAAAA] hover:text-[#333333] transition-colors"
              >
                Annuler
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={[
                'px-10 py-3.5 text-sm font-semibold rounded-[14px] transition-all duration-200',
                canGenerate
                  ? 'bg-[#E30613] text-white hover:bg-[#c60511] hover:scale-[1.02] hover:shadow-[0_8px_20px_rgba(227,6,19,0.25)] active:scale-[0.98]'
                  : 'bg-[#F0F0F0] text-[#AAAAAA] cursor-not-allowed',
              ].join(' ')}
            >
              {isUploading ? (
                <span className="flex items-center gap-2">
                  <SpinnerIcon />
                  Envoi en cours...
                </span>
              ) : isPreparingFiles ? (
                <span className="flex items-center gap-2">
                  <SpinnerIcon />
                  Preparation des images...
                </span>
              ) : (
                'Generer le rendu'
              )}
            </button>
          </div>
        </div>

        {process.env.NODE_ENV !== 'production' && (
          <div className="mt-12">
            <DebugPanel onStartTest={debugStartTest} />
          </div>
        )}
      </main>
    </div>
  )
}

function RoomIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M3 9.5L12 3l9 6.5V21H3V9.5z" />
      <path d="M9 21V13h6v8" />
    </svg>
  )
}

function SketchIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <path d="M7 7h2v2H7zM7 13h2v2H7z" />
      <path d="M12 7h5M12 10h5M12 13h5M12 16h5" />
      <line x1="3" y1="11" x2="21" y2="11" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}
