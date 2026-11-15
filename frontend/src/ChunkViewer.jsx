import { useState } from 'react'
import { BACKEND_URL, authHeaders } from './apiConfig'

export default function ChunkViewer({ filename }) {
  const [expanded, setExpanded] = useState(false)
  const [chunks, setChunks] = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | ready | error

  const toggle = async () => {
    if (expanded) {
      setExpanded(false)
      return
    }

    setExpanded(true)

    if (chunks !== null) return // already fetched once, reuse

    setStatus('loading')
    try {
      const res = await fetch(
        `${BACKEND_URL}/ingestion/documents/${encodeURIComponent(filename)}/chunks`,
        { headers: authHeaders() }
      )
      if (!res.ok) throw new Error('Failed to load chunks')
      const data = await res.json()
      setChunks(data.chunks)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

    return (
    <div className="mt-2">
      <button
        type="button"
        onClick={toggle}
        className="bg-transparent px-0 py-0 text-xs font-medium text-indigo-600 hover:bg-transparent hover:underline"
      >
        {expanded ? 'Hide chunks' : 'View chunks'}
      </button>

      {expanded && status === 'loading' && (
        <p className="mt-2 text-xs text-slate-500">Loading chunks...</p>
      )}
      {expanded && status === 'error' && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          Could not load chunks.
        </p>
      )}

      {expanded && status === 'ready' && (
        <ol
          aria-label={`chunks-for-${filename}`}
          className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700"
        >
          {chunks.map((chunk) => (
            <li key={chunk.position} className="leading-relaxed">
              <em className="mr-1 font-mono not-italic text-slate-400">
                [{chunk.start_char}–{chunk.end_char}]
              </em>{' '}
              {chunk.content}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}