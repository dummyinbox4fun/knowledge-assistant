import { useCallback, useEffect, useState } from 'react'
import {
  deleteConversation,
  listConversations,
  renameConversation,
} from './conversationsApi'

const PAGE_SIZE = 30

// The sidebar's list of chats: loads the first page, loads more on request, and
// keeps the list in step with what the user does (new chat, rename, delete)
// without refetching everything each time.
export function useConversations() {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const reload = useCallback(async () => {
    setStatus('loading')
    try {
      const data = await listConversations({ limit: PAGE_SIZE, offset: 0 })
      const list = Array.isArray(data.conversations) ? data.conversations : []
      setItems(list)
      setHasMore(list.length === PAGE_SIZE)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const loadMore = useCallback(async () => {
    setLoadingMore(true)
    try {
      const data = await listConversations({ limit: PAGE_SIZE, offset: items.length })
      const page = Array.isArray(data.conversations) ? data.conversations : []
      setItems((current) => {
        const known = new Set(current.map((c) => c.id))
        return [...current, ...page.filter((c) => !known.has(c.id))]
      })
      setHasMore(page.length === PAGE_SIZE)
    } catch {
      // Keep what is already shown; the button stays so the user can try again.
    } finally {
      setLoadingMore(false)
    }
  }, [items.length])

  // Add a chat, or update one and move it to the top (it was just active).
  const upsert = useCallback((chat) => {
    setItems((current) => {
      const existing = current.find((c) => c.id === chat.id)
      if (!existing && !chat.title) return current // nothing to show it with
      const merged = { ...existing, ...chat }
      return [merged, ...current.filter((c) => c.id !== chat.id)]
    })
  }, [])

  const rename = useCallback(async (id, title) => {
    const updated = await renameConversation(id, title)
    setItems((current) => current.map((c) => (c.id === id ? { ...c, title: updated.title } : c)))
  }, [])

  const remove = useCallback(async (id) => {
    await deleteConversation(id)
    setItems((current) => current.filter((c) => c.id !== id))
  }, [])

  return { items, status, hasMore, loadingMore, reload, loadMore, upsert, rename, remove }
}
