import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import SourceCard from '../components/SourceCard'
import Loader from '../components/Loader'
import { askQuestion, getLastCollection, getMyCollections, getChatHistory } from '../services/api'
import ReactMarkdown from 'react-markdown'

export default function Chat() {
  const location = useLocation()

  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('synthara_chat')
    return saved ? JSON.parse(saved) : [
      {
        role: 'assistant',
        content: 'Hello. I\'m Synthara. Ask me anything about your codebase, documentation, or project.',
        sources: []
      }
    ]
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [collectionName, setCollectionName] = useState('default')
  const [collections, setCollections] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [history, setHistory] = useState([])
  const [activeTab, setActiveTab] = useState('collections') // 'collections' | 'history'
  const bottomRef = useRef()

  // Save messages to localStorage
  useEffect(() => {
    localStorage.setItem('synthara_chat', JSON.stringify(messages))
  }, [messages])

  useEffect(() => {
    let mounted = true

    const token = localStorage.getItem('token')
    const username = localStorage.getItem('username')
    if (!token || !username) return

    const init = async () => {
      try {
        const colRes = await getMyCollections()
        if (mounted) setCollections(colRes.collections || [])
      } catch(e) {
        console.error('Collections error:', e)
      }

      try {
        const histRes = await getChatHistory()
        if (mounted) setHistory(histRes.history || [])
      } catch(e) {
        console.error('History error:', e)
      }
    }

    init()

    // Cleanup to prevent state update on unmounted component
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleNewChat = () => {
    const fresh = [{
      role: 'assistant',
      content: 'Hello. I\'m Synthara. Ask me anything about your codebase, documentation, or project.',
      sources: []
    }]
    setMessages(fresh)
    localStorage.setItem('synthara_chat', JSON.stringify(fresh))
  }

  const handleSelectHistory = (item) => {
    setCollectionName(item.collection)
    setMessages([
      {
        role: 'assistant',
        content: `Restored conversation from collection "${item.collection}".`,
        sources: []
      },
      { role: 'user', content: item.question },
      { role: 'assistant', content: item.answer, sources: item.sources }
    ])
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const question = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: question }])
    setLoading(true)
    try {
      const username = localStorage.getItem('username')
      const scopedCollection = `${username}__${collectionName || 'default'}`
      const res = await askQuestion(question, scopedCollection)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.answer,
        sources: res.sources || []
      }])
      // Refresh history after new message
      const histRes = await getChatHistory()
      setHistory(histRes.history || [])
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

  const handleSelectCollection = (col) => {
    setCollectionName(col)
    const newMessages = [{
      role: 'assistant',
      content: `Switched to collection "${col}". Ask me anything about it.`,
      sources: []
    }]
    setMessages(newMessages)
    localStorage.setItem('synthara_chat', JSON.stringify(newMessages))
  }

  // Group history by date
  const groupHistoryByDate = (history) => {
    const groups = {}
    history.forEach(item => {
      const date = new Date(item.created_at)
      const today = new Date()
      const yesterday = new Date()
      yesterday.setDate(today.getDate() - 1)

      let label
      if (date.toDateString() === today.toDateString()) label = 'Today'
      else if (date.toDateString() === yesterday.toDateString()) label = 'Yesterday'
      else label = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

      if (!groups[label]) groups[label] = []
      groups[label].push(item)
    })
    return groups
  }

  const groupedHistory = groupHistoryByDate(history)

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', paddingTop: '56px' }}>

      {/* Header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '12px'
      }}>
        <button
          onClick={() => setSidebarOpen(p => !p)}
          style={{
            background: 'none', border: 'none',
            color: 'var(--text-muted)', cursor: 'pointer',
            fontSize: '16px', padding: '4px 8px', borderRadius: '6px'
          }}
        >
          ☰
        </button>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: 'var(--blue)', animation: 'pulse-blue 2s infinite'
        }} />
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'Space Mono' }}>
          SYNTHARA / ASK
        </span>
        <span style={{
          fontSize: '11px', color: 'var(--blue-bright)',
          fontFamily: 'Space Mono',
          background: 'var(--blue-glow)',
          border: '1px solid var(--blue-dim)',
          padding: '2px 10px', borderRadius: '4px'
        }}>
          {collectionName}
        </span>

        {/* New Chat + Clear buttons */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button
            onClick={handleNewChat}
            style={{
              background: 'var(--blue)',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '11px',
              fontFamily: 'Space Mono',
              padding: '6px 14px',
              borderRadius: '6px',
              fontWeight: 700,
              letterSpacing: '0.5px'
            }}
          >
            + NEW CHAT
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('synthara_chat')
              handleNewChat()
            }}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '10px',
              fontFamily: 'Space Mono',
              padding: '6px 10px',
              borderRadius: '6px',
              letterSpacing: '0.5px'
            }}
          >
            CLEAR
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Sidebar */}
        {sidebarOpen && (
          <div style={{
            width: '240px',
            borderRight: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            display: 'flex', flexDirection: 'column',
            flexShrink: 0,
            animation: 'fadeIn 0.2s ease both'
          }}>

            {/* Tabs */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid var(--border)',
            }}>
              {['collections', 'history'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'none',
                    border: 'none',
                    borderBottom: `2px solid ${activeTab === tab ? 'var(--blue)' : 'transparent'}`,
                    color: activeTab === tab ? 'var(--blue-bright)' : 'var(--text-muted)',
                    fontFamily: 'Space Mono',
                    fontSize: '10px',
                    cursor: 'pointer',
                    letterSpacing: '1px',
                    fontWeight: activeTab === tab ? 700 : 400,
                    transition: 'all 0.2s'
                  }}
                >
                  {tab === 'collections' ? 'COLLECTIONS' : 'HISTORY'}
                </button>
              ))}
            </div>

            {/* Collections Tab */}
            {activeTab === 'collections' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{
                  padding: '10px 12px 4px',
                  display: 'flex', justifyContent: 'flex-end'
                }}>
                  <button
                    onClick={async () => {
                      const res = await getMyCollections()
                      setCollections(res.collections || [])
                    }}
                    style={{
                      background: 'none', border: 'none',
                      color: 'var(--text-muted)', cursor: 'pointer',
                      fontSize: '14px', padding: '2px 6px', borderRadius: '4px'
                    }}
                    title="Refresh"
                  >
                    ↻
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
                  {collections.length === 0 ? (
                    <div style={{ padding: '20px 12px', textAlign: 'center' }}>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        No collections yet.
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                        Go to Ingest to upload a document.
                      </p>
                    </div>
                  ) : (
                    collections.map((col, i) => (
                      <div
                        key={i}
                        onClick={() => handleSelectCollection(col)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '8px',
                          background: collectionName === col ? 'var(--blue-glow)' : 'transparent',
                          border: `1px solid ${collectionName === col ? 'var(--blue-dim)' : 'transparent'}`,
                          marginBottom: '4px',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{
                          width: '6px', height: '6px', borderRadius: '50%',
                          background: collectionName === col ? 'var(--blue)' : 'var(--text-muted)',
                          flexShrink: 0
                        }} />
                        <span style={{
                          fontSize: '12px',
                          color: collectionName === col ? 'var(--blue-bright)' : 'var(--text-secondary)',
                          fontFamily: 'Space Mono',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: collectionName === col ? 700 : 400
                        }}>
                          {col}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Document */}
                <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
                  <a href="/ingest" style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    textDecoration: 'none',
                    padding: '8px 12px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    fontFamily: 'Space Mono',
                    transition: 'border-color 0.2s'
                  }}>
                    <span style={{ color: 'var(--blue)', fontSize: '14px' }}>+</span>
                    ADD DOCUMENT
                  </a>
                </div>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {Object.keys(groupedHistory).length === 0 ? (
                  <div style={{ padding: '20px 12px', textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      No chat history yet.
                    </p>
                  </div>
                ) : (
                  Object.entries(groupedHistory).map(([date, items]) => (
                    <div key={date} style={{ marginBottom: '16px' }}>
                      {/* Date label */}
                      <p style={{
                        fontSize: '10px', color: 'var(--text-muted)',
                        fontFamily: 'Space Mono', letterSpacing: '1px',
                        padding: '4px 8px', marginBottom: '4px'
                      }}>
                        {date}
                      </p>

                      {/* History items */}
                      {items.map((item, i) => (
                        <div
                          key={i}
                          onClick={() => handleSelectHistory(item)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            marginBottom: '4px',
                            background: 'transparent',
                            border: '1px solid transparent',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--bg-hover)'
                            e.currentTarget.style.borderColor = 'var(--border)'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.borderColor = 'transparent'
                          }}
                        >
                          <p style={{
                            fontSize: '12px', color: 'var(--text-primary)',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap', marginBottom: '4px'
                          }}>
                            {item.question}
                          </p>
                          <p style={{
                            fontSize: '10px', color: 'var(--text-muted)',
                            fontFamily: 'Space Mono'
                          }}>
                            {item.collection}
                          </p>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Chat Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

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
                  <span style={{
                    fontSize: '10px', fontFamily: 'Space Mono',
                    color: 'var(--text-muted)', marginBottom: '6px',
                    letterSpacing: '1px'
                  }}>
                    {msg.role === 'user' ? 'YOU' : 'SYNTHARA'}
                  </span>

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
                        strong: ({children}) => <strong style={{ color: msg.role === 'user' ? '#fff' : 'var(--blue-bright)', fontWeight: 600 }}>{children}</strong>,
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

                  {msg.role === 'assistant' && msg.sources?.length > 0 && (
                    <div style={{ maxWidth: '80%', width: '100%' }}>
                      <SourceCard sources={msg.sources} />
                    </div>
                  )}
                </div>
              ))}

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
                placeholder={`Ask anything about "${collectionName}"...`}
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
      </div>
    </div>
  )
}