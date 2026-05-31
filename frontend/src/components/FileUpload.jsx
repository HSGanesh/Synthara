import { useState, useRef } from 'react'

export default function FileUpload({ onUpload, loading }) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null)
  const inputRef = useRef()

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  const handleSelect = (e) => {
    if (e.target.files[0]) setFile(e.target.files[0])
  }

  const handleUpload = () => {
    if (file) onUpload(file)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--blue)' : 'var(--border-bright)'}`,
          borderRadius: '12px',
          padding: '48px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? 'var(--blue-glow)' : 'var(--bg-card)',
          transition: 'all 0.2s',
        }}
      >
        <input ref={inputRef} type="file" accept=".pdf,.txt,.md" onChange={handleSelect} style={{ display: 'none' }} />

        <div style={{ fontSize: '32px', marginBottom: '12px' }}>📁</div>
        <p style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: '6px' }}>
          Drop your file here
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
          PDF, TXT, MD supported
        </p>
      </div>

      {/* Selected File */}
      {file && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--blue)', fontSize: '18px' }}>📄</span>
            <div>
              <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{file.name}</p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <button
            onClick={() => setFile(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}
          >×</button>
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={!file || loading}
        style={{
          padding: '12px 24px',
          background: file && !loading ? 'var(--blue)' : 'var(--bg-card)',
          color: file && !loading ? '#fff' : 'var(--text-muted)',
          border: `1px solid ${file && !loading ? 'var(--blue)' : 'var(--border)'}`,
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '14px',
          cursor: file && !loading ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s',
          fontFamily: 'Space Mono',
          letterSpacing: '0.5px'
        }}
      >
        {loading ? 'INGESTING...' : 'INGEST DOCUMENT'}
      </button>
    </div>
  )
}
