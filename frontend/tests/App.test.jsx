import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../src/App'

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    if (String(url).includes('/health')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ status: 'ok', environment: 'test' }),
      })
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({
        documents: [
          { filename: 'a.md', length_chars: 1000, chunk_count: 3, uploaded_at: 'x' },
          { filename: 'b.md', length_chars: 500, chunk_count: 2, uploaded_at: 'y' },
        ],
      }),
    })
  })
})

describe('App', () => {
  it('shows the backend status', async () => {
    render(<App />)
    expect(await screen.findByText('backend: ok (test)')).toBeInTheDocument()
  })

  it('shows document totals in the stat tiles', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Documents').parentElement).toHaveTextContent(/^Documents2$/)
      expect(screen.getByText('Chunks').parentElement).toHaveTextContent(/^Chunks5$/)
      expect(screen.getByText('Characters').parentElement).toHaveTextContent(
        /^Characters1,500$/
      )
    })
  })
})