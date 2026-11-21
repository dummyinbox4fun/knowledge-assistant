import { describe, it, expect } from 'vitest'
import { parseRoute } from '../src/routes'

describe('parseRoute', () => {
  it('maps / to a new chat', () => {
    expect(parseRoute('/')).toEqual({ view: 'chat', conversationId: null, known: true })
  })

  it('maps /chat/<id> to that chat', () => {
    expect(parseRoute('/chat/abc-123')).toMatchObject({ view: 'chat', conversationId: 'abc-123', known: true })
    expect(parseRoute('/chat/abc-123/')).toMatchObject({ conversationId: 'abc-123', known: true })
  })

  it('maps the other two screens', () => {
    expect(parseRoute('/documents')).toMatchObject({ view: 'documents', known: true })
    expect(parseRoute('/upload')).toMatchObject({ view: 'upload', known: true })
  })

  it('flags anything else as unknown', () => {
    expect(parseRoute('/nope').known).toBe(false)
    expect(parseRoute('/chat').known).toBe(false)
    expect(parseRoute('/chat/a/b').known).toBe(false)
    expect(parseRoute('/chat/%E0%A4%A').known).toBe(false)
  })
})
