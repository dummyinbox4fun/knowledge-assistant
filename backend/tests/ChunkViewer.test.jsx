import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ChunkViewer from '../src/ChunkViewer'

beforeEach(() => {
  global.fetch = vi.fn()
})

describe('ChunkViewer', () => {
  it('does not fetch chunks until expanded', () => {
    render(<ChunkViewer filename="notes.md" />)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('fetches and displays chunks when expanded', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        filename: 'notes.md',
        chunk_count: 2,
        chunks: [
          { content: 'first chunk', position: 0, start_char: 0, end_char: 11 },
          { content: 'second chunk', position: 1, start_char: 8, end_char: 20 },
        ],
      }),
    })

    render(<ChunkViewer filename="notes.md" />)
    fireEvent.click(screen.getByRole('button', { name: /view chunks/i }))

    await waitFor(() => {
      expect(screen.getByText(/first chunk/)).toBeInTheDocument()
      expect(screen.getByText(/second chunk/)).toBeInTheDocument()
    })
  })

  it('shows an error message when the fetch fails', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false })

    render(<ChunkViewer filename="notes.md" />)
    fireEvent.click(screen.getByRole('button', { name: /view chunks/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('does not refetch when toggled closed then open again', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        filename: 'notes.md',
        chunk_count: 1,
        chunks: [{ content: 'only chunk', position: 0, start_char: 0, end_char: 10 }],
      }),
    })

    render(<ChunkViewer filename="notes.md" />)
    const button = screen.getByRole('button', { name: /view chunks/i })

    fireEvent.click(button) // expand — triggers fetch
    await waitFor(() => expect(screen.getByText(/only chunk/)).toBeInTheDocument())

    fireEvent.click(button) // collapse
    fireEvent.click(button) // expand again — should NOT refetch

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})
