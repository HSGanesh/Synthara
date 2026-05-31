import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const location = useLocation()

  const links = [
    { to: '/chat', label: 'Ask' },
    { to: '/ingest', label: 'Ingest' },
    { to: '/onboarding', label: 'Onboard' },
  ]

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'rgba(10, 12, 15, 0.85)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
      height: '56px',
      display: 'flex', alignItems: 'center',
      padding: '0 32px',
      justifyContent: 'space-between'
    }}>
      {/* Logo */}
      <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '6px',
          background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <span style={{ fontFamily: 'Space Mono', fontWeight: 700, fontSize: '13px', color: '#fff' }}>S</span>
        </div>
        <span style={{ fontFamily: 'Space Mono', fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', letterSpacing: '1px' }}>
          SYNTHARA
        </span>
      </Link>

      {/* Links */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {links.map(link => (
          <Link key={link.to} to={link.to} style={{
            textDecoration: 'none',
            padding: '6px 14px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '500',
            color: location.pathname === link.to ? 'var(--blue-bright)' : 'var(--text-secondary)',
            background: location.pathname === link.to ? 'var(--blue-glow)' : 'transparent',
            border: `1px solid ${location.pathname === link.to ? 'var(--blue-dim)' : 'transparent'}`,
            transition: 'all 0.2s'
          }}>
            {link.label}
          </Link>
        ))}
      </div>

      {/* Status dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: 'var(--success)',
          animation: 'pulse-blue 2s infinite'
        }} />
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Space Mono' }}>
          LIVE
        </span>
      </div>
    </nav>
  )
}
