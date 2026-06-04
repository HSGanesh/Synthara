import { useState, useRef, useEffect, useCallback } from 'react'
import SourceCard from '../components/SourceCard'
import Loader from '../components/Loader'
import ReactMarkdown from 'react-markdown'
import {
  askQuestion,
  getMyCollections,
  getChatHistory,
  getConversation,
  deleteConversation,
  renameConversation,
  getRepoOverview,
  updateLastCollection,
} from '../services/api'

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const WELCOME_MSG = {
  role: 'assistant',
  content: "Hello. I'm Synthara. Ask me anything about your codebase, documentation, or project.",
  sources: [],
}

const NO_COLLECTION_MSG = (onIngest) => ({
  role: 'assistant',
  content: `## 👋 Welcome to Synthara!

Synthara is a developer intelligence assistant that answers questions about your **code, repositories, and documents**.

To get started:
1. **Upload a document** (PDF, TXT, MD) via the [Ingest tab](/ingest)
2. **Import a GitHub repo** via the [GitHub tab](/github)
3. Then come back here and ask anything about it!

I can explain architecture, trace function calls, summarise README files, answer code questions, and more.`,
  sources: [],
  isOnboarding: true,
})

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function groupByDate(conversations) {
  const groups = {}
  conversations.forEach(conv => {
    const d = new Date(conv.updated_at || conv.created_at)
    const today = new Date()
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
    let label
    if (d.toDateString() === today.toDateString()) label = 'Today'
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday'
    else label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    if (!groups[label]) groups[label] = []
    groups[label].push(conv)
  })
  return groups
}

// ─────────────────────────────────────────────
// Sidebar conversation item
// ─────────────────────────────────────────────

function SidebarConvItem({ conv, isActive, onSelect, onDelete, onRename, isDeleting }) {
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(conv.title)

  const commitRename = () => {
    setEditing(false)
    if (draftTitle.trim() && draftTitle.trim() !== conv.title) {
      onRename(conv.session_id, draftTitle.trim())
    } else {
      setDraftTitle(conv.title)
    }
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setEditing(false); setDraftTitle(conv.title) }}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        padding: '8px 10px',
        borderRadius: '8px',
        marginBottom: '2px',
        background: isActive ? 'var(--blue-glow)' : hovered ? 'var(--bg-hover)' : 'transparent',
        border: `1px solid ${isActive ? 'var(--blue-dim)' : hovered ? 'var(--border)' : 'transparent'}`,
        transition: 'all 0.15s',
        cursor: 'pointer',
        gap: '8px',
      }}
    >
      <div onClick={() => !editing && onSelect(conv)} style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <input
            autoFocus
            value={draftTitle}
            onChange={e => setDraftTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setEditing(false); setDraftTitle(conv.title) } }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', background: 'var(--bg-primary)',
              border: '1px solid var(--blue)', borderRadius: '4px',
              color: 'var(--text-primary)', fontSize: '12px',
              padding: '2px 6px', outline: 'none',
            }}
          />
        ) : (
          <p style={{
            fontSize: '12px',
            color: isActive ? 'var(--blue-bright)' : 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginBottom: '2px', lineHeight: 1.4,
            fontWeight: isActive ? 700 : 400,
          }}>
            {conv.title}
          </p>
        )}
        <p style={{
          fontSize: '10px', color: 'var(--text-muted)',
          fontFamily: 'Space Mono',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {conv.collection} · {conv.messages.length} msg{conv.messages.length !== 1 ? 's' : ''}
        </p>
      </div>

      {hovered && !editing && (
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); setEditing(true) }}
            title="Rename"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', padding: '2px 4px', borderRadius: '4px' }}
          >✎</button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(conv.session_id) }}
            disabled={isDeleting}
            title="Delete"
            style={{ background: 'none', border: 'none', color: isDeleting ? 'var(--text-muted)' : '#e05555', cursor: isDeleting ? 'not-allowed' : 'pointer', fontSize: '13px', padding: '2px 4px', borderRadius: '4px' }}
          >{isDeleting ? '…' : '×'}</button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Chat component
// ─────────────────────────────────────────────

export default function Chat() {
  // ── Core state ────────────────────────────────────────────────────────
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('synthara_session_id') || null)
  const [messages, setMessages] = useState([WELCOME_MSG])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [overviewLoading, setOverviewLoading] = useState(false)

  // Active collection — set from last_active_collection on load
  const [collectionName, setCollectionName] = useState(() => localStorage.getItem('synthara_collection') || null)
  const [collections, setCollections] = useState([])
  const [hasCollections, setHasCollections] = useState(null) // null = loading

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [conversations, setConversations] = useState([]) // flat list, newest first
  const [deletingId, setDeletingId] = useState(null)
  const [initialised, setInitialised] = useState(false)

  const bottomRef = useRef()

  // ── Derived: convo memory for LLM context ────────────────────────────
  const convoMemory = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .filter(m => !m.isOnboarding)
    .map(m => ({ role: m.role, content: m.content }))
    .slice(-20)  // last 20 turns max

  // ── Persist session + collection ─────────────────────────────────────
  useEffect(() => {
    if (sessionId) localStorage.setItem('synthara_session_id', sessionId)
    else localStorage.removeItem('synthara_session_id')
  }, [sessionId])

  useEffect(() => {
    if (collectionName) localStorage.setItem('synthara_collection', collectionName)
    else localStorage.removeItem('synthara_collection')
  }, [collectionName])

  // ── Initial data load ─────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setHasCollections(false)
      setInitialised(true)
      return
    }

    let mounted = true
    const init = async () => {
      try {
        // Load collections and last active collection
        const colRes = await getMyCollections()
        if (!mounted) return

        const cols = colRes.collections || []
        setCollections(cols)
        setHasCollections(cols.length > 0)

        // Determine active collection
        // Priority: localStorage → last_active_collection from server → first collection
        let activeCol = localStorage.getItem('synthara_collection')
        if (!activeCol || !cols.includes(activeCol)) {
          activeCol = colRes.last_active_collection || (cols.length > 0 ? cols[0] : null)
        }
        if (mounted) setCollectionName(activeCol)

        // Load conversation history
        const histRes = await getChatHistory()
        if (!mounted) return
        const convs = histRes.history || []
        setConversations(convs)

        // Restore active conversation if session_id is set
        const savedSession = localStorage.getItem('synthara_session_id')
        if (savedSession) {
          const existing = convs.find(c => c.session_id === savedSession)
          if (existing && existing.messages.length > 0) {
            restoreConversation(existing)
          } else {
            // Session not found in DB, show welcome
            setMessages([WELCOME_MSG])
            setSessionId(null)
          }
        } else {
          setMessages(cols.length === 0 ? [NO_COLLECTION_MSG()] : [WELCOME_MSG])
        }
      } catch (e) {
        console.error('Init error:', e)
      } finally {
        if (mounted) setInitialised(true)
      }
    }

    init()
    return () => { mounted = false }
  }, [])

  // ── Auto-scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, overviewLoading])

  // ── Helpers ───────────────────────────────────────────────────────────

  const restoreConversation = useCallback((conv) => {
    const restored = [WELCOME_MSG]
    conv.messages.forEach(item => {
      restored.push({ role: 'user', content: item.question })
      restored.push({ role: 'assistant', content: item.answer, sources: item.sources || [] })
    })
    setMessages(restored)
    setSessionId(conv.session_id)
    // strip username prefix for display
    const username = localStorage.getItem('username')
    const prefix = `${username}__`
    const displayCol = conv.collection_raw?.startsWith(prefix)
      ? conv.collection_raw.replace(prefix, '')
      : conv.collection
    setCollectionName(displayCol)
  }, [])

  const refreshHistory = useCallback(async () => {
    try {
      const histRes = await getChatHistory()
      setConversations(histRes.history || [])
    } catch (e) { console.error(e) }
  }, [])

  const scopedCollection = useCallback(() => {
    const username = localStorage.getItem('username')
    const col = collectionName || 'default'
    return `${username}__${col}`
  }, [collectionName])

  // ── Actions ───────────────────────────────────────────────────────────

  const handleNewChat = useCallback(() => {
    const newId = crypto.randomUUID()
    setSessionId(newId)
    setMessages(hasCollections ? [WELCOME_MSG] : [NO_COLLECTION_MSG()])
    // Keep current collection active — do NOT reset it
  }, [hasCollections])

  const handleSelectConversation = useCallback((conv) => {
    restoreConversation(conv)
  }, [restoreConversation])

  const handleDeleteConversation = useCallback(async (sid) => {
    setDeletingId(sid)
    try {
      await deleteConversation(sid)
      setConversations(prev => prev.filter(c => c.session_id !== sid))
      if (sid === sessionId) handleNewChat()
    } catch (e) {
      console.error('Delete failed', e)
    } finally {
      setDeletingId(null)
    }
  }, [sessionId, handleNewChat])

  const handleRenameConversation = useCallback(async (sid, title) => {
    try {
      await renameConversation(sid, title)
      setConversations(prev => prev.map(c => c.session_id === sid ? { ...c, title } : c))
    } catch (e) { console.error('Rename failed', e) }
  }, [])

  const handleSelectCollection = useCallback((col) => {
    setCollectionName(col)
    // Update server-side last_active_collection
    const username = localStorage.getItem('username')
    updateLastCollection(`${username}__${col}`).catch(() => {})
    // Start a new chat under this collection
    const newId = crypto.randomUUID()
    setSessionId(newId)
    setMessages([{
      role: 'assistant',
      content: `Switched to **${col}**. Ask me anything about it.`,
      sources: [],
    }])
  }, [])

  const handleRepoOverview = async () => {
    if (overviewLoading || loading) return
    if (!hasCollections || !collectionName) {
      setMessages(prev => [...prev, NO_COLLECTION_MSG()])
      return
    }

    // Ensure we have a session
    const sid = sessionId || crypto.randomUUID()
    if (!sessionId) setSessionId(sid)

    setMessages(prev => [...prev, { role: 'user', content: 'Explain this repository', sources: [] }])
    setOverviewLoading(true)

    try {
      const res = await getRepoOverview(scopedCollection(), sid)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.overview,
        sources: [],
        isOverview: true,
        filesAnalysed: res.files_analysed,
      }])
      await refreshHistory()
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Could not generate repository overview. Make sure this collection has ingested files.',
        sources: [],
      }])
    } finally {
      setOverviewLoading(false)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || loading || overviewLoading) return

    // Guard: no collections
    if (!hasCollections || !collectionName) {
      setMessages(prev => [...prev,
        { role: 'user', content: input.trim() },
        NO_COLLECTION_MSG(),
      ])
      setInput('')
      return
    }

    const question = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: question }])
    setLoading(true)

    // Ensure we have a session
    const sid = sessionId || crypto.randomUUID()
    if (!sessionId) setSessionId(sid)

    try {
      const res = await askQuestion(question, scopedCollection(), convoMemory, sid)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.answer,
        sources: res.sources || [],
      }])
      // Refresh sidebar after successful response
      await refreshHistory()
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Please ensure the backend is running.',
        sources: [],
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // Group conversations by date for sidebar
  const groupedConvs = groupByDate(conversations)

  // ── Render ─────────────────────────────────────────────────────────────
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
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', padding: '4px 8px', borderRadius: '6px' }}
        >☰</button>

        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--blue)', animation: 'pulse-blue 2s infinite', flexShrink: 0 }} />

        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'Space Mono' }}>
          SYNTHARA / ASK
        </span>

        {collectionName && (
          <span style={{
            fontSize: '11px', color: 'var(--blue-bright)',
            fontFamily: 'Space Mono',
            background: 'var(--blue-glow)',
            border: '1px solid var(--blue-dim)',
            padding: '2px 10px', borderRadius: '4px',
            maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {collectionName}
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handleRepoOverview}
            disabled={overviewLoading || loading || !hasCollections}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: (!hasCollections || overviewLoading) ? 'var(--text-muted)' : 'var(--blue-bright)',
              cursor: (overviewLoading || loading || !hasCollections) ? 'not-allowed' : 'pointer',
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

            {/* Collections section */}
            <div style={{ padding: '12px 10px 6px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'Space Mono', letterSpacing: '1.2px', padding: '0 4px 6px' }}>
                COLLECTIONS
              </div>

              {hasCollections === null ? (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 4px' }}>Loading...</p>
              ) : collections.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 4px', lineHeight: 1.5 }}>
                  No collections yet. Upload a document or import a GitHub repo to get started.
                </p>
              ) : (
                <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
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
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: collectionName === col ? 'var(--blue)' : 'var(--text-muted)' }} />
                      <span style={{
                        fontSize: '12px',
                        color: collectionName === col ? 'var(--blue-bright)' : 'var(--text-secondary)',
                        fontFamily: 'Space Mono',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontWeight: collectionName === col ? 700 : 400,
                      }}>{col}</span>
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

            {/* Conversations */}
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
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', padding: '1px 4px', borderRadius: '4px' }}
                >↻</button>
              </div>

              {conversations.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 4px', lineHeight: 1.5 }}>
                  No conversations yet. Ask your first question!
                </p>
              ) : (
                Object.entries(groupedConvs).map(([date, convs]) => (
                  <div key={date} style={{ marginBottom: '18px' }}>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'Space Mono', letterSpacing: '0.8px', padding: '0 4px', marginBottom: '4px' }}>
                      {date}
                    </p>
                    {convs.map(conv => (
                      <SidebarConvItem
                        key={conv.session_id}
                        conv={conv}
                        isActive={conv.session_id === sessionId}
                        onSelect={handleSelectConversation}
                        onDelete={handleDeleteConversation}
                        onRename={handleRenameConversation}
                        isDeleting={deletingId === conv.session_id}
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
                  <span style={{ fontSize: '10px', fontFamily: 'Space Mono', color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '1px' }}>
                    {msg.role === 'user' ? 'YOU' : 'SYNTHARA'}
                    {msg.isOverview && (
                      <span style={{
                        marginLeft: '8px', background: 'var(--blue-glow)',
                        border: '1px solid var(--blue-dim)', color: 'var(--blue-bright)',
                        padding: '1px 7px', borderRadius: '3px', fontSize: '9px', letterSpacing: '0.5px',
                      }}>
                        REPO OVERVIEW · {msg.filesAnalysed} files
                      </span>
                    )}
                  </span>

                  <div style={{
                    maxWidth: '82%', padding: '14px 18px',
                    borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    background: msg.role === 'user' ? 'var(--blue)' : 'var(--bg-card)',
                    border: msg.role === 'user' ? 'none' : `1px solid ${(msg.isOverview || msg.isOnboarding) ? 'var(--blue-dim)' : 'var(--border)'}`,
                    color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                    fontSize: '14px', lineHeight: 1.75,
                  }}>
                    <ReactMarkdown
                      components={{
                        h2: ({ children }) => <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--blue-bright)', marginBottom: '6px', marginTop: '16px' }}>{children}</h2>,
                        h3: ({ children }) => <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', marginTop: '12px' }}>{children}</h3>,
                        p: ({ children }) => <p style={{ marginBottom: '8px' }}>{children}</p>,
                        ul: ({ children }) => <ul style={{ paddingLeft: '18px', marginBottom: '8px' }}>{children}</ul>,
                        ol: ({ children }) => <ol style={{ paddingLeft: '18px', marginBottom: '8px' }}>{children}</ol>,
                        li: ({ children }) => <li style={{ marginBottom: '4px' }}>{children}</li>,
                        strong: ({ children }) => <strong style={{ color: msg.role === 'user' ? '#fff' : 'var(--blue-bright)', fontWeight: 600 }}>{children}</strong>,
                        a: ({ href, children }) => <a href={href} style={{ color: 'var(--blue-bright)', textDecoration: 'underline' }}>{children}</a>,
                        code: ({ children }) => <code style={{ fontFamily: 'Space Mono', fontSize: '12px', background: 'rgba(29,111,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'var(--blue-bright)' }}>{children}</code>,
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
                  <span style={{ fontSize: '10px', fontFamily: 'Space Mono', color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '1px' }}>SYNTHARA</span>
                  <div style={{ padding: '14px 18px', borderRadius: '12px 12px 12px 2px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
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
                placeholder={
                  !hasCollections
                    ? 'Upload a document or GitHub repo first...'
                    : collectionName
                      ? `Ask anything about "${collectionName}"...`
                      : 'Select a collection to start...'
                }
                rows={1}
                disabled={!initialised}
                style={{
                  flex: 1, resize: 'none', padding: '13px 16px',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: '10px', color: 'var(--text-primary)',
                  fontSize: '14px', fontFamily: 'DM Sans',
                  outline: 'none', lineHeight: 1.5, transition: 'border-color 0.2s',
                  opacity: !initialised ? 0.5 : 1,
                }}
                onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading || overviewLoading || !initialised}
                style={{
                  padding: '13px 20px',
                  background: (input.trim() && !loading && !overviewLoading && initialised) ? 'var(--blue)' : 'var(--bg-card)',
                  color: (input.trim() && !loading && !overviewLoading && initialised) ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${(input.trim() && !loading && !overviewLoading && initialised) ? 'var(--blue)' : 'var(--border)'}`,
                  borderRadius: '10px',
                  cursor: (input.trim() && !loading && !overviewLoading && initialised) ? 'pointer' : 'not-allowed',
                  fontFamily: 'Space Mono', fontSize: '13px',
                  fontWeight: 700, letterSpacing: '0.5px', transition: 'all 0.2s',
                }}
              >ASK</button>
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
