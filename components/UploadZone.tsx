'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handleFile = useCallback(
    (f: File) => {
      if (f.type.startsWith('image/')) onFile(f)
    },
    [onFile],
  )

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!disabled) setIsDragging(true)
    },
    [disabled],
  )

  const onDragLeave = useCallback(() => setIsDragging(false), [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled) return
      const f = e.dataTransfer.files[0]
      if (f) handleFile(f)
    },
    [disabled, handleFile],
  )

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    e.target.value = ''
  }

  const handleClick = () => {
    if (!disabled) inputRef.current?.click()
  }

  return (
    <div
      className={[
        'relative rounded-sm border-2 border-dashed transition-all duration-200 min-h-[192px]',
        'flex flex-col items-center justify-center overflow-hidden',
        isDragging ? 'border-[#C5A35E] bg-[#C5A35E]/5' : '',
        !isDragging && !file ? 'border-neutral-200 bg-white hover:border-neutral-400 cursor-pointer' : '',
        !isDragging && file ? 'border-neutral-200 bg-neutral-50 cursor-pointer' : '',
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
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white text-xs font-semibold tracking-wide uppercase">
              Change photo
            </span>
          </div>
          <button
            type="button"
            className="absolute top-2 right-2 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full w-6 h-6 flex items-center justify-center transition-colors text-xs leading-none"
            onClick={(e) => {
              e.stopPropagation()
              onFile(null)
            }}
          >
            ✕
          </button>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
            <p className="text-white text-xs font-medium truncate">{file?.name}</p>
            <p className="text-white/60 text-xs">
              {file ? (file.size / 1024 / 1024).toFixed(1) + ' MB' : ''}
            </p>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 p-6 text-center select-none">
          <div className="text-neutral-300">{icon}</div>
          <div>
            <p className="text-sm font-medium text-neutral-700">{label}</p>
            {sublabel && <p className="text-xs text-neutral-400 mt-0.5">{sublabel}</p>}
          </div>
          <p className="text-xs text-neutral-400">
            Drag & drop or{' '}
            <span className="text-[#C5A35E] font-medium">browse</span>
          </p>
        </div>
      )}
    </div>
  )
}
