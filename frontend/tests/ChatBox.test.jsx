import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ChatBox from '../src/ChatBox'

function ask(text) {
  fireEvent.change(screen.getByLabelText('Your question'), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: /ask/i }))
}

beforeEach(() => {
  global.fetch = vi.fn()
})

describe('ChatBox', () => {
  it('shows an error when the question is empty', () => {
    render(<ChatBox />)
    fireEvent.click(screen.getByRole('button', { name: /ask/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a question')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('shows the question, the answer and the sources', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        answer: 'Python is a programming language.',
        sources: [{ filename: 'notes.md', position: 2, distance: 0.4123 }],
      }),
    })

    render(<ChatBox />)
    ask('What is Python?')

    await waitFor(() => {
      expect(screen.getByText('Python is a programming language.')).toBeInTheDocument()
    })
    expect(screen.getByText('What is Python?')).toBeInTheDocument()
    expect(screen.getByText(/notes.md \(chunk 2, distance 0.412\)/)).toBeInTheDocument()
  })

  it('shows the backend error detail', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'Generation failed' }),
    })

    render(<ChatBox />)
    ask('Anything')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Generation failed')
    })
  })

  it('shows a friendly message when the request times out', async () => {
    global.fetch.mockRejectedValueOnce(
      Object.assign(new Error('aborted'), { name: 'AbortError' })
    )

    render(<ChatBox />)
    ask('Anything')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/taking too long/i)
    })
  })

  it('shows the empty state until a question is asked', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: 'Hello back', sources: [] }),
    })

    render(<ChatBox emptyState={<p>Welcome panel</p>} />)
    expect(screen.getByText('Welcome panel')).toBeInTheDocument()

    ask('Hi')

    await waitFor(() => {
      expect(screen.getByText('Hello back')).toBeInTheDocument()
    })
    expect(screen.queryByText('Welcome panel')).not.toBeInTheDocument()
  })

  it('fills the input when a suggestion chip is clicked', () => {
    render(<ChatBox />)
    fireEvent.click(screen.getByRole('button', { name: 'Key points' }))
    expect(screen.getByLabelText('Your question')).toHaveValue(
      'What are the key points in my notes?'
    )
  })

  it('shows an attach button only when onAttach is provided', () => {
    const onAttach = vi.fn()
    const { rerender } = render(<ChatBox />)
    expect(screen.queryByRole('button', { name: 'Attach a document' })).not.toBeInTheDocument()

    rerender(<ChatBox onAttach={onAttach} />)
    fireEvent.click(screen.getByRole('button', { name: 'Attach a document' }))
    expect(onAttach).toHaveBeenCalledTimes(1)
  })
})