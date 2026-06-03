import { useState, useRef, useEffect, useCallback } from 'react'
import SourceCard from '../components/SourceCard'
import Loader from '../components/Loader'
import ReactMarkdown from 'react-markdown'
import {
  askQuestion,
  getMyCollections,
  getChatHistory,
  getRepoOverview
} from '../services/api'

const WELCOME = {
  role: 'assistant',
  content: "Hello. I'm Synthara. Ask me anything about your codebase, documentation, or project.",
  sources: []
}

function groupByDate(sessions) {
  const groups = {}
  sessions.forEach(session => {
    const d = new Date(session.created_at)
    const today = new Date()
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
    let label
    if (d.toDateString() === today.toDateString()) label = 'Today'
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday'
    else label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    if (!groups[label]) groups[label] = []
    groups[label].push(session)
  })
  return groups
}

function SidebarSessionItem({ session, isActive, onSelect, onDelete, isDeleting }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        padding: '9px 10px',
        borderRadius: '8px',
        marginBottom: '2px',
        background: isActive ? 'var(--blue-glow)' : hovered ? 'var(--bg-hover)' : 'transparent',
        border: `1px solid ${isActive ? 'var(--blue-dim)' : hovered ? 'var(--border)' : 'transparent'}`,
        transition: 'all 0.15s',
        cursor: 'pointer',
        gap: '8px',
      }}
    >
      <div onClick={() => onSelect(session)} style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '12px',
          color: isActive ? 'var(--blue-bright)' : 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: '3px',
          lineHeight: 1.4,
          fontWeight: isActive ? 700 : 400,
        }}>
          {session.title}
        </p>
        <p style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
          fontFamily: 'Space Mono',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {session.collection} · {session.messages.length} msg{session.messages.length !== 1 ? 's' : ''}
        </p>
      </div>

      {hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(session.session_id) }}
          disabled={isDeleting}
          title="Delete conversation"
          style={{
            flexShrink: 0,
            background: 'none',
            border: 'none',
            color: isDeleting ? 'var(--text-muted)' : '#e05555',
            cursor: isDeleting ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            padding: '2px 4px',
            borderRadius: '4px',
            lineHeight: 1,
          }}
        >
          {isDeleting ? '…' : '×'}
        </button>
      )}
    </div>
  )
}

export default function Chat() {
  // ── Session ID — persists across tab switches ──
  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem('synthara_session_id') || crypto.randomUUID()
  })

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('synthara_chat')
      return saved ? JSON.parse(saved) : [WELCOME]
    } catch { return [WELCOME] }
  })

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [collectionName, setCollectionName] = useState(() => {
    return localStorage.getItem('synthara_collection') || 'default'
  })
  const [collections, setCollections] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [history, setHistory] = useState([])
  const [convoMemory, setConvoMemory] = useState([])
  const [deletingId, setDeletingId] = useState(null)
  const bottomRef = useRef()

  // Persist session ID
  useEffect(() => {
    localStorage.setItem('synthara_session_id', sessionId)
  }, [sessionId])

  // Persist messages
  useEffect(() => {
    localStorage.setItem('synthara_chat', JSON.stringify(messages))
  }, [messages])

  // Persist collection
  useEffect(() => {
    localStorage.setItem('synthara_collection', collectionName)
  }, [collectionName])

  // Initial data fetch
  useEffect(() => {
    let mounted = true
    const token = localStorage.getItem('token')
    if (!token) return

    const init = async () => {
      try {
        const colRes = await getMyCollections()
        if (mounted) setCollections(colRes.collections || [])
      } catch (e) { console.error('Collections error:', e) }

      try {
        const histRes = await getChatHistory()
        if (mounted) setHistory(histRes.history || [])
      } catch (e) { console.error('History error:', e) }
    }

    init()
    return () => { mounted = false }
  }, [])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, overviewLoading])

  // ── Actions ──

  const refreshHistory = useCallback(async () => {
    try {
      const histRes = await getChatHistory()
      setHistory(histRes.history || [])
    } catch (e) { console.error(e) }
  }, [])

  const handleNewChat = () => {
    const newId = crypto.randomUUID()
    setSessionId(newId)
    localStorage.setItem('synthara_session_id', newId)
    setMessages([WELCOME])
    localStorage.setItem('synthara_chat', JSON.stringify([WELCOME]))
  }

  const handleSelectSession = (session) => {
    setSessionId(session.session_id)
    localStorage.setItem('synthara_session_id', session.session_id)
    setCollectionName(session.collection)

    const restored = [WELCOME]
    session.messages.forEach(item => {
      restored.push({ role: 'user', content: item.question })
      restored.push({ role: 'assistant', content: item.answer, sources: item.sources || [] })
    })
    setMessages(restored)
    localStorage.setItem('synthara_chat', JSON.stringify(restored))
  }

  const handleDeleteSession = async (sid) => {
    setDeletingId(sid)
    try {
      const token = localStorage.getItem('token')
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/auth/history/session/${sid}?token=${token}`, {
        method: 'DELETE'
      })
      setHistory(prev => prev.filter(s => s.session_id !== sid))
      // If deleting active session, start new chat
      if (sid === sessionId) handleNewChat()
    } catch (e) {
      console.error('Delete session failed', e)
    } finally {
      setDeletingId(null)
    }
  }

  const handleSelectCollection = (col) => {
    const newId = crypto.randomUUID()
    setSessionId(newId)
    localStorage.setItem('synthara_session_id', newId)
    setCollectionName(col)
    const newMessages = [{
      role: 'assistant',
      content: `Switched to collection **${col}**. Ask me anything about it.`,
      sources: []
    }]
    setMessages(newMessages)
  }

  const handleRepoOverview = async () => {
    if (overviewLoading || loading) return
    const username = localStorage.getItem('username')
    const scopedCollection = `${username}__${collectionName || 'default'}`

    setMessages(prev => [...prev, { role: 'user', content: 'Explain this repository', sources: [] }])
    setOverviewLoading(true)

    try {
      const res = await getRepoOverview(scopedCollection)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.overview,
        sources: [],
        isOverview: true,
        filesAnalysed: res.files_analysed
      }])
      await refreshHistory()
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Could not generate repository overview. Make sure this collection has ingested files.',
        sources: []
      }])
    } finally {
      setOverviewLoading(false)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || loading || overviewLoading) return
    const question = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: question }])
    setLoading(true)
    try {
      const username = localStorage.getItem('username')
      const scopedCollection = `${username}__${collectionName || 'default'}`
      const res = await askQuestion(question, scopedCollection, convoMemory, sessionId)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.answer,
        sources: res.sources || []
      }])
      await refreshHistory()
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

  const groupedHistory = groupByDate(history)

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', paddingTop: '56px' }}>

      {/* Top bar */}
      <div style={{
        padding: '10px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '12px',
        flexShrink: 0,
      }}>
        <button
          onClick={() => setSidebarOpen(p => !p)}
          title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          style={{
            background: 'none', border: 'none',
            color: 'var(--text-muted)', cursor: 'pointer',
            fontSize: '16px', padding: '4px 8px', borderRadius: '6px',
          }}
        >☰</button>

        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: 'var(--blue)', animation: 'pulse-blue 2s infinite', flexShrink: 0
        }} />

        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'Space Mono' }}>
          SYNTHARA / ASK
        </span>

        <span style={{
          fontSize: '11px', color: 'var(--blue-bright)',
          fontFamily: 'Space Mono',
          background: 'var(--blue-glow)',
          border: '1px solid var(--blue-dim)',
          padding: '2px 10px', borderRadius: '4px',
          maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {collectionName}
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handleRepoOverview}
            disabled={overviewLoading || loading}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: overviewLoading ? 'var(--text-muted)' : 'var(--blue-bright)',
              cursor: (overviewLoading || loading) ? 'not-allowed' : 'pointer',
              fontSize: '11px', fontFamily: 'Space Mono',
              padding: '6px 14px', borderRadius: '6px',
              fontWeight: 700, letterSpacing: '0.5px',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <span style={{ fontSize: '13px' }}>⬡</span>
            {overviewLoading ? 'ANALYSING...' : 'REPO OVERVIEW'}
          </button>

          <button
            onClick={handleNewChat}
            style={{
              background: 'var(--blue)', border: 'none', color: '#fff',
              cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Mono',
              padding: '6px 14px', borderRadius: '6px',
              fontWeight: 700, letterSpacing: '0.5px',
            }}
          >+ NEW CHAT</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Sidebar */}
        {sidebarOpen && (
          <div style={{
            width: '252px',
            borderRight: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            display: 'flex', flexDirection: 'column',
            flexShrink: 0,
            animation: 'fadeIn 0.18s ease both',
          }}>

            {/* Collections */}
            <div style={{ padding: '12px 10px 6px', borderBottom: '1px solid var(--border)' }}>
              <div style={{
                fontSize: '10px', color: 'var(--text-muted)',
                fontFamily: 'Space Mono', letterSpacing: '1.2px',
                padding: '0 4px 6px',
              }}>COLLECTIONS</div>

              {collections.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 4px', lineHeight: 1.5 }}>
                  No collections yet.
                </p>
              ) : (
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {collections.map((col, i) => (
                    <div
                      key={i}
                      onClick={() => handleSelectCollection(col)}
                      style={{
                        padding: '8px 10px', borderRadius: '7px',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                        background: collectionName === col ? 'var(--blue-glow)' : 'transparent',
                        border: `1px solid ${collectionName === col ? 'var(--blue-dim)' : 'transparent'}`,
                        marginBottom: '2px', transition: 'all 0.15s',
                      }}
                    >
                      <div style={{
                        width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                        background: collectionName === col ? 'var(--blue)' : 'var(--text-muted)',
                      }} />
                      <span style={{
                        fontSize: '12px',
                        color: collectionName === col ? 'var(--blue-bright)' : 'var(--text-secondary)',
                        fontFamily: 'Space Mono',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontWeight: collectionName === col ? 700 : 400,
                      }}>
                        {col}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <a href="/ingest" style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                textDecoration: 'none', marginTop: '6px', padding: '7px 10px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: '7px', fontSize: '11px', color: 'var(--text-secondary)',
                fontFamily: 'Space Mono',
              }}>
                <span style={{ color: 'var(--blue)', fontSize: '14px' }}>+</span>
                ADD DOCUMENT
              </a>
            </div>

            {/* Chat History — grouped by date, one item per conversation */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
              <div style={{
                fontSize: '10px', color: 'var(--text-muted)',
                fontFamily: 'Space Mono', letterSpacing: '1.2px',
                padding: '0 4px 8px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>CONVERSATIONS</span>
                <button
                  onClick={refreshHistory}
                  title="Refresh"
                  style={{
                    background: 'none', border: 'none',
                    color: 'var(--text-muted)', cursor: 'pointer',
                    fontSize: '13px', padding: '1px 4px', borderRadius: '4px',
                  }}
                >↻</button>
              </div>

              {Object.keys(groupedHistory).length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 4px', lineHeight: 1.5 }}>
                  No conversations yet.
                </p>
              ) : (
                Object.entries(groupedHistory).map(([date, sessions]) => (
                  <div key={date} style={{ marginBottom: '18px' }}>
                    <p style={{
                      fontSize: '10px', color: 'var(--text-muted)',
                      fontFamily: 'Space Mono', letterSpacing: '0.8px',
                      padding: '0 4px', marginBottom: '4px',
                    }}>
                      {date}
                    </p>
                    {sessions.map((session) => (
                      <SidebarSessionItem
                        key={session.session_id}
                        session={session}
                        isActive={session.session_id === sessionId}
                        onSelect={handleSelectSession}
                        onDelete={handleDeleteSession}
                        isDeleting={deletingId === session.session_id}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
            <div style={{ maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {messages.map((msg, i) => (
                <div key={i} style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  animation: 'fadeIn 0.25s ease both',
                }}>
                  <span style={{
                    fontSize: '10px', fontFamily: 'Space Mono',
                    color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '1px',
                  }}>
                    {msg.role === 'user' ? 'YOU' : 'SYNTHARA'}
                    {msg.isOverview && (
                      <span style={{
                        marginLeft: '8px', background: 'var(--blue-glow)',
                        border: '1px solid var(--blue-dim)', color: 'var(--blue-bright)',
                        padding: '1px 7px', borderRadius: '3px',
                        fontSize: '9px', letterSpacing: '0.5px',
                      }}>
                        REPO OVERVIEW · {msg.filesAnalysed} files
                      </span>
                    )}
                  </span>

                  <div style={{
                    maxWidth: '82%', padding: '14px 18px',
                    borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    background: msg.role === 'user' ? 'var(--blue)' : 'var(--bg-card)',
                    border: msg.role === 'user' ? 'none' : `1px solid ${msg.isOverview ? 'var(--blue-dim)' : 'var(--border)'}`,
                    color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                    fontSize: '14px', lineHeight: 1.75,
                  }}>
                    <ReactMarkdown
                      components={{
                        h2: ({children}) => <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--blue-bright)', marginBottom: '6px', marginTop: '16px' }}>{children}</h2>,
                        h3: ({children}) => <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', marginTop: '12px' }}>{children}</h3>,
                        p: ({children}) => <p style={{ marginBottom: '8px' }}>{children}</p>,
                        ul: ({children}) => <ul style={{ paddingLeft: '18px', marginBottom: '8px' }}>{children}</ul>,
                        ol: ({children}) => <ol style={{ paddingLeft: '18px', marginBottom: '8px' }}>{children}</ol>,
                        li: ({children}) => <li style={{ marginBottom: '4px' }}>{children}</li>,
                        strong: ({children}) => <strong style={{ color: msg.role === 'user' ? '#fff' : 'var(--blue-bright)', fontWeight: 600 }}>{children}</strong>,
                        code: ({children}) => <code style={{
                          fontFamily: 'Space Mono', fontSize: '12px',
                          background: 'rgba(29,111,255,0.1)',
                          padding: '2px 6px', borderRadius: '4px',
                          color: 'var(--blue-bright)',
                        }}>{children}</code>,
                        hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>

                  {msg.role === 'assistant' && msg.sources?.length > 0 && (
                    <div style={{ maxWidth: '82%', width: '100%' }}>
                      <SourceCard sources={msg.sources} />
                    </div>
                  )}
                </div>
              ))}

              {(loading || overviewLoading) && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', animation: 'fadeIn 0.2s ease both' }}>
                  <span style={{
                    fontSize: '10px', fontFamily: 'Space Mono',
                    color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '1px',
                  }}>SYNTHARA</span>
                  <div style={{
                    padding: '14px 18px', borderRadius: '12px 12px 12px 2px',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                  }}>
                    <Loader text={overviewLoading ? 'Analysing repository...' : 'Retrieving context...'} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input bar */}
          <div style={{
            padding: '14px 32px 18px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-primary)', flexShrink: 0,
          }}>
            <div style={{ maxWidth: '780px', margin: '0 auto', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={`Ask anything about "${collectionName}"...`}
                rows={1}
                style={{
                  flex: 1, resize: 'none', padding: '13px 16px',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: '10px', color: 'var(--text-primary)',
                  fontSize: '14px', fontFamily: 'DM Sans',
                  outline: 'none', lineHeight: 1.5, transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading || overviewLoading}
                style={{
                  padding: '13px 20px',
                  background: (input.trim() && !loading && !overviewLoading) ? 'var(--blue)' : 'var(--bg-card)',
                  color: (input.trim() && !loading && !overviewLoading) ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${(input.trim() && !loading && !overviewLoading) ? 'var(--blue)' : 'var(--border)'}`,
                  borderRadius: '10px',
                  cursor: (input.trim() && !loading && !overviewLoading) ? 'pointer' : 'not-allowed',
                  fontFamily: 'Space Mono', fontSize: '13px',
                  fontWeight: 700, letterSpacing: '0.5px', transition: 'all 0.2s',
                }}
              >ASK</button>
            </div>
            <p style={{
              textAlign: 'center', fontSize: '11px',
              color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'Space Mono',
            }}>
              ENTER to send · SHIFT+ENTER for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}