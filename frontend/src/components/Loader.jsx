export default function Loader({ text = "Thinking..." }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 0' }}>
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
        {text}
      </span>
    </div>
  )
}
