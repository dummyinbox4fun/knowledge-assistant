import { useEffect, useState, useImperativeHandle, forwardRef } from 'react'
import ChunkViewer from './ChunkViewer'
import { BACKEND_URL, authHeaders } from './apiConfig'

const DocumentList = forwardRef(function DocumentList(_props, ref) {
  const [documents, setDocuments] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error

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

  if (status === 'loading') return <p>Loading documents...</p>
  if (status === 'error') return <p role="alert">Could not load document list.</p>
  if (documents.length === 0) return <p>No documents uploaded yet.</p>

  return (
    <ul aria-label="document-list">
      {documents.map((doc) => (
        <li key={`${doc.filename}-${doc.uploaded_at}`}>
          <strong>{doc.filename}</strong> — {doc.length_chars} characters —{' '}
          {doc.chunk_count} chunk{doc.chunk_count === 1 ? '' : 's'}
          <ChunkViewer filename={doc.filename} />
        </li>
      ))}
    </ul>
  )
})

export default DocumentList