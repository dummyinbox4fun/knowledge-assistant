import { useEffect, useRef, useState } from 'react'
import UploadForm from './UploadForm'
import DocumentList from './DocumentList'
import ChatBox from './ChatBox'

const STATUS_DOT = {
  checking: 'bg-slate-400',
  ok: 'bg-emerald-500',
  down: 'bg-red-500',
}

const CARD = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm'

export default function App() {
  const [status, setStatus] = useState('checking...')
  const [backendState, setBackendState] = useState('checking')
  const documentListRef = useRef(null)

  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
    fetch(`${backendUrl}/health`)
      .then((r) => r.json())
      .then((data) => {
        setStatus(`backend: ${data.status} (${data.environment})`)
        setBackendState('ok')
      })
      .catch(() => {
        setStatus('backend unreachable')
        setBackendState('down')
      })
  }, [])

  const handleUploadSuccess = () => {
    documentListRef.current?.refresh()
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
            Personal Knowledge Assistant
          </h1>
          <p className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
            <span
              className={`h-2 w-2 rounded-full ${STATUS_DOT[backendState]}`}
              aria-hidden="true"
            />
            {status}
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <section className={CARD}>
            <h2>Upload a document</h2>
            <UploadForm onUploadSuccess={handleUploadSuccess} />
          </section>

          <section className={CARD}>
            <h2>Your documents</h2>
            <DocumentList ref={documentListRef} />
          </section>
        </div>

        <section className={`min-w-0 ${CARD}`}>
          <ChatBox />
        </section>
      </main>
    </div>
  )
}