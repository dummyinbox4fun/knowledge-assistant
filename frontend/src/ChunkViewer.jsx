import { useState } from 'react'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

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
        `${BACKEND_URL}/ingestion/documents/${encodeURIComponent(filename)}/chunks`
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
    <div>
      <button type="button" onClick={toggle}>
        {expanded ? 'Hide chunks' : 'View chunks'}
      </button>

      {expanded && status === 'loading' && <p>Loading chunks...</p>}
      {expanded && status === 'error' && <p role="alert">Could not load chunks.</p>}

      {expanded && status === 'ready' && (
        <ol aria-label={`chunks-for-${filename}`}>
          {chunks.map((chunk) => (
            <li key={chunk.position}>
              <em>
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
