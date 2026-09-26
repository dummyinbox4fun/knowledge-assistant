import { useEffect, useState } from 'react'
import UploadForm from './UploadForm'

export default function App() {
  const [status, setStatus] = useState('checking...')

  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
    fetch(`${backendUrl}/health`)
      .then((r) => r.json())
      .then((data) => setStatus(`backend: ${data.status} (${data.environment})`))
      .catch(() => setStatus('backend unreachable'))
  }, [])

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>Personal Knowledge Assistant</h1>
      <p>{status}</p>
      <h2>Upload a document</h2>
      <UploadForm />
    </div>
  )
}
