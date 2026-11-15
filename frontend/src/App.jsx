import { useEffect, useRef, useState } from 'react'
import UploadForm from './UploadForm'
import DocumentList from './DocumentList'
import ChatBox from './ChatBox'
import Welcome from './Welcome'
import { ToastProvider } from './toast'
import { ChatIcon, FolderIcon, UploadIcon } from './icons'
import { useAuth } from './auth'

const GRADIENT = 'linear-gradient(135deg, #e9ecff 0%, #f4f0ff 50%, #e6f2ff 100%)'
const CARD = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'

const NAV = [
  { id: 'ask', label: 'Ask', railLabel: 'Ask your notes', Icon: ChatIcon },
  { id: 'documents', label: 'Documents', railLabel: 'Documents', Icon: FolderIcon },
  { id: 'upload', label: 'Upload', railLabel: 'Upload a document', Icon: UploadIcon },
]

const STATUS_DOT = {
  checking: 'bg-slate-400',
  ok: 'bg-emerald-500',
  down: 'bg-red-500',
}

const fmt = (n) => n.toLocaleString('en-US')
const plural = (n, word) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`

function buildSummary(documents) {
  if (documents === null) return 'Loading your library...'
  if (documents.length === 0) return 'No documents yet. Upload your first one.'
  const chunks = documents.reduce((sum, d) => sum + (d.chunk_count || 0), 0)
  const chars = documents.reduce((sum, d) => sum + (Number(d.length_chars) || 0), 0)
  return `${plural(documents.length, 'document')} · ${plural(chunks, 'chunk')} · ${fmt(chars)} characters`
}

export default function App() {
  const [status, setStatus] = useState('checking...')
  const [backendState, setBackendState] = useState('checking')
  const [documents, setDocuments] = useState(null)
  const [view, setView] = useState('ask') // ask | documents | upload
  const documentListRef = useRef(null)
  const { user, signOut } = useAuth()

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

  const focusQuestion = () => {
    setView('ask')
    document.getElementById('question-input')?.focus()
  }

  const summary = buildSummary(documents)

  return (
    <ToastProvider>
      <div className="h-dvh p-0 md:p-5 md:short:p-3" style={{ background: GRADIENT }}>
        <div className="flex h-full overflow-hidden md:rounded-[28px] md:border md:border-white md:bg-white/70 md:shadow-[0_12px_40px_rgba(60,60,120,0.12)]">
          {/* Left rail (desktop) */}
          <nav
            aria-label="Main"
            className="hidden w-[76px] shrink-0 flex-col items-center gap-3 py-6 md:flex"
          >
            {NAV.map(({ id, railLabel, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                aria-label={railLabel}
                aria-current={view === id ? 'page' : undefined}
                className={`grid h-10 w-10 place-items-center rounded-full border p-0 ${
                  view === id
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon />
              </button>
            ))}
            <div
              className="mt-auto grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-lg font-bold text-white"
              aria-hidden="true"
            >
              K
            </div>
          </nav>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 md:h-[76px] md:px-8 md:short:h-14">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-indigo-600 text-sm font-bold text-white md:hidden"
                  aria-hidden="true"
                >
                  K
                </span>
                <span className="hidden truncate text-[15px] font-semibold sm:inline">Knowledge Assistant</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <p className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 md:text-[13px]">
                  <span
                    className={`h-2 w-2 rounded-full ${STATUS_DOT[backendState]}`}
                    aria-hidden="true"
                  />
                  {status}
                </p>
                {user && (
                  <>
                    <span className="hidden max-w-[180px] truncate text-[13px] text-slate-600 lg:inline">
                      {user.email}
                    </span>
                    <button
                      type="button"
                      onClick={signOut}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 md:text-[13px]"
                    >
                      Sign out
                    </button>
                  </>
                )}
              </div>
            </header>

            {/* All views stay mounted so chat history and the document list survive tab switches */}
            <div className={view === 'ask' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
              <ChatBox
                onAttach={() => setView('upload')}
                emptyState={
                  <Welcome summary={summary} onNavigate={setView} onAsk={focusQuestion} />
                }
              />
            </div>

            <div
              className={
                view === 'documents' ? 'min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-8' : 'hidden'
              }
            >
              <div className="mx-auto w-full max-w-3xl">
                <h1 className="text-2xl font-semibold tracking-tight">Your documents</h1>
                <p className="mt-1 text-sm text-slate-600">{summary}</p>
                <section className={`mt-6 ${CARD}`}>
                  <DocumentList ref={documentListRef} onDocumentsChange={setDocuments} />
                </section>
              </div>
            </div>

            <div
              className={
                view === 'upload' ? 'min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-8' : 'hidden'
              }
            >
              <div className="mx-auto w-full max-w-3xl">
                <h1 className="text-2xl font-semibold tracking-tight">Upload a document</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Add a .md, .txt or .pdf file and it becomes searchable in seconds.
                </p>
                <section className={`mt-6 max-w-xl ${CARD}`}>
                  <UploadForm onUploadSuccess={handleUploadSuccess} />
                </section>
              </div>
            </div>

            {/* Bottom navigation (phone and tablet) */}
            <nav
              aria-label="Mobile"
              className="flex h-16 shrink-0 items-center justify-around border-t border-slate-200 bg-white/80 md:hidden"
            >
              {NAV.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  aria-current={view === id ? 'page' : undefined}
                  className={`flex min-h-11 min-w-16 flex-col items-center gap-0.5 bg-transparent px-2 py-1 text-xs hover:bg-transparent ${
                    view === id ? 'font-semibold text-indigo-600' : 'font-medium text-slate-600'
                  }`}
                >
                  <Icon size={20} />
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </ToastProvider>
  )
}
