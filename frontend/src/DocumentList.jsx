import { useEffect, useState, useImperativeHandle, forwardRef } from 'react'
import ChunkViewer from './ChunkViewer'
import { BACKEND_URL, authHeaders } from './apiConfig'

const chunkLabel = (n) => `${n} chunk${n === 1 ? '' : 's'}`

const DocumentList = forwardRef(function DocumentList(_props, ref) {
  const [documents, setDocuments] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [deletingFilename, setDeletingFilename] = useState(null)
  const [deleteError, setDeleteError] = useState('')

  const fetchDocuments = async () => {
    setStatus('loading')
    try {
      const res = await fetch(`${BACKEND_URL}/ingestion/documents`, {
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error('Failed to load documents')
      const data = await res.json()
      setDocuments(data.documents)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  useImperativeHandle(ref, () => ({ refresh: fetchDocuments }))

  const handleDelete = async (filename) => {
    if (!window.confirm(`Delete "${filename}"? This cannot be undone.`)) return

    setDeletingFilename(filename)
    setDeleteError('')
    try {
      const res = await fetch(
        `${BACKEND_URL}/ingestion/documents/${encodeURIComponent(filename)}`,
        {
          method: 'DELETE',
          headers: authHeaders(),
        }
      )
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || `Delete failed (${res.status})`)
      }
      await fetchDocuments()
    } catch (err) {
      setDeleteError(err.message || 'Delete failed')
    } finally {
      setDeletingFilename(null)
    }
  }

  if (status === 'loading') {
    return <p className="text-sm text-slate-500">Loading documents...</p>
  }
  if (status === 'error') {
    return (
      <p
        role="alert"
        className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
      >
        Could not load document list.
      </p>
    )
  }

  return (
    <>
      {deleteError && (
        <p
          role="alert"
          className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {deleteError}
        </p>
      )}
      {documents.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          No documents uploaded yet.
        </p>
      ) : (
        <ul aria-label="document-list" className="space-y-3">
          {documents.map((doc) => (
            <li
              key={`${doc.filename}-${doc.uploaded_at}`}
              className="rounded-lg border border-slate-200 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" title={doc.filename}>
                    {doc.filename}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {Number(doc.length_chars).toLocaleString('en-US')} characters
                    {typeof doc.chunk_count === 'number' &&
                      ` · ${chunkLabel(doc.chunk_count)}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(doc.filename)}
                  disabled={deletingFilename === doc.filename}
                  aria-label={`delete-${doc.filename}`}
                  className="shrink-0 border border-red-200 bg-white text-red-600 hover:bg-red-50"
                >
                  {deletingFilename === doc.filename ? 'Deleting...' : 'Delete'}
                </button>
              </div>
              <ChunkViewer filename={doc.filename} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
})

export default DocumentList