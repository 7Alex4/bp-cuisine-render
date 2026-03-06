'use client'

import { useState } from 'react'

const API_BASE = '/api/render'

const FORM_KEYS = [
  { key: 'room', type: 'File', example: '-- binary --' },
  { key: 'sketch', type: 'File', example: '-- binary --' },
  { key: 'prompt', type: 'string', example: '"Minimalist alpine kitchen..."' },
  { key: 'style', type: 'string', example: '"Japandi"' },
  { key: 'dimensions', type: 'JSON string', example: '{"width":4,"depth":3,"height":2.6}' },
  { key: 'materials', type: 'JSON string', example: '{"description":"matte lacquer..."}' },
]

interface Props {
  onStartTest: () => Promise<unknown>
}

export default function DebugPanel({ onStartTest }: Props) {
  const [open, setOpen] = useState(false)
  const [pingId, setPingId] = useState('')
  const [startResp, setStartResp] = useState<unknown>(null)
  const [pingResp, setPingResp] = useState<unknown>(null)
  const [loading, setLoading] = useState<'start' | 'ping' | null>(null)

  async function handleStartTest() {
    setLoading('start')
    setStartResp(null)
    const result = await onStartTest()
    setStartResp(result)
    setLoading(null)
  }

  async function handlePing() {
    const id = pingId.trim()
    if (!id) return

    setLoading('ping')
    setPingResp(null)

    try {
      const res = await fetch(`${API_BASE}/status?id=${encodeURIComponent(id)}`, {
        cache: 'no-store',
      })
      const body = await res.json().catch(async () => ({
        _raw: await res.text().catch(() => '(unreadable)'),
      }))
      setPingResp({
        _http: res.status,
        ...(body && typeof body === 'object' ? body : { _body: body }),
      })
    } catch (error) {
      setPingResp({ _error: String(error) })
    }

    setLoading(null)
  }

  return (
    <div className="mt-8 rounded-sm border border-amber-300 bg-amber-50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-700">
          Dev - API Debug
        </span>
        <span className="text-amber-500 text-xs font-mono">{open ? '^' : 'v'}</span>
      </button>

      {open && (
        <div className="border-t border-amber-200 px-4 pt-4 pb-5 space-y-5">
          <section className="space-y-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-700 mb-1">
                API Base
              </p>
              <code className="text-xs bg-white border border-neutral-200 px-2 py-1 rounded-sm text-neutral-700">
                {API_BASE}
              </code>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-700 mb-1.5">
                Endpoints
              </p>
              <div className="space-y-0.5 text-[11px] font-mono">
                <div>
                  <span className="text-blue-500">POST</span>{' '}
                  <span className="text-neutral-600">/api/render/start</span>
                </div>
                <div>
                  <span className="text-emerald-600">GET</span>{' '}
                  <span className="text-neutral-600">/api/render/status?id=...</span>
                </div>
              </div>
            </div>
          </section>

          <section>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-700 mb-2">
              FormData Keys
            </p>
            <div className="overflow-x-auto">
              <table className="text-[11px] border-collapse w-full">
                <thead>
                  <tr className="text-neutral-500 text-left">
                    <th className="pr-4 pb-1 font-semibold">Key</th>
                    <th className="pr-4 pb-1 font-semibold">Type</th>
                    <th className="pb-1 font-semibold">Example</th>
                  </tr>
                </thead>
                <tbody>
                  {FORM_KEYS.map(({ key, type, example }) => (
                    <tr key={key} className="border-t border-neutral-100">
                      <td className="pr-4 py-1 font-mono text-neutral-800">{key}</td>
                      <td className="pr-4 py-1 text-neutral-500">{type}</td>
                      <td className="py-1 font-mono text-neutral-400 max-w-[180px] truncate">
                        {example}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-700">
              Test - Start Job
            </p>
            <p className="text-[11px] text-neutral-500">
              POSTs current form state to <span className="font-mono">/api/render/start</span>.
              Upload the room image first. The sketch is optional.
            </p>
            <button
              onClick={handleStartTest}
              disabled={loading === 'start'}
              className="px-4 py-2 text-xs font-medium bg-neutral-800 text-white rounded-sm hover:bg-neutral-700 disabled:opacity-50 transition-colors"
            >
              {loading === 'start' ? 'Sending...' : 'Start Test Job'}
            </button>
            {startResp !== null && (
              <pre className="text-[11px] bg-white border border-neutral-200 rounded-sm p-3 overflow-x-auto text-neutral-700 leading-relaxed whitespace-pre-wrap break-words">
                {JSON.stringify(startResp, null, 2)}
              </pre>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-700">
              Test - Ping Status
            </p>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={pingId}
                onChange={(event) => setPingId(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handlePing()}
                placeholder="Render ID (from start response)"
                className="flex-1 text-xs bg-white border border-neutral-200 rounded-sm px-3 py-2 text-neutral-700 placeholder-neutral-400 focus:outline-none focus:border-amber-400"
              />
              <button
                onClick={handlePing}
                disabled={loading === 'ping' || !pingId.trim()}
                className="px-4 py-2 text-xs font-medium bg-neutral-800 text-white rounded-sm hover:bg-neutral-700 disabled:opacity-50 transition-colors"
              >
                {loading === 'ping' ? 'Checking...' : 'Ping Status'}
              </button>
            </div>
            {pingResp !== null && (
              <pre className="text-[11px] bg-white border border-neutral-200 rounded-sm p-3 overflow-x-auto text-neutral-700 leading-relaxed whitespace-pre-wrap break-words">
                {JSON.stringify(pingResp, null, 2)}
              </pre>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
