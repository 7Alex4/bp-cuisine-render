'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface Props {
  label: string
  sublabel?: string
  icon: React.ReactNode
  accept?: string
  capture?: string
  file: File | null
  onFile: (file: File | null) => void
  disabled?: boolean
}

export default function UploadZone({
  label,
  sublabel,
  icon,
  accept = 'image/*',
  capture,
  file,
  onFile,
  disabled = false,
}: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleFile = useCallback(
    (nextFile: File) => {
      if (nextFile.type.startsWith('image/')) onFile(nextFile)
    },
    [onFile],
  )

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      if (!disabled) setIsDragging(true)
    },
    [disabled],
  )

  const onDragLeave = useCallback(() => setIsDragging(false), [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setIsDragging(false)
      if (disabled) return
      const nextFile = event.dataTransfer.files[0]
      if (nextFile) handleFile(nextFile)
    },
    [disabled, handleFile],
  )

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0]
    if (nextFile) handleFile(nextFile)
    event.target.value = ''
  }

  const handleClick = () => {
    if (!disabled) inputRef.current?.click()
  }

  return (
    <div
      className={[
        'relative rounded-[20px] border-2 border-dashed transition-all duration-200 min-h-[200px]',
        'flex flex-col items-center justify-center overflow-hidden',
        isDragging ? 'border-[#E30613] bg-red-50/40' : '',
        !isDragging && !file
          ? 'border-[#DDDDDD] bg-[#FAFAFA] hover:border-[#E30613] cursor-pointer'
          : '',
        !isDragging && file ? 'border-[#DDDDDD] bg-[#FAFAFA] cursor-pointer' : '',
        disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={capture as 'user' | 'environment' | undefined}
        className="hidden"
        onChange={onChange}
      />

      {previewUrl ? (
        <>
          <img
            src={previewUrl}
            alt="Preview"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center rounded-[20px]">
            <span className="text-white text-xs font-semibold tracking-wide uppercase">
              Changer la photo
            </span>
          </div>
          <button
            type="button"
            aria-label="Supprimer l'image"
            className="absolute top-3 right-3 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full w-7 h-7 flex items-center justify-center transition-colors"
            onClick={(event) => {
              event.stopPropagation()
              onFile(null)
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <line x1="1" y1="1" x2="9" y2="9" />
              <line x1="9" y1="1" x2="1" y2="9" />
            </svg>
          </button>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
            <p className="text-white text-xs font-medium truncate">{file?.name}</p>
            <p className="text-white/60 text-xs">
              {file ? (file.size / 1024 / 1024).toFixed(1) + ' Mo' : ''}
            </p>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 p-10 text-center select-none">
          <div className="text-[#CCCCCC]">{icon}</div>
          <div>
            <p className="text-sm font-semibold text-[#1A1A1A]">{label}</p>
            {sublabel && <p className="text-xs text-[#AAAAAA] mt-0.5">{sublabel}</p>}
          </div>
          <p className="text-xs text-[#AAAAAA] leading-relaxed">
            Deposez votre image ici
            <br />
            <span className="text-[#E30613] font-medium">ou cliquez pour importer</span>
          </p>
        </div>
      )}
    </div>
  )
}
