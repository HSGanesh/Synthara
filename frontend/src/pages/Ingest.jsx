import { useState } from 'react'
import FileUpload from '../components/FileUpload'
import { uploadFile, updateLastCollection } from '../services/api'

export default function Ingest() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [collectionName, setCollectionName] = useState('')

  const handleUpload = async (file) => {
    if (!collectionName.trim()) {
        setError('Please enter a collection name before uploading.')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
    }
    setLoading(true)
    setResult(null)
    setError(null)
    try {
        const username = localStorage.getItem('username')
        const scopedCollection = `${username}__${collectionName.trim()}`
        const res = await uploadFile(file, scopedCollection)
        setResult(res)
        updateLastCollection(scopedCollection).catch(() => {})
    } catch (err) {
        setError(err.response?.data?.detail || 'Upload failed. Check if backend is running.')
    } finally {
        setLoading(false)
    }
    }
  return (
    <div style={{ minHeight: '100vh', paddingTop: '56px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 32px' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <p style={{ fontSize: '11px', fontFamily: 'Space Mono', color: 'var(--blue-bright)', letterSpacing: '2px', marginBottom: '12px' }}>
            SYNTHARA / INGEST
          </p>
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', letterSpacing: '-0.5px' }}>
            Add Knowledge
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.7 }}>
            Give your document a collection name so Synthara knows which knowledge base to query.
          </p>
        </div>

        {/* Collection Name Input */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            fontSize: '11px', fontFamily: 'Space Mono',
            color: 'var(--text-muted)', letterSpacing: '1px',
            display: 'block', marginBottom: '8px'
          }}>
            COLLECTION NAME *
          </label>
          <input
            type="text"
            placeholder="e.g. my-resume, project-alpha, api-docs"
            value={collectionName}
            onChange={e => setCollectionName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'var(--bg-card)',
              border: `1px solid ${!collectionName.trim() && error ? 'rgba(255,85,85,0.6)' : 'var(--border)'}`,
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontFamily: 'Space Mono',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={e => e.target.style.borderColor = 'var(--blue)'}
            onBlur={e => e.target.style.borderColor = !collectionName.trim() && error ? 'rgba(255,85,85,0.6)' : 'var(--border)'}
          />
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
            Spaces auto-convert to hyphens. Use the same name in Ask page to query this document only.
          </p>
        </div>

        {/* Supported formats */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {['PDF', 'TXT', 'MD'].map(fmt => (
            <span key={fmt} style={{
              padding: '4px 12px',
              background: 'var(--blue-glow)',
              border: '1px solid var(--blue-dim)',
              borderRadius: '4px',
              fontSize: '11px',
              color: 'var(--blue-bright)',
              fontFamily: 'Space Mono'
            }}>
              .{fmt.toLowerCase()}
            </span>
          ))}
        </div>

        {/* Upload Component */}
        <FileUpload onUpload={handleUpload} loading={loading} />

        {/* Result */}
        {result && (
          <div style={{
            marginTop: '24px', padding: '16px 20px',
            background: 'rgba(0, 200, 150, 0.06)',
            border: '1px solid rgba(0, 200, 150, 0.3)',
            borderRadius: '10px', animation: 'fadeIn 0.3s ease both'
          }}>
            <p style={{ color: 'var(--success)', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
              ✓ Document ingested successfully
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontFamily: 'Space Mono', marginBottom: '4px' }}>
              Collection: <span style={{ color: 'var(--blue-bright)' }}>{result.collection}</span>
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontFamily: 'Space Mono' }}>
              Chunks stored: <span style={{ color: 'var(--blue-bright)' }}>{result.chunks_created}</span>
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            marginTop: '24px', padding: '16px 20px',
            background: 'rgba(255, 80, 80, 0.06)',
            border: '1px solid rgba(255, 80, 80, 0.3)',
            borderRadius: '10px', animation: 'fadeIn 0.3s ease both'
          }}>
            <p style={{ color: '#ff5555', fontSize: '14px' }}>✕ {error}</p>
          </div>
        )}

        {/* How it works */}
        <div style={{
          marginTop: '40px', padding: '16px 20px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)', borderRadius: '10px'
        }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Space Mono', marginBottom: '10px', letterSpacing: '1px' }}>
            HOW IT WORKS
          </p>
          {[
            'Give the document a unique collection name',
            'Document is loaded, chunked and embedded',
            'Stored in ChromaDB under that collection',
            'Use the same name in Ask to query only this doc'
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '6px' }}>
              <span style={{ color: 'var(--blue)', fontSize: '11px', fontFamily: 'Space Mono', minWidth: '16px', marginTop: '2px' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{step}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}