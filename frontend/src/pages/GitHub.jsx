import { useState } from 'react'
import { importGitHubRepo, updateLastCollection } from '../services/api'

export default function GitHub() {
  const [repoUrl, setRepoUrl] = useState('')
  const [collectionName, setCollectionName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleImport = async () => {
    if (!repoUrl.trim() || !collectionName.trim()) {
      setError('Both fields are required.')
      return
    }
    if (!repoUrl.startsWith('https://github.com/')) {
      setError('Please enter a valid GitHub URL.')
      return
    }

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const res = await importGitHubRepo(repoUrl.trim(), collectionName.trim())
      setResult(res)
      const username = localStorage.getItem('username')
      updateLastCollection(`${username}__${collectionName.trim()}`).catch(() => {})
    } catch (err) {
      setError(err.response?.data?.detail || 'Import failed. Check if backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    fontFamily: 'Space Mono',
    outline: 'none',
    transition: 'border-color 0.2s'
  }

  return (
    <div style={{ minHeight: '100vh', paddingTop: '56px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 32px' }}>

        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <p style={{ fontSize: '11px', fontFamily: 'Space Mono', color: 'var(--blue-bright)', letterSpacing: '2px', marginBottom: '12px' }}>
            SYNTHARA / GITHUB
          </p>
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', letterSpacing: '-0.5px' }}>
            Import Repository
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.7 }}>
            Paste a public GitHub repository URL and Synthara will clone, read, and index the entire codebase into your knowledge base.
          </p>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Repo URL */}
          <div>
            <label style={{
              fontSize: '11px', fontFamily: 'Space Mono',
              color: 'var(--text-muted)', letterSpacing: '1px',
              display: 'block', marginBottom: '8px'
            }}>
              GITHUB REPOSITORY URL *
            </label>
            <input
              type="text"
              placeholder="https://github.com/username/repository"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--blue)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* Collection Name */}
          <div>
            <label style={{
              fontSize: '11px', fontFamily: 'Space Mono',
              color: 'var(--text-muted)', letterSpacing: '1px',
              display: 'block', marginBottom: '8px'
            }}>
              COLLECTION NAME *
            </label>
            <input
              type="text"
              placeholder="e.g. react-source, my-project"
              value={collectionName}
              onChange={e => setCollectionName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--blue)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Use this name in the Ask page to query this repository.
            </p>
          </div>

          {/* Import Button */}
          <button
            onClick={handleImport}
            disabled={loading || !repoUrl.trim() || !collectionName.trim()}
            style={{
              padding: '14px 24px',
              background: !loading && repoUrl && collectionName ? 'var(--blue)' : 'var(--bg-card)',
              color: !loading && repoUrl && collectionName ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${!loading && repoUrl && collectionName ? 'var(--blue)' : 'var(--border)'}`,
              borderRadius: '8px',
              fontFamily: 'Space Mono',
              fontSize: '13px',
              fontWeight: 700,
              cursor: loading || !repoUrl || !collectionName ? 'not-allowed' : 'pointer',
              letterSpacing: '0.5px',
              transition: 'all 0.2s',
              marginTop: '8px'
            }}
          >
            {loading ? 'IMPORTING... (this may take a minute)' : 'IMPORT REPOSITORY →'}
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{
            marginTop: '24px', padding: '20px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            animation: 'fadeIn 0.3s ease both'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: 'var(--blue)',
                    animation: `blink 1.2s ease-in-out ${i * 0.2}s infinite`
                  }} />
                ))}
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'Space Mono' }}>
                Cloning repository...
              </span>
            </div>
            {[
              'Cloning repository from GitHub',
              'Reading source files',
              'Chunking and embedding content',
              'Storing in ChromaDB'
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ color: 'var(--blue)', fontSize: '11px', fontFamily: 'Space Mono', minWidth: '16px' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{step}</span>
              </div>
            ))}
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{
            marginTop: '24px', padding: '20px',
            background: 'rgba(0, 200, 150, 0.06)',
            border: '1px solid rgba(0, 200, 150, 0.3)',
            borderRadius: '10px', animation: 'fadeIn 0.3s ease both'
          }}>
            <p style={{ color: 'var(--success)', fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>
              ✓ Repository imported successfully
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { label: 'Repository', value: result.repo_url },
                { label: 'Collection', value: result.collection },
                { label: 'Files loaded', value: result.files_loaded },
                { label: 'Chunks created', value: result.chunks_created },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Space Mono', minWidth: '100px' }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--blue-bright)', fontFamily: 'Space Mono', wordBreak: 'break-all' }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
            <a href="/chat" style={{
              display: 'inline-block', marginTop: '16px',
              padding: '10px 20px',
              background: 'var(--blue)',
              color: '#fff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontFamily: 'Space Mono',
              fontSize: '12px',
              fontWeight: 700
            }}>
              ASK ABOUT THIS REPO →
            </a>
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

        {/* Info */}
        <div style={{
          marginTop: '40px', padding: '16px 20px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)', borderRadius: '10px'
        }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Space Mono', marginBottom: '10px', letterSpacing: '1px' }}>
            SUPPORTED FILE TYPES
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {['.py', '.js', '.ts', '.jsx', '.tsx', '.md', '.txt', '.json', '.yaml', '.html', '.css', '.sh'].map(ext => (
              <span key={ext} style={{
                padding: '3px 10px',
                background: 'var(--blue-glow)',
                border: '1px solid var(--blue-dim)',
                borderRadius: '4px',
                fontSize: '11px',
                color: 'var(--blue-bright)',
                fontFamily: 'Space Mono'
              }}>
                {ext}
              </span>
            ))}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
            ⚠️ Only public repositories are supported for now.
          </p>
        </div>

      </div>
    </div>
  )
}