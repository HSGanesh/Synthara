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

const NO_COLLECTION_MSG = () => ({
  role: 'assistant',
  content: `## 👋 Welcome to Synthara!\n\nSynthara is a developer intelligence assistant that answers questions about your **code, repositories, and documents**.\n\nTo get started:\n1. **Upload a document** (PDF, TXT, MD) via the [Ingest tab](/ingest)\n2. **Import a GitHub repo** via the [GitHub tab](/github)\n3. Then come back here and ask anything about it!\n\nI can explain architecture, trace function calls, summarise README files, answer code questions, and more.`,
  sources: [],
  isOnboarding: true,
})

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return isMobile
}

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
      onMouseLeave={() => { setHovered(false); if (!editing) setDraftTitle(conv.title) }}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        padding: '10px 10px',
        borderRadius: '8px',
        marginBottom: '2px',
        background: isActive ? 'var(--blue-glow)' : hovered ? 'var(--bg-hover)' : 'transparent',
        border: `1px solid ${isActive ? 'var(--blue-dim)' : hovered ? 'var(--border)' : 'transparent'}`,
        transition: 'all 0.15s',
        cursor: 'pointer',
        gap: '8px',
        minHeight: '48px', // touch target
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
              color: 'var(--text-primary)', fontSize: '13px',
              padding: '4px 6px', outline: 'none',
            }}
          />
        ) : (
          <p style={{
            fontSize: '13px',
            color: isActive ? 'var(--blue-bright)' : 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginBottom: '3px', lineHeight: 1.4,
            fontWeight: isActive ? 700 : 400,
          }}>
            {conv.title}
          </p>
        )}
        <p style={{
          fontSize: '11px', color: 'var(--text-muted)',
          fontFamily: 'Space Mono',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {conv.collection} · {conv.messages.length} msg{conv.messages.length !== 1 ? 's' : ''}
        </p>
      </div>

      {(hovered || isActive) && !editing && (
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); setEditing(true) }}
            title="Rename"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', padding: '4px 6px', borderRadius: '4px', minWidth: '28px', minHeight: '28px' }}
          >✎</button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(conv.session_id) }}
            disabled={isDeleting}
            title="Delete"
            style={{ background: 'none', border: 'none', color: isDeleting ? 'var(--text-muted)' : '#e05555', cursor: isDeleting ? 'not-allowed' : 'pointer', fontSize: '15px', padding: '4px 6px', borderRadius: '4px', minWidth: '28px', minHeight: '28px' }}
          >{isDeleting ? '…' : '×'}</button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Sidebar (shared between mobile drawer + desktop panel)
// ─────────────────────────────────────────────

function SidebarContent({
  collections, collectionName, hasCollections,
  conversations, sessionId, deletingId,
  onSelectCollection, onNewChat, onSelectConversation,
  onDeleteConversation, onRenameConversation, onRefreshHistory,
  onClose, isMobile,
}) {
  const groupedConvs = groupByDate(conversations)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Mobile header */}
      {isMobile && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '11px', fontFamily: 'Space Mono', color: 'var(--blue-bright)', letterSpacing: '1.5px' }}>
            SYNTHARA
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '4px 8px' }}
          >×</button>
        </div>
      )}

      {/* Collections */}
      <div style={{ padding: '14px 12px 8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'Space Mono', letterSpacing: '1.2px', padding: '0 4px 8px' }}>
          COLLECTIONS
        </div>

        {hasCollections === null ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '6px 4px' }}>Loading...</p>
        ) : collections.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '6px 4px', lineHeight: 1.5 }}>
            No collections yet. Upload a document or import a GitHub repo.
          </p>
        ) : (
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {collections.map((col, i) => (
              <div
                key={i}
                onClick={() => { onSelectCollection(col); if (isMobile) onClose() }}
                style={{
                  padding: '10px 10px', borderRadius: '7px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
                  background: collectionName === col ? 'var(--blue-glow)' : 'transparent',
                  border: `1px solid ${collectionName === col ? 'var(--blue-dim)' : 'transparent'}`,
                  marginBottom: '3px', transition: 'all 0.15s',
                  minHeight: '44px',
                }}
              >
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, background: collectionName === col ? 'var(--blue)' : 'var(--text-muted)' }} />
                <span style={{
                  fontSize: '13px',
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
          textDecoration: 'none', marginTop: '8px', padding: '10px 10px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '7px', fontSize: '12px', color: 'var(--text-secondary)',
          fontFamily: 'Space Mono', minHeight: '44px',
        }}>
          <span style={{ color: 'var(--blue)', fontSize: '16px' }}>+</span>
          ADD DOCUMENT
        </a>
      </div>

      {/* Conversations */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
        <div style={{
          fontSize: '10px', color: 'var(--text-muted)',
          fontFamily: 'Space Mono', letterSpacing: '1.2px',
          padding: '0 4px 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>CONVERSATIONS</span>
          <button
            onClick={onRefreshHistory}
            title="Refresh"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', padding: '3px 6px', borderRadius: '4px' }}
          >↻</button>
        </div>

        {conversations.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '6px 4px', lineHeight: 1.6 }}>
            No conversations yet. Ask your first question!
          </p>
        ) : (
          Object.entries(groupedConvs).map(([date, convs]) => (
            <div key={date} style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'Space Mono', letterSpacing: '0.8px', padding: '0 4px', marginBottom: '6px' }}>
                {date}
              </p>
              {convs.map(conv => (
                <SidebarConvItem
                  key={conv.session_id}
                  conv={conv}
                  isActive={conv.session_id === sessionId}
                  onSelect={(c) => { onSelectConversation(c); if (isMobile) onClose() }}
                  onDelete={onDeleteConversation}
                  onRename={onRenameConversation}
                  isDeleting={deletingId === conv.session_id}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* New Chat button (mobile bottom) */}
      {isMobile && (
        <div style={{ padding: '12px 12px 16px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => { onNewChat(); onClose() }}
            style={{
              width: '100%', padding: '14px',
              background: 'var(--blue)', border: 'none', color: '#fff',
              cursor: 'pointer', fontSize: '13px', fontFamily: 'Space Mono',
              borderRadius: '8px', fontWeight: 700, letterSpacing: '0.5px',
            }}
          >+ NEW CHAT</button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Chat component
// ─────────────────────────────────────────────

export default function Chat() {
  const isMobile = useIsMobile()

  // ── Core state ────────────────────────────────────────────────────────
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('synthara_session_id') || null)
  const [messages, setMessages] = useState([WELCOME_MSG])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [overviewLoading, setOverviewLoading] = useState(false)

  const [collectionName, setCollectionName] = useState(() => localStorage.getItem('synthara_collection') || null)
  const [collections, setCollections] = useState([])
  const [hasCollections, setHasCollections] = useState(null)

  // Sidebar: desktop = panel toggle, mobile = drawer
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile) // desktop open by default
  const [conversations, setConversations] = useState([])
  const [deletingId, setDeletingId] = useState(null)
  const [initialised, setInitialised] = useState(false)

  const bottomRef = useRef()
  const textareaRef = useRef()

  // Close sidebar when switching to mobile
  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
    else setSidebarOpen(true)
  }, [isMobile])

  // ── Derived: convo memory ─────────────────────────────────────────────
  const convoMemory = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .filter(m => !m.isOnboarding)
    .map(m => ({ role: m.role, content: m.content }))
    .slice(-20)

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
    if (!token) { setHasCollections(false); setInitialised(true); return }

    let mounted = true
    const init = async () => {
      try {
        const colRes = await getMyCollections()
        if (!mounted) return
        const cols = colRes.collections || []
        setCollections(cols)
        setHasCollections(cols.length > 0)

        let activeCol = localStorage.getItem('synthara_collection')
        if (!activeCol || !cols.includes(activeCol)) {
          activeCol = colRes.last_active_collection || (cols.length > 0 ? cols[0] : null)
        }
        if (mounted) setCollectionName(activeCol)

        const histRes = await getChatHistory()
        if (!mounted) return
        const convs = histRes.history || []
        setConversations(convs)

        const savedSession = localStorage.getItem('synthara_session_id')
        if (savedSession) {
          const existing = convs.find(c => c.session_id === savedSession)
          if (existing && existing.messages.length > 0) restoreConversation(existing)
          else { setMessages([WELCOME_MSG]); setSessionId(null) }
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
    return `${username}__${collectionName || 'default'}`
  }, [collectionName])

  // ── Actions ───────────────────────────────────────────────────────────

  const handleNewChat = useCallback(() => {
    setSessionId(crypto.randomUUID())
    setMessages(hasCollections ? [WELCOME_MSG] : [NO_COLLECTION_MSG()])
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
    } catch (e) { console.error(e) }
    finally { setDeletingId(null) }
  }, [sessionId, handleNewChat])

  const handleRenameConversation = useCallback(async (sid, title) => {
    try {
      await renameConversation(sid, title)
      setConversations(prev => prev.map(c => c.session_id === sid ? { ...c, title } : c))
    } catch (e) { console.error(e) }
  }, [])

  const handleSelectCollection = useCallback((col) => {
    setCollectionName(col)
    const username = localStorage.getItem('username')
    updateLastCollection(`${username}__${col}`).catch(() => {})
    setSessionId(crypto.randomUUID())
    setMessages([{ role: 'assistant', content: `Switched to **${col}**. Ask me anything about it.`, sources: [] }])
  }, [])

  const handleRepoOverview = async () => {
    if (overviewLoading || loading || !hasCollections || !collectionName) return
    const sid = sessionId || crypto.randomUUID()
    if (!sessionId) setSessionId(sid)
    setMessages(prev => [...prev, { role: 'user', content: 'Explain this repository', sources: [] }])
    setOverviewLoading(true)
    try {
      const res = await getRepoOverview(scopedCollection(), sid)
      setMessages(prev => [...prev, { role: 'assistant', content: res.overview, sources: [], isOverview: true, filesAnalysed: res.files_analysed }])
      await refreshHistory()
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Could not generate repository overview. Make sure this collection has ingested files.', sources: [] }])
    } finally { setOverviewLoading(false) }
  }

  const handleSend = async () => {
    if (!input.trim() || loading || overviewLoading) return
    if (!hasCollections || !collectionName) {
      setMessages(prev => [...prev, { role: 'user', content: input.trim() }, NO_COLLECTION_MSG()])
      setInput('')
      return
    }
    const question = input.trim()
    setInput('')
    // Reset textarea height on mobile
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setMessages(prev => [...prev, { role: 'user', content: question }])
    setLoading(true)
    const sid = sessionId || crypto.randomUUID()
    if (!sessionId) setSessionId(sid)
    try {
      const res = await askQuestion(question, scopedCollection(), convoMemory, sid)
      setMessages(prev => [...prev, { role: 'assistant', content: res.answer, sources: res.sources || [] }])
      await refreshHistory()
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please ensure the backend is running.', sources: [] }])
    } finally { setLoading(false) }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // Auto-grow textarea
  const handleInputChange = (e) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: isMobile ? 'column' : 'row', paddingTop: '56px', overflow: 'hidden' }}>

      {/* ── Mobile backdrop ── */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(2px)',
            animation: 'fadeIn 0.18s ease both',
          }}
        />
      )}

      {/* ── Mobile drawer / Desktop sidebar panel ── */}
      {(sidebarOpen || !isMobile) && (
        <div style={{
          // Mobile: fixed full-height drawer from left
          // Desktop: static flex column
          ...(isMobile ? {
            position: 'fixed',
            top: 0, left: 0, bottom: 0,
            width: '82vw',
            maxWidth: '320px',
            zIndex: 50,
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
            boxShadow: '4px 0 24px rgba(0,0,0,0.4)',
          } : {
            width: '252px',
            flexShrink: 0,
            borderRight: '1px solid var(--border)',
          }),
          background: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
          height: isMobile ? '100%' : undefined,
          overflowY: isMobile ? 'auto' : undefined,
        }}>
          <SidebarContent
            collections={collections}
            collectionName={collectionName}
            hasCollections={hasCollections}
            conversations={conversations}
            sessionId={sessionId}
            deletingId={deletingId}
            onSelectCollection={handleSelectCollection}
            onNewChat={handleNewChat}
            onSelectConversation={handleSelectConversation}
            onDeleteConversation={handleDeleteConversation}
            onRenameConversation={handleRenameConversation}
            onRefreshHistory={refreshHistory}
            onClose={() => setSidebarOpen(false)}
            isMobile={isMobile}
          />
        </div>
      )}

      {/* ── Main chat area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Top bar */}
        <div style={{
          padding: isMobile ? '8px 12px' : '10px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px',
          flexShrink: 0,
          background: 'var(--bg-primary)',
        }}>
          <button
            onClick={() => setSidebarOpen(p => !p)}
            title="Toggle sidebar"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', padding: '6px 8px', borderRadius: '6px', minWidth: '36px', minHeight: '36px' }}
          >☰</button>

          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--blue)', animation: 'pulse-blue 2s infinite', flexShrink: 0 }} />

          {!isMobile && (
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'Space Mono' }}>
              SYNTHARA / ASK
            </span>
          )}

          {collectionName && (
            <span style={{
              fontSize: '11px', color: 'var(--blue-bright)',
              fontFamily: 'Space Mono',
              background: 'var(--blue-glow)',
              border: '1px solid var(--blue-dim)',
              padding: '3px 10px', borderRadius: '4px',
              maxWidth: isMobile ? '100px' : '200px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              flexShrink: 1,
            }}>
              {collectionName}
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            {/* Repo overview — icon only on mobile */}
            <button
              onClick={handleRepoOverview}
              disabled={overviewLoading || loading || !hasCollections}
              title="Repo Overview"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: (!hasCollections || overviewLoading) ? 'var(--text-muted)' : 'var(--blue-bright)',
                cursor: (overviewLoading || loading || !hasCollections) ? 'not-allowed' : 'pointer',
                fontSize: isMobile ? '16px' : '11px',
                fontFamily: 'Space Mono',
                padding: isMobile ? '6px 10px' : '6px 14px',
                borderRadius: '6px',
                fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: '6px',
                minHeight: '36px',
              }}
            >
              <span>⬡</span>
              {!isMobile && (overviewLoading ? 'ANALYSING...' : 'REPO OVERVIEW')}
            </button>

            {/* New chat — icon+text on desktop, compact on mobile */}
            {!isMobile && (
              <button
                onClick={handleNewChat}
                style={{
                  background: 'var(--blue)', border: 'none', color: '#fff',
                  cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Mono',
                  padding: '6px 14px', borderRadius: '6px',
                  fontWeight: 700, letterSpacing: '0.5px', minHeight: '36px',
                }}
              >+ NEW CHAT</button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px 12px' : '28px 32px' }}>
          <div style={{ maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px' }}>

            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex', flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                animation: 'fadeIn 0.25s ease both',
              }}>
                <span style={{ fontSize: '10px', fontFamily: 'Space Mono', color: 'var(--text-muted)', marginBottom: '5px', letterSpacing: '1px' }}>
                  {msg.role === 'user' ? 'YOU' : 'SYNTHARA'}
                  {msg.isOverview && (
                    <span style={{
                      marginLeft: '8px', background: 'var(--blue-glow)',
                      border: '1px solid var(--blue-dim)', color: 'var(--blue-bright)',
                      padding: '1px 7px', borderRadius: '3px', fontSize: '9px',
                    }}>REPO OVERVIEW · {msg.filesAnalysed} files</span>
                  )}
                </span>

                <div style={{
                  maxWidth: isMobile ? '92%' : '82%',
                  padding: isMobile ? '12px 14px' : '14px 18px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user' ? 'var(--blue)' : 'var(--bg-card)',
                  border: msg.role === 'user' ? 'none' : `1px solid ${(msg.isOverview || msg.isOnboarding) ? 'var(--blue-dim)' : 'var(--border)'}`,
                  color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                  fontSize: isMobile ? '14px' : '14px',
                  lineHeight: 1.75,
                  wordBreak: 'break-word',
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
                  <div style={{ maxWidth: isMobile ? '92%' : '82%', width: '100%' }}>
                    <SourceCard sources={msg.sources} />
                  </div>
                )}
              </div>
            ))}

            {(loading || overviewLoading) && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', animation: 'fadeIn 0.2s ease both' }}>
                <span style={{ fontSize: '10px', fontFamily: 'Space Mono', color: 'var(--text-muted)', marginBottom: '5px', letterSpacing: '1px' }}>SYNTHARA</span>
                <div style={{ padding: '14px 18px', borderRadius: '16px 16px 16px 4px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <Loader text={overviewLoading ? 'Analysing repository...' : 'Retrieving context...'} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input bar */}
        <div style={{
          padding: isMobile ? '10px 12px 12px' : '14px 32px 18px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-primary)',
          flexShrink: 0,
          // Safe area for mobile home bar
          paddingBottom: isMobile ? 'max(12px, env(safe-area-inset-bottom))' : '18px',
        }}>
          <div style={{ maxWidth: '780px', margin: '0 auto', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKey}
              placeholder={
                !hasCollections ? 'Upload a document or GitHub repo first...'
                : collectionName ? `Ask about "${collectionName}"...`
                : 'Select a collection to start...'
              }
              rows={1}
              disabled={!initialised}
              style={{
                flex: 1, resize: 'none', padding: '12px 14px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: '12px', color: 'var(--text-primary)',
                fontSize: '15px', fontFamily: 'DM Sans',
                outline: 'none', lineHeight: 1.5,
                transition: 'border-color 0.2s',
                opacity: !initialised ? 0.5 : 1,
                maxHeight: '120px', overflowY: 'auto',
                // Prevent iOS zoom on focus (font must be >= 16px, handled above)
                WebkitTextSizeAdjust: '100%',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--blue)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading || overviewLoading || !initialised}
              style={{
                padding: '12px 16px',
                background: (input.trim() && !loading && !overviewLoading && initialised) ? 'var(--blue)' : 'var(--bg-card)',
                color: (input.trim() && !loading && !overviewLoading && initialised) ? '#fff' : 'var(--text-muted)',
                border: `1px solid ${(input.trim() && !loading && !overviewLoading && initialised) ? 'var(--blue)' : 'var(--border)'}`,
                borderRadius: '12px',
                cursor: (input.trim() && !loading && !overviewLoading && initialised) ? 'pointer' : 'not-allowed',
                fontFamily: 'Space Mono', fontSize: isMobile ? '14px' : '13px',
                fontWeight: 700, transition: 'all 0.2s',
                minWidth: isMobile ? '52px' : 'auto',
                minHeight: '46px',
                flexShrink: 0,
              }}
            >{isMobile ? '↑' : 'ASK'}</button>
          </div>

          {!isMobile && (
            <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'Space Mono' }}>
              ENTER to send · SHIFT+ENTER for new line
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
