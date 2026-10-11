import { useEffect, useState, useImperativeHandle, forwardRef } from 'react'
import ChunkViewer from './ChunkViewer'
import { BACKEND_URL, authHeaders } from './apiConfig'

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

  if (status === 'loading') return <p>Loading documents...</p>
  if (status === 'error') return <p role="alert">Could not load document list.</p>

  return (
    <>
      {deleteError && (
        <p role="alert" style={{ color: 'red' }}>
          {deleteError}
        </p>
      )}
      {documents.length === 0 ? (
        <p>No documents uploaded yet.</p>
      ) : (
        <ul aria-label="document-list">
          {documents.map((doc) => (
            <li key={`${doc.filename}-${doc.uploaded_at}`}>
              <strong>{doc.filename}</strong> — {doc.length_chars} characters —{' '}
              {doc.chunk_count} chunk{doc.chunk_count === 1 ? '' : 's'}
              <button
                type="button"
                onClick={() => handleDelete(doc.filename)}
                disabled={deletingFilename === doc.filename}
                aria-label={`delete-${doc.filename}`}
                style={{ marginLeft: '0.5rem' }}
              >
                {deletingFilename === doc.filename ? 'Deleting...' : 'Delete'}
              </button>
              <ChunkViewer filename={doc.filename} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
})

export default DocumentList