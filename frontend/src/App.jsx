import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import UploadForm from './UploadForm'
import DocumentList from './DocumentList'
import ChatBox from './ChatBox'
import ChatSidebar from './ChatSidebar'
import Welcome from './Welcome'
import { ToastProvider } from './toast'
import { ChatIcon, FolderIcon, MenuIcon, UploadIcon } from './icons'
import { useAuth } from './auth'
import { useConversations } from './useConversations'
import { parseRoute } from './routes'

const GRADIENT = 'linear-gradient(135deg, #e9ecff 0%, #f4f0ff 50%, #e6f2ff 100%)'
const CARD = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'

// `view` is which screen the address shows (see routes.js); `path` is where the nav button goes.
const NAV = [
  { id: 'ask', view: 'chat', label: 'Ask', railLabel: 'Ask your notes', Icon: ChatIcon },
  { id: 'documents', view: 'documents', path: '/documents', label: 'Documents', railLabel: 'Documents', Icon: FolderIcon },
  { id: 'upload', view: 'upload', path: '/upload', label: 'Upload', railLabel: 'Upload a document', Icon: UploadIcon },
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
  const [drawerOpen, setDrawerOpen] = useState(false)
  const documentListRef = useRef(null)
  const drawerToggleRef = useRef(null)
  const sidebarRef = useRef(null)
  const drawerWasOpenRef = useRef(false)
  const lastChatIdRef = useRef(null)
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const conversations = useConversations()

  const route = parseRoute(location.pathname)
  const { view } = route
  // The chat screen stays mounted while Documents or Upload is showing, so it keeps
  // its own chat (and any answer still on its way) instead of being told "no chat".
  if (view === 'chat' && route.known) lastChatIdRef.current = route.conversationId
  const conversationId = view === 'chat' ? route.conversationId : lastChatIdRef.current
  const chatPath = conversationId ? `/chat/${conversationId}` : '/'

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

  // An address the app does not know goes back to a new chat.
  useEffect(() => {
    if (!route.known) navigate('/', { replace: true })
  }, [route.known, navigate])

  // Picking a chat (or leaving the chat screen) closes the phone drawer.
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // Phone drawer: Escape closes it, focus moves into it on open and back to the button on close.
  useEffect(() => {
    if (drawerOpen) {
      drawerWasOpenRef.current = true
      sidebarRef.current?.querySelector('a, button')?.focus()
      const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false)
      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }
    if (drawerWasOpenRef.current) {
      drawerWasOpenRef.current = false
      drawerToggleRef.current?.focus()
    }
    return undefined
  }, [drawerOpen])

  // The Ask button returns to the chat the user was last in, not always a blank one.
  const goTo = (item) => navigate(item.path ?? chatPath)

  const handleUploadSuccess = () => {
    documentListRef.current?.refresh()
  }

  const focusQuestion = () => {
    document.getElementById('question-input')?.focus()
  }

  // A chat was created or just answered: put it at the top of the list, and
  // open it if the user is still looking at the screen that asked.
  const handleConversationSaved = (chat, { open }) => {
    conversations.upsert(chat)
    if (open) navigate(`/chat/${chat.id}`, { replace: true })
  }

  const handleDeleteChat = async (id) => {
    await conversations.remove(id)
    if (id === conversationId) navigate('/', { replace: true })
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
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(item)}
                aria-label={item.railLabel}
                aria-current={view === item.view ? 'page' : undefined}
                className={`grid h-10 w-10 place-items-center rounded-full border p-0 ${
                  view === item.view
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <item.Icon />
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
                {view === 'chat' && (
                  <button
                    ref={drawerToggleRef}
                    type="button"
                    onClick={() => setDrawerOpen((open) => !open)}
                    aria-label="Chat list"
                    aria-expanded={drawerOpen}
                    aria-controls="chat-sidebar"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 bg-white p-0 text-slate-700 hover:bg-slate-50 md:hidden"
                  >
                    <MenuIcon />
                  </button>
                )}
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

            {/* All three screens stay mounted so a question still being answered, the
                document list and the upload form survive switching screens */}
            <div className={view === 'chat' ? 'flex min-h-0 flex-1' : 'hidden'}>
              {drawerOpen && (
                <div
                  className="fixed inset-0 z-30 bg-slate-900/40 md:hidden"
                  onClick={() => setDrawerOpen(false)}
                  aria-hidden="true"
                />
              )}
              <aside
                id="chat-sidebar"
                ref={sidebarRef}
                className={`${
                  drawerOpen ? 'fixed inset-y-0 left-0 z-40 flex w-72' : 'hidden'
                } flex-col border-r border-slate-200 bg-white md:static md:z-auto md:flex md:w-64 md:shrink-0 md:bg-white/60`}
              >
                <ChatSidebar
                  items={conversations.items}
                  status={conversations.status}
                  hasMore={conversations.hasMore}
                  loadingMore={conversations.loadingMore}
                  activeId={conversationId}
                  onRetry={conversations.reload}
                  onLoadMore={conversations.loadMore}
                  onRename={conversations.rename}
                  onDelete={handleDeleteChat}
                  onNavigate={() => setDrawerOpen(false)}
                />
              </aside>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <ChatBox
                  conversationId={conversationId}
                  onAttach={() => navigate('/upload')}
                  onNewChat={() => navigate('/')}
                  onConversationSaved={handleConversationSaved}
                  emptyState={
                    <Welcome
                      summary={summary}
                      onNavigate={(id) => navigate(id === 'documents' ? '/documents' : '/upload')}
                      onAsk={focusQuestion}
                    />
                  }
                />
              </div>
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
              {NAV.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goTo(item)}
                  aria-current={view === item.view ? 'page' : undefined}
                  className={`flex min-h-11 min-w-16 flex-col items-center gap-0.5 bg-transparent px-2 py-1 text-xs hover:bg-transparent ${
                    view === item.view ? 'font-semibold text-indigo-600' : 'font-medium text-slate-600'
                  }`}
                >
                  <item.Icon size={20} />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </ToastProvider>
  )
}
