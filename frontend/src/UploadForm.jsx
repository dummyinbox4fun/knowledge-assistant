import { useState } from 'react'
import { BACKEND_URL, authHeaders } from './apiConfig'

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadForm({ onUploadSuccess }) {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle') // idle | uploading | success | error
  const [result, setResult] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [dragging, setDragging] = useState(false)

  const selectFile = (selected) => {
    setFile(selected || null)
    setStatus('idle')
    setResult(null)
    setErrorMessage('')
  }

  const handleFileChange = (e) => {
    selectFile(e.target.files[0])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    selectFile(e.dataTransfer.files[0])
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
    <form onSubmit={handleSubmit} aria-label="upload-form" className="space-y-3">
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition-colors focus-within:ring-2 focus-within:ring-indigo-300 ${
          dragging
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-slate-300 bg-slate-50 hover:border-indigo-400'
        }`}
      >
        <span className="font-medium text-slate-700">Drag and drop a file here</span>
        <span className="text-slate-500">or click to browse (.md, .txt, .pdf)</span>
        <input
          type="file"
          accept=".md,.txt,.pdf"
          onChange={handleFileChange}
          aria-label="file-input"
          className="sr-only"
        />
      </label>

      {file && (
        <p className="flex items-center justify-between gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm">
          <span className="truncate font-medium">{file.name}</span>
          <span className="shrink-0 text-xs text-slate-500">{formatSize(file.size)}</span>
        </p>
      )}

      {status === 'uploading' && (
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-indigo-500" />
        </div>
      )}

      <button type="submit" disabled={!file || status === 'uploading'} className="w-full">
        {status === 'uploading' ? 'Uploading...' : 'Upload'}
      </button>

      {status === 'success' && result && (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          Uploaded <strong>{result.filename}</strong> — {result.length_chars} characters
        </p>
      )}

      {status === 'error' && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {errorMessage}
        </p>
      )}
    </form>
  )
}