'use client'

import type { RenderStatus } from '@/types'

interface Props {
  status: RenderStatus
  error?: string
  slowPoll?: boolean
}

const STEPS = [
  { label: 'Upload', description: 'Sending files to server' },
  { label: 'Render', description: 'AI generating your kitchen' },
  { label: 'Complete', description: 'Render ready' },
]

type StepState = 'pending' | 'active' | 'done'

function getStepState(index: number, status: RenderStatus): StepState {
  if (status === 'uploading') {
    if (index === 0) return 'active'
    return 'pending'
  }
  if (status === 'processing') {
    if (index === 0) return 'done'
    if (index === 1) return 'active'
    return 'pending'
  }
  if (status === 'succeeded') return 'done'
  return 'pending'
}

const statusMessages: Partial<Record<RenderStatus, string>> = {
  uploading: 'Uploading your photos and specifications…',
  processing: 'AI is analysing your kitchen space — this may take a few minutes…',
  succeeded: 'Your 4K render is ready.',
}

export default function ProgressSection({ status, error, slowPoll = false }: Props) {
  if (status === 'idle') return null

  const isFailed = status === 'failed'
  const isRunning = status === 'uploading' || status === 'processing'

  return (
    <div className="bg-white rounded-sm border border-neutral-100 p-6 space-y-5">
      {/* Step indicators */}
      <div className="flex items-start">
        {STEPS.map((step, i) => {
          const state = getStepState(i, status)
          return (
            <div key={step.label} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={[
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300',
                    state === 'done' ? 'bg-emerald-500 text-white' : '',
                    state === 'active' && !isFailed ? 'bg-[#C5A35E] text-white' : '',
                    state === 'pending' ? 'bg-neutral-100 text-neutral-400' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {state === 'done' ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <span
                  className={[
                    'text-[10px] mt-1.5 font-semibold tracking-wide whitespace-nowrap transition-colors',
                    state === 'done' ? 'text-emerald-600' : '',
                    state === 'active' && !isFailed ? 'text-[#C5A35E]' : '',
                    state === 'pending' ? 'text-neutral-400' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={[
                    'h-px flex-1 mx-2 mb-5 transition-all duration-500',
                    state === 'done' ? 'bg-emerald-400' : 'bg-neutral-200',
                  ].join(' ')}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Message */}
      {!isFailed && statusMessages[status] && (
        <p className={`text-sm text-center ${status === 'succeeded' ? 'text-emerald-600 font-medium' : 'text-neutral-500'}`}>
          {statusMessages[status]}
        </p>
      )}

      {slowPoll && status === 'processing' && (
        <div className="rounded-sm bg-amber-50 border border-amber-200 px-4 py-3 flex gap-3 items-start">
          <svg
            className="text-amber-400 mt-0.5 shrink-0"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm text-amber-700">
            This render is taking longer than usual. Still checking every 10 seconds — you can cancel at any time.
          </p>
        </div>
      )}

      {isFailed && error && (
        <div className="rounded-sm bg-red-50 border border-red-200 px-4 py-3 flex gap-3 items-start">
          <svg
            className="text-red-400 mt-0.5 shrink-0"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Indeterminate progress bar */}
      {isRunning && (
        <div className="h-0.5 bg-neutral-100 rounded-full overflow-hidden">
          <div className="h-full bg-[#C5A35E] rounded-full animate-progress-indeterminate" />
        </div>
      )}
    </div>
  )
}
