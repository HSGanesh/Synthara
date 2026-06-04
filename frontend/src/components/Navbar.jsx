import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'

const MOBILE_BP = 640 // px — below this = mobile navbar

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < MOBILE_BP)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < MOBILE_BP)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mobile
}

export default function Navbar() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const isMobile  = useIsMobile()
  const dropRef   = useRef(null)

  const [username,     setUsername]     = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Sync username on every route change
  useEffect(() => {
    const token = localStorage.getItem('token')
    const user  = localStorage.getItem('username')
    setUsername(token && user ? user : null)
  }, [location])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [dropdownOpen])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    localStorage.removeItem('synthara_chat')
    localStorage.removeItem('synthara_session_id')
    localStorage.removeItem('synthara_collection')
    setUsername(null)
    setDropdownOpen(false)
    navigate('/login')
  }

  const links = [
    { to: '/chat',       label: 'Ask'     },
    { to: '/ingest',     label: 'Ingest'  },
    { to: '/github',     label: 'GitHub'  },
    { to: '/onboarding', label: 'Onboard' },
  ]

  // Avatar initials from username
  const initials = username ? username.slice(0, 2).toUpperCase() : 'U'

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'rgba(10, 12, 15, 0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
      height: '56px',
      display: 'flex', alignItems: 'center',
      padding: isMobile ? '0 12px' : '0 32px',
      justifyContent: 'space-between',
      gap: '8px',
      minWidth: 0,
      overflow: 'hidden',
    }}>

      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <Link
        to="/"
        style={{
          textDecoration: 'none', display: 'flex', alignItems: 'center',
          gap: '8px', flexShrink: 0,
        }}
      >
        <div style={{
          width: '28px', height: '28px', borderRadius: '6px',
          background: 'var(--blue)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'Space Mono', fontWeight: 700, fontSize: '13px', color: '#fff' }}>S</span>
        </div>
        {/* Hide wordmark below 400px so logo never wraps */}
        {!isMobile || window.innerWidth >= 400 ? (
          <span style={{
            fontFamily: 'Space Mono', fontWeight: 700,
            fontSize: isMobile ? '12px' : '14px',
            color: 'var(--text-primary)', letterSpacing: '1px',
            whiteSpace: 'nowrap',
          }}>
            SYNTHARA
          </span>
        ) : null}
      </Link>

      {/* ── Nav links ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: isMobile ? '2px' : '4px',
        flexShrink: 1, minWidth: 0, overflow: 'hidden',
      }}>
        {links.map(link => (
          <Link
            key={link.to}
            to={link.to}
            style={{
              textDecoration: 'none',
              padding: isMobile ? '5px 8px' : '6px 14px',
              borderRadius: '6px',
              fontSize: isMobile ? '12px' : '13px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              color: location.pathname === link.to ? 'var(--blue-bright)' : 'var(--text-secondary)',
              background: location.pathname === link.to ? 'var(--blue-glow)' : 'transparent',
              border: `1px solid ${location.pathname === link.to ? 'var(--blue-dim)' : 'transparent'}`,
              transition: 'all 0.2s',
            }}
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* ── Right side ───────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: isMobile ? '6px' : '12px',
        flexShrink: 0,
      }}>

        {/* Live indicator — hide dot+label on mobile to save space */}
        {!isMobile && (
          <>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: 'var(--success)', animation: 'pulse-blue 2s infinite',
            }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Space Mono' }}>
              LIVE
            </span>
          </>
        )}

        {username ? (
          isMobile ? (
            /* ── Mobile: avatar → dropdown ──────────────────────────── */
            <div ref={dropRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setDropdownOpen(p => !p)}
                aria-label="User menu"
                style={{
                  width: '34px', height: '34px', borderRadius: '50%',
                  background: dropdownOpen ? 'var(--blue)' : 'var(--bg-card)',
                  border: `2px solid ${dropdownOpen ? 'var(--blue)' : 'var(--border)'}`,
                  color: dropdownOpen ? '#fff' : 'var(--blue-bright)',
                  fontFamily: 'Space Mono', fontWeight: 700, fontSize: '12px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', transition: 'all 0.18s',
                  flexShrink: 0,
                }}
              >
                {initials}
              </button>

              {dropdownOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                  minWidth: '180px',
                  zIndex: 200,
                  overflow: 'hidden',
                  animation: 'fadeIn 0.15s ease both',
                }}>
                  {/* Username row */}
                  <div style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}>
                    <div style={{
                      width: '30px', height: '30px', borderRadius: '50%',
                      background: 'var(--blue)', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'Space Mono', fontWeight: 700, fontSize: '11px', color: '#fff',
                    }}>
                      {initials}
                    </div>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1px' }}>
                        {username}
                      </p>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'Space Mono' }}>
                        SIGNED IN
                      </p>
                    </div>
                  </div>

                  {/* Live status row */}
                  <div style={{
                    padding: '10px 16px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                    <div style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: 'var(--success)', animation: 'pulse-blue 2s infinite',
                    }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Space Mono' }}>
                      LIVE
                    </span>
                  </div>

                  {/* Logout row */}
                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%', padding: '12px 16px',
                      background: 'none', border: 'none',
                      color: '#ff5555', cursor: 'pointer',
                      fontFamily: 'Space Mono', fontSize: '12px',
                      fontWeight: 700, letterSpacing: '0.5px',
                      textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,85,85,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{ fontSize: '14px' }}>⏻</span>
                    LOGOUT
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ── Desktop: username chip + logout button ──────────────── */
            <>
              <span style={{
                fontSize: '12px', color: 'var(--text-secondary)',
                fontFamily: 'Space Mono', padding: '4px 10px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: '6px', whiteSpace: 'nowrap',
              }}>
                {username}
              </span>
              <button
                onClick={handleLogout}
                style={{
                  padding: '6px 12px',
                  background: 'transparent',
                  color: '#ff5555',
                  border: '1px solid rgba(255,85,85,0.3)',
                  borderRadius: '6px',
                  fontFamily: 'Space Mono',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap',
                }}
              >
                LOGOUT
              </button>
            </>
          )
        ) : (
          <Link
            to="/login"
            style={{
              textDecoration: 'none',
              padding: isMobile ? '6px 10px' : '6px 14px',
              background: 'var(--blue)', color: '#fff',
              borderRadius: '6px', fontFamily: 'Space Mono',
              fontSize: '11px', fontWeight: 700,
              letterSpacing: '0.5px', whiteSpace: 'nowrap',
            }}
          >
            LOGIN
          </Link>
        )}
      </div>
    </nav>
  )
}
