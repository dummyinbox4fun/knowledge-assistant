import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DocumentList from '../src/DocumentList'

beforeEach(() => {
  global.fetch = vi.fn()
})

describe('DocumentList', () => {
  it('shows a message when there are no documents', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ documents: [] }),
    })

    render(<DocumentList />)

    await waitFor(() => {
      expect(screen.getByText(/no documents uploaded yet/i)).toBeInTheDocument()
    })
  })

  it('renders a list of documents', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        documents: [
          { filename: 'notes.md', length_chars: 50, uploaded_at: '2026-09-26T10:00:00Z' },
          { filename: 'plan.txt', length_chars: 20, uploaded_at: '2026-09-26T10:05:00Z' },
        ],
      }),
    })

    render(<DocumentList />)

    await waitFor(() => {
      expect(screen.getByText(/notes.md/)).toBeInTheDocument()
      expect(screen.getByText(/plan.txt/)).toBeInTheDocument()
    })
  })

  it('shows an error message when fetch fails', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 500 })

    render(<DocumentList />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})
