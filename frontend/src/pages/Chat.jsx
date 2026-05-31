import { useState, useRef, useEffect } from 'react'
import SourceCard from '../components/SourceCard'
import Loader from '../components/Loader'
import { askQuestion, getLastCollection } from '../services/api'
import ReactMarkdown from 'react-markdown'

export default function Chat() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello. I\'m Synthara. Ask me anything about your codebase, documentation, or project.',
      sources: []
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [collectionName, setCollectionName] = useState('synthara_default')
  const bottomRef = useRef()

  // Auto-fetch last uploaded collection on mount
  useEffect(() => {
    const fetchLastCollection = async () => {
      try {
        const res = await getLastCollection()
        if (res.collection) setCollectionName(res.collection)
      } catch {
        // fallback to default silently
      }
    }
    fetchLastCollection()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])


  const handleSend = async () => {
    if (!input.trim() || loading) return
    const question = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: question }])
    setLoading(true)
    try {
      const res = await askQuestion(question, collectionName || 'synthara_default')
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.answer,
        sources: res.sources || []
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Please ensure the backend is running.',
        sources: []
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', paddingTop: '56px' }}>

      {/* Header */}
      <div style={{
        padding: '16px 32px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '12px'
      }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: 'var(--blue)', animation: 'pulse-blue 2s infinite'
        }} />
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'Space Mono' }}>
          SYNTHARA / ASK
        </span>
      </div>

      {/* Collection Selector */}
      <div style={{
        padding: '10px 32px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '12px'
      }}>
        <span style={{
          fontSize: '11px', color: 'var(--text-muted)',
          fontFamily: 'Space Mono', whiteSpace: 'nowrap'
        }}>
          COLLECTION
        </span>
        <input
          type="text"
          value={collectionName}
          onChange={e => setCollectionName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
          placeholder="synthara_default"
          style={{
            flex: 1, maxWidth: '300px',
            padding: '6px 12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            color: 'var(--blue-bright)',
            fontSize: '12px',
            fontFamily: 'Space Mono',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocus={e => e.target.style.borderColor = 'var(--blue)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Type collection name to query only that document
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              animation: 'fadeIn 0.3s ease both'
            }}>

              {/* Label */}
              <span style={{
                fontSize: '10px', fontFamily: 'Space Mono',
                color: 'var(--text-muted)', marginBottom: '6px',
                letterSpacing: '1px'
              }}>
                {msg.role === 'user' ? 'YOU' : 'SYNTHARA'}
              </span>

              {/* Bubble */}
              <div style={{
                maxWidth: '80%',
                padding: '14px 18px',
                borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                background: msg.role === 'user' ? 'var(--blue)' : 'var(--bg-card)',
                border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                fontSize: '14px', lineHeight: 1.7
              }}>
                <ReactMarkdown
                  components={{
                    p: ({children}) => <p style={{ marginBottom: '8px' }}>{children}</p>,
                    ul: ({children}) => <ul style={{ paddingLeft: '18px', marginBottom: '8px' }}>{children}</ul>,
                    ol: ({children}) => <ol style={{ paddingLeft: '18px', marginBottom: '8px' }}>{children}</ol>,
                    li: ({children}) => <li style={{ marginBottom: '4px' }}>{children}</li>,
                    strong: ({children}) => <strong style={{ color: 'var(--blue-bright)', fontWeight: 600 }}>{children}</strong>,
                    code: ({children}) => <code style={{
                      fontFamily: 'Space Mono',
                      fontSize: '12px',
                      background: 'rgba(29,111,255,0.1)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      color: 'var(--blue-bright)'
                    }}>{children}</code>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>

              {/* Sources */}
              {msg.role === 'assistant' && msg.sources?.length > 0 && (
                <div style={{ maxWidth: '80%', width: '100%' }}>
                  <SourceCard sources={msg.sources} />
                </div>
              )}
            </div>
          ))}

          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{
                fontSize: '10px', fontFamily: 'Space Mono',
                color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '1px'
              }}>
                SYNTHARA
              </span>
              <div style={{
                padding: '14px 18px', borderRadius: '12px 12px 12px 2px',
                background: 'var(--bg-card)', border: '1px solid var(--border)'
              }}>
                <Loader text="Retrieving context..." />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{
        padding: '16px 32px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-primary)'
      }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask anything about your codebase..."
            rows={1}
            style={{
              flex: 1, resize: 'none',
              padding: '14px 16px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontFamily: 'DM Sans',
              outline: 'none',
              lineHeight: 1.5,
              transition: 'border-color 0.2s'
            }}
            onFocus={e => e.target.style.borderColor = 'var(--blue)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            style={{
              padding: '14px 20px',
              background: input.trim() && !loading ? 'var(--blue)' : 'var(--bg-card)',
              color: input.trim() && !loading ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${input.trim() && !loading ? 'var(--blue)' : 'var(--border)'}`,
              borderRadius: '10px',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              fontFamily: 'Space Mono',
              fontSize: '13px',
              fontWeight: 700,
              transition: 'all 0.2s',
              letterSpacing: '0.5px'
            }}
          >
            ASK
          </button>
        </div>
        <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'Space Mono' }}>
          ENTER to send · SHIFT+ENTER for new line
        </p>
      </div>

    </div>
  )
}