import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login, register } from '../services/api'

export default function Login() {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const navigate = useNavigate()

  const handleSubmit = async () => {
    if (!username || !password) return
    setLoading(true); setError(null); setSuccess(null)
    try {
      if (mode === 'login') {
        const res = await login(username, password)

        localStorage.setItem('token', res.access_token)
        localStorage.setItem('username', username)

        window.location.href = '/chat'

      } else {
        await register(username, password)
        setSuccess('Account created successfully. Please sign in.')
        setMode('login')
        setPassword('')
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '14px 16px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    fontFamily: 'DM Sans',
    outline: 'none',
    transition: 'border-color 0.2s'
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px'
    }}>
      <div style={{ width: '100%', maxWidth: '400px', animation: 'fadeIn 0.5s ease both' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'var(--blue)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <span style={{ fontFamily: 'Space Mono', fontWeight: 700, fontSize: '20px', color: '#fff' }}>S</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Synthara Developer Intelligence
          </p>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = 'var(--blue)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = 'var(--blue)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />

          {error && (
            <p style={{ fontSize: '13px', color: '#ff5555' }}>✕ {error}</p>
          )}
          {success && (
            <p style={{ fontSize: '13px', color: 'var(--success)' }}>✓ {success}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !username || !password}
            style={{
              padding: '14px',
              background: username && password && !loading ? 'var(--blue)' : 'var(--bg-card)',
              color: username && password && !loading ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${username && password && !loading ? 'var(--blue)' : 'var(--border)'}`,
              borderRadius: '8px',
              fontFamily: 'Space Mono',
              fontWeight: 700,
              fontSize: '13px',
              cursor: loading || !username || !password ? 'not-allowed' : 'pointer',
              letterSpacing: '0.5px',
              marginTop: '4px',
              transition: 'all 0.2s'
            }}
          >
            {loading ? 'LOADING...' : mode === 'login' ? 'SIGN IN →' : 'CREATE ACCOUNT →'}
          </button>
        </div>

        {/* Toggle mode */}
        <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', marginTop: '24px' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <span
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); setSuccess(null) }}
            style={{ color: 'var(--blue-bright)', cursor: 'pointer', fontWeight: 500 }}
          >
            {mode === 'login' ? 'Register' : 'Sign in'}
          </span>
        </p>

        {/* Back to home */}
        <p style={{ textAlign: 'center', marginTop: '16px' }}>
          <Link to="/" style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}>
            ← Back to home
          </Link>
        </p>

      </div>
    </div>
  )
}