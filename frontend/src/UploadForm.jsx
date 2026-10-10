import { useState } from 'react'
import { BACKEND_URL, authHeaders } from './apiConfig'

export default function UploadForm({ onUploadSuccess }) {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle') // idle | uploading | success | error
  const [result, setResult] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const handleFileChange = (e) => {
    setFile(e.target.files[0] || null)
    setStatus('idle')
    setResult(null)
    setErrorMessage('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return

    setStatus('uploading')
    setErrorMessage('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`${BACKEND_URL}/ingestion/upload`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || `Upload failed (${res.status})`)
      }

      const data = await res.json()
      setResult(data)
      setStatus('success')
      if (onUploadSuccess) onUploadSuccess(data)
    } catch (err) {
      setErrorMessage(err.message || 'Upload failed')
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="upload-form">
      <input
        type="file"
        accept=".md,.txt,.pdf"
        onChange={handleFileChange}
        aria-label="file-input"
      />
      <button type="submit" disabled={!file || status === 'uploading'}>
        {status === 'uploading' ? 'Uploading...' : 'Upload'}
      </button>

      {status === 'success' && result && (
        <p role="status">
          Uploaded <strong>{result.filename}</strong> — {result.length_chars} characters
        </p>
      )}

      {status === 'error' && (
        <p role="alert" style={{ color: 'red' }}>
          {errorMessage}
        </p>
      )}
    </form>
  )
}