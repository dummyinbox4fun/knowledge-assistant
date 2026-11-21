import { vi } from 'vitest'

// Replaces fetch with a fake backend. `routes` is a list of [method, path, reply]:
//   path   an exact string, or a RegExp tested against "/path?query"
//   reply  { status?, body? }, or a function (request) => { status?, body? } (or a promise of one)
// Returns the list of requests made so far, for assertions.
export function mockApi(routes) {
  const calls = []
  global.fetch = vi.fn((url, init = {}) => {
    const method = (init.method || 'GET').toUpperCase()
    const path = String(url).replace(/^https?:\/\/[^/]+/, '')
    const body = init.body ? JSON.parse(init.body) : undefined
    calls.push({ method, path, body })

    for (const [routeMethod, pattern, reply] of routes) {
      if (routeMethod !== method) continue
      const hit = typeof pattern === 'string' ? path === pattern : pattern.test(path)
      if (!hit) continue
      const result = typeof reply === 'function' ? reply({ path, body }) : reply
      return Promise.resolve(result).then(toResponse)
    }
    return Promise.resolve(toResponse({ status: 404, body: { detail: `no mock for ${method} ${path}` } }))
  })
  return calls
}

function toResponse({ status = 200, body = {} }) {
  return { ok: status < 400, status, json: async () => body }
}

export function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const NOW = '2026-11-15T10:00:00.000000+00:00'

export function chat(id, title, overrides = {}) {
  return { id, title, created_at: NOW, updated_at: NOW, ...overrides }
}

export function message(id, role, content, overrides = {}) {
  return { id, role, content, sources: null, status: 'complete', created_at: NOW, ...overrides }
}

// What POST /conversations/<id>/ask returns.
export function askReply(question, answer, { sources = [], ids = ['u1', 'a1'] } = {}) {
  const user_message = message(ids[0], 'user', question)
  const assistant_message = message(ids[1], 'assistant', answer, { sources })
  return { status: 200, body: { answer, sources, user_message, assistant_message } }
}
