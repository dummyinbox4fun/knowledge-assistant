import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ConfirmDialog from './ConfirmDialog'
import { MoreIcon, PlusIcon } from './icons'
import { groupChats } from './dateGroups'
import { useToast } from './toast'

const SECONDARY_BUTTON =
  'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
const MENU_ITEM =
  'block w-full bg-transparent px-3 py-1.5 text-left text-sm hover:bg-slate-100'

function ChatItem({ chat, active, menuOpen, onToggleMenu, onCloseMenu, onNavigate, onRename, onAskDelete }) {
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(chat.title)
  const [saving, setSaving] = useState(false)

  function startRename() {
    setDraft(chat.title)
    setRenaming(true)
    onCloseMenu()
  }

  async function submitRename(e) {
    e.preventDefault()
    const title = draft.trim()
    if (!title || title === chat.title) {
      setRenaming(false)
      return
    }
    setSaving(true)
    const ok = await onRename(chat.id, title)
    setSaving(false)
    if (ok) setRenaming(false)
  }

  if (renaming) {
    return (
      <li className="px-2 py-1">
        <form onSubmit={submitRename}>
          <input
            type="text"
            aria-label="Rename chat"
            value={draft}
            maxLength={120}
            disabled={saving}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => !saving && setRenaming(false)}
            onKeyDown={(e) => e.key === 'Escape' && setRenaming(false)}
          />
        </form>
      </li>
    )
  }

  return (
    <li className="relative" data-chat-item={chat.id}>
      <div
        className={`flex items-center rounded-lg ${
          active ? 'bg-indigo-50' : 'hover:bg-slate-100'
        }`}
      >
        <Link
          to={`/chat/${chat.id}`}
          onClick={onNavigate}
          aria-current={active ? 'page' : undefined}
          title={chat.title}
          className={`min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-sm ${
            active ? 'font-medium text-indigo-700' : 'text-slate-700'
          }`}
        >
          {chat.title}
        </Link>
        <button
          type="button"
          onClick={onToggleMenu}
          aria-label={`Options for ${chat.title}`}
          aria-expanded={menuOpen}
          aria-controls={`chat-options-${chat.id}`}
          className="mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-transparent p-0 text-slate-500 hover:bg-slate-200"
        >
          <MoreIcon />
        </button>
      </div>

      {menuOpen && (
        <div
          id={`chat-options-${chat.id}`}
          className="absolute right-1 top-full z-20 mt-1 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          <button type="button" onClick={startRename} className={`${MENU_ITEM} text-slate-700`}>
            Rename
          </button>
          <button
            type="button"
            onClick={() => {
              onCloseMenu()
              onAskDelete(chat)
            }}
            className={`${MENU_ITEM} text-red-600 hover:bg-red-50`}
          >
            Delete
          </button>
        </div>
      )}
    </li>
  )
}

export default function ChatSidebar({
  items,
  status,
  hasMore,
  loadingMore,
  activeId,
  onRetry,
  onLoadMore,
  onRename,
  onDelete,
  onNavigate,
}) {
  const { notify } = useToast()
  const [openMenuId, setOpenMenuId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const listRef = useRef(null)

  // Close the options menu on Escape or a click anywhere outside it.
  useEffect(() => {
    if (!openMenuId) return undefined
    const onKey = (e) => e.key === 'Escape' && setOpenMenuId(null)
    const onClick = (e) => {
      if (!e.target.closest?.(`[data-chat-item="${openMenuId}"]`)) setOpenMenuId(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [openMenuId])

  async function renameChat(id, title) {
    try {
      await onRename(id, title)
      return true
    } catch (err) {
      notify(err.message || 'Could not rename the chat', 'error')
      return false
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      await onDelete(deleteTarget.id)
      notify('Chat deleted')
    } catch (err) {
      notify(err.message || 'Could not delete the chat', 'error')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const groups = groupChats(items)

  return (
    <nav aria-label="Chats" className="flex min-h-0 flex-1 flex-col">
      <div className="p-3">
        <Link
          to="/"
          onClick={onNavigate}
          className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <PlusIcon size={16} />
          New chat
        </Link>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {status === 'loading' && (
          <p role="status" className="px-3 py-2 text-sm text-slate-500">
            Loading chats...
          </p>
        )}

        {status === 'error' && (
          <div
            role="alert"
            className="m-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            <p>Could not load your chats.</p>
            <button type="button" onClick={onRetry} className={`mt-2 ${SECONDARY_BUTTON}`}>
              Try again
            </button>
          </div>
        )}

        {status === 'ready' && items.length === 0 && (
          <p className="px-3 py-2 text-sm text-slate-500">
            No chats yet. Ask a question to start one.
          </p>
        )}

        {groups.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <h3 className="mb-1 mt-3 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {group.label}
            </h3>
            <ul>
              {group.items.map((chat) => (
                <ChatItem
                  key={chat.id}
                  chat={chat}
                  active={chat.id === activeId}
                  menuOpen={openMenuId === chat.id}
                  onToggleMenu={() => setOpenMenuId(openMenuId === chat.id ? null : chat.id)}
                  onCloseMenu={() => setOpenMenuId(null)}
                  onNavigate={onNavigate}
                  onRename={renameChat}
                  onAskDelete={setDeleteTarget}
                />
              ))}
            </ul>
          </section>
        ))}

        {hasMore && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className={`mx-1 mt-3 w-[calc(100%-0.5rem)] ${SECONDARY_BUTTON}`}
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete chat?"
          message={`"${deleteTarget.title}" and all of its messages will be permanently removed. This cannot be undone.`}
          confirmLabel="Delete"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => !deleting && setDeleteTarget(null)}
        />
      )}
    </nav>
  )
}
