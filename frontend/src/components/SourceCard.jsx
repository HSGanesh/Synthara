export default function SourceCard({ sources }) {
  if (!sources || sources.length === 0) return null

  return (
    <div style={{
      marginTop: '12px',
      padding: '12px 16px',
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderLeft: '2px solid var(--blue)',
      borderRadius: '8px',
    }}>
      <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Space Mono', marginBottom: '8px', letterSpacing: '1px' }}>
        SOURCES
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {sources.map((src, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--blue)', fontSize: '12px' }}>✓</span>
            <span style={{
              fontSize: '12px', color: 'var(--text-secondary)',
              fontFamily: 'Space Mono',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {src.split(/[\\/]/).pop() || src}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
