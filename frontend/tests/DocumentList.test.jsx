import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DocumentList from '../src/DocumentList'
import { ToastProvider } from '../src/toast'

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

    it('shows character and chunk counts for each document', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        documents: [
          {
            filename: 'notes.md',
            length_chars: 1500,
            chunk_count: 3,
            uploaded_at: '2026-09-26T10:00:00Z',
          },
        ],
      }),
    })

    render(<DocumentList />)

    await waitFor(() => {
      expect(screen.getByText(/1,500 characters/)).toBeInTheDocument()
      expect(screen.getByText(/3 chunks/)).toBeInTheDocument()
    })
  })

    const oneDoc = {
    documents: [
      {
        filename: 'notes.md',
        length_chars: 50,
        chunk_count: 2,
        uploaded_at: '2026-09-26T10:00:00Z',
      },
    ],
  }

  const renderWithToasts = () =>
    render(
      <ToastProvider>
        <DocumentList />
      </ToastProvider>
    )

  it('asks for confirmation and does not delete when cancelled', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => oneDoc })

    renderWithToasts()
    await screen.findByText(/notes.md/)

    fireEvent.click(screen.getByRole('button', { name: 'delete-notes.md' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/permanently removed/i)).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledTimes(1) // only the initial list load
  })

  it('deletes the document after confirmation and shows a toast', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => oneDoc })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ filename: 'notes.md', deleted: true }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ documents: [] }) })

    renderWithToasts()
    await screen.findByText(/notes.md/)

    fireEvent.click(screen.getByRole('button', { name: 'delete-notes.md' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.getByText(/no documents uploaded yet/i)).toBeInTheDocument()
    })
    expect(await screen.findByText(/Deleted "notes.md"/)).toBeInTheDocument()
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/ingestion/documents/notes.md'),
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('shows an error toast when the delete fails', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => oneDoc })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Delete exploded' }),
      })

    renderWithToasts()
    await screen.findByText(/notes.md/)

    fireEvent.click(screen.getByRole('button', { name: 'delete-notes.md' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Delete exploded')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
