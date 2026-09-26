import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import UploadForm from '../src/UploadForm'

function makeFile(name, content = 'hello') {
  return new File([content], name, { type: 'text/plain' })
}

beforeEach(() => {
  global.fetch = vi.fn()
})

describe('UploadForm', () => {
  it('shows success message after a successful upload', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        filename: 'notes.md',
        length_chars: 42,
        content: 'some content',
      }),
    })

    render(<UploadForm />)

    const input = screen.getByLabelText('file-input')
    fireEvent.change(input, { target: { files: [makeFile('notes.md')] } })
    fireEvent.click(screen.getByRole('button', { name: /upload/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('notes.md')
      expect(screen.getByRole('status')).toHaveTextContent('42 characters')
    })
  })

  it('shows an error message when upload fails', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'Only .md, .txt, .pdf files are accepted' }),
    })

    render(<UploadForm />)

    const input = screen.getByLabelText('file-input')
    fireEvent.change(input, { target: { files: [makeFile('bad.docx')] } })
    fireEvent.click(screen.getByRole('button', { name: /upload/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Only .md, .txt, .pdf files are accepted'
      )
    })
  })

  it('disables the upload button when no file is selected', () => {
    render(<UploadForm />)
    expect(screen.getByRole('button', { name: /upload/i })).toBeDisabled()
  })
})
