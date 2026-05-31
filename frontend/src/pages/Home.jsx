import { Link } from 'react-router-dom'

export default function Home() {
  const features = [
    { icon: '🔍', title: 'Source-cited answers', desc: 'Every answer references the exact file and section it came from.' },
    { icon: '📁', title: 'Multi-source retrieval', desc: 'Ingest GitHub repos, PDFs, docs, and wikis into one knowledge base.' },
    { icon: '⚡', title: 'Hallucination-resistant', desc: 'Answers are grounded in your actual codebase — never guessed.' },
    { icon: '🚀', title: 'Developer onboarding', desc: 'New joiners understand your entire system in minutes, not weeks.' },
  ]

  return (
    <div style={{ minHeight: '100vh', paddingTop: '56px' }}>
      {/* Hero */}
      <div style={{
        maxWidth: '800px', margin: '0 auto',
        padding: '100px 32px 80px',
        textAlign: 'center',
        animation: 'fadeIn 0.6s ease both'
      }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '6px 16px',
          background: 'var(--blue-glow)',
          border: '1px solid var(--blue-dim)',
          borderRadius: '20px',
          marginBottom: '32px'
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--blue)' }} />
          <span style={{ fontSize: '12px', color: 'var(--blue-bright)', fontFamily: 'Space Mono', letterSpacing: '1px' }}>
            RAG-POWERED DEVELOPER INTELLIGENCE
          </span>
        </div>

        {/* Heading */}
        <h1 style={{
          fontSize: '56px', fontWeight: 300, lineHeight: 1.1,
          color: 'var(--text-primary)', marginBottom: '24px',
          letterSpacing: '-1.5px'
        }}>
          Stop searching.<br />
          <span style={{
            fontWeight: 700,
            background: 'linear-gradient(90deg, var(--blue-bright), #60aaff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Start building.
          </span>
        </h1>

        <p style={{
          fontSize: '18px', color: 'var(--text-secondary)',
          maxWidth: '560px', margin: '0 auto 40px',
          lineHeight: 1.7, fontWeight: 300
        }}>
          Synthara understands your codebase, docs, and knowledge sources — delivering citation-backed answers in seconds.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/chat" style={{
            textDecoration: 'none',
            padding: '14px 32px',
            background: 'var(--blue)',
            color: '#fff',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '14px',
            fontFamily: 'Space Mono',
            letterSpacing: '0.5px',
            transition: 'all 0.2s',
            border: '1px solid var(--blue)'
          }}>
            ASK SYNTHARA →
          </Link>
          <Link to="/ingest" style={{
            textDecoration: 'none',
            padding: '14px 32px',
            background: 'transparent',
            color: 'var(--text-primary)',
            borderRadius: '8px',
            fontWeight: 500,
            fontSize: '14px',
            border: '1px solid var(--border-bright)',
            transition: 'all 0.2s'
          }}>
            Ingest Documents
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div style={{
        maxWidth: '900px', margin: '0 auto',
        padding: '0 32px 80px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px'
      }}>
        {features.map((f, i) => (
          <div key={i} style={{
            padding: '24px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            animation: `fadeIn 0.6s ease ${i * 0.1 + 0.3}s both`,
            transition: 'border-color 0.2s',
          }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>{f.icon}</div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              {f.title}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {f.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Terminal strip */}
      <div style={{
        maxWidth: '900px', margin: '0 auto 80px',
        padding: '0 32px'
      }}>
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            {['#ff5f56', '#ffbd2e', '#27c93f'].map((c, i) => (
              <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c }} />
            ))}
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Space Mono', marginLeft: '8px' }}>
              synthara ~ query
            </span>
          </div>
          <div style={{ padding: '20px 24px', fontFamily: 'Space Mono', fontSize: '13px', lineHeight: 2 }}>
            <p><span style={{ color: 'var(--blue-bright)' }}>$</span> <span style={{ color: 'var(--text-secondary)' }}>ask</span> <span style={{ color: 'var(--text-primary)' }}>"How does JWT auth work in our project?"</span></p>
            <p style={{ color: 'var(--success)', marginTop: '4px' }}>→ Token expiry is 30 min, set in auth_router.py line 84.</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>  Sources: auth_router.py · README.md · Issue #42</p>
          </div>
        </div>
      </div>
    </div>
  )
}
