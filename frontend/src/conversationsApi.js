import { BACKEND_URL, authHeaders } from './apiConfig'

// Thin wrappers around the /conversations endpoints. Every function throws an
// Error with a readable message (and a numeric `status`) when the server says no.

const TITLE_MAX = 60

async function request(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: authHeaders(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const detail = typeof data.detail === 'string' ? data.detail : null
    const error = new Error(detail || `Request failed (${response.status})`)
    error.status = response.status
    throw error
  }
  return response.json()
}

// A chat is named after its first question until real titles arrive (V4.3).
export function titleFromQuestion(question) {
  const oneLine = question.trim().replace(/\s+/g, ' ')
  return oneLine.length > TITLE_MAX ? `${oneLine.slice(0, TITLE_MAX - 1)}…` : oneLine
}

export function listConversations({ limit = 30, offset = 0, signal } = {}) {
  return request(`/conversations?limit=${limit}&offset=${offset}`, { signal })
}

export function createConversation(title) {
  return request('/conversations', { method: 'POST', body: { title } })
}

export function getConversation(id, { signal } = {}) {
  return request(`/conversations/${encodeURIComponent(id)}`, { signal })
}

export function renameConversation(id, title) {
  return request(`/conversations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { title },
  })
}

export function deleteConversation(id) {
  return request(`/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function askInConversation(id, query, { topK = 5, signal } = {}) {
  return request(`/conversations/${encodeURIComponent(id)}/ask`, {
    method: 'POST',
    body: { query, top_k: topK },
    signal,
  })
}
