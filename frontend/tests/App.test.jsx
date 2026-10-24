import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
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

  it('shows the greeting and library totals on the welcome cards', async () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /what are you looking for in your notes/i })
    ).toBeInTheDocument()

    const card = await screen.findByRole('button', { name: /browse your library/i })
    await waitFor(() => {
      expect(card).toHaveTextContent('2 documents · 5 chunks · 1,500 characters')
    })
  })

  it('switches views from the navigation rail', async () => {
    render(<App />)
    const rail = screen.getByRole('navigation', { name: 'Main' })
    const askButton = within(rail).getByRole('button', { name: 'Ask your notes' })
    const uploadButton = within(rail).getByRole('button', { name: 'Upload a document' })

    expect(askButton).toHaveAttribute('aria-current', 'page')

    fireEvent.click(uploadButton)

    expect(uploadButton).toHaveAttribute('aria-current', 'page')
    expect(askButton).not.toHaveAttribute('aria-current')
    await screen.findByText('backend: ok (test)')
  })

  it('opens the upload view from the welcome card', async () => {
    render(<App />)
    const rail = screen.getByRole('navigation', { name: 'Main' })

    fireEvent.click(screen.getByRole('button', { name: /^upload a document drop in/i }))

    expect(within(rail).getByRole('button', { name: 'Upload a document' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    await screen.findByText('backend: ok (test)')
  })
})