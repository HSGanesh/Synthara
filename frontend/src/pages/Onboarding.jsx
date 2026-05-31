import { useState } from 'react'
import Loader from '../components/Loader'
import SourceCard from '../components/SourceCard'
import { askQuestion } from '../services/api'

const ONBOARD_QUESTIONS = [
  "Explain the overall project architecture",
  "What is the tech stack used in this project?",
  "How does authentication work in this project?",
  "What are the main API endpoints available?",
  "How is the folder structure organized?",
]

export default function Onboarding() {
  const [results, setResults] = useState({})
  const [loading, setLoading] = useState(null)

  const handleAsk = async (question) => {
    if (results[question] || loading) return
    setLoading(question)
    try {
      const res = await askQuestion(question)
      setResults(prev => ({ ...prev, [question]: res }))
    } catch {
      setResults(prev => ({ ...prev, [question]: { answer: 'Could not retrieve answer. Ensure backend is running.', sources: [] } }))
    } finally {
      setLoading(null)
    }
  }

  const handleRunAll = async () => {
    for (const q of ONBOARD_QUESTIONS) {
      if (!results[q]) await handleAsk(q)
    }
  }

  return (
    <div style={{ minHeight: '100vh', paddingTop: '56px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 32px' }}>

        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <p style={{ fontSize: '11px', fontFamily: 'Space Mono', color: 'var(--blue-bright)', letterSpacing: '2px', marginBottom: '12px' }}>
            SYNTHARA / ONBOARD
          </p>
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', letterSpacing: '-0.5px' }}>
            New Developer Onboarding
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.7 }}>
            Understand the entire project in minutes. Synthara retrieves answers from your actual codebase and documentation.
          </p>
        </div>

        {/* Run All button */}
        <button
          onClick={handleRunAll}
          disabled={!!loading}
          style={{
            marginBottom: '32px',
            padding: '12px 24px',
            background: 'var(--blue)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontFamily: 'Space Mono',
            fontSize: '13px',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            letterSpacing: '0.5px',
            opacity: loading ? 0.6 : 1
          }}
        >
          RUN ALL QUESTIONS →
        </button>

        {/* Questions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {ONBOARD_QUESTIONS.map((q, i) => (
            <div key={i} style={{
              background: 'var(--bg-card)',
              border: `1px solid ${results[q] ? 'var(--border-bright)' : 'var(--border)'}`,
              borderRadius: '12px',
              overflow: 'hidden',
              animation: `fadeIn 0.4s ease ${i * 0.08}s both`,
              transition: 'border-color 0.2s'
            }}>
              {/* Question header */}
              <div
                onClick={() => handleAsk(q)}
                style={{
                  padding: '16px 20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: results[q] || loading === q ? 'default' : 'pointer',
                  borderBottom: results[q] || loading === q ? '1px solid var(--border)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    fontSize: '11px', fontFamily: 'Space Mono',
                    color: results[q] ? 'var(--success)' : 'var(--blue-bright)',
                    minWidth: '24px'
                  }}>
                    {results[q] ? '✓' : String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>{q}</span>
                </div>
                {!results[q] && loading !== q && (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Space Mono' }}>
                    ASK →
                  </span>
                )}
              </div>

              {/* Loading state */}
              {loading === q && (
                <div style={{ padding: '16px 20px' }}>
                  <Loader text="Retrieving from knowledge base..." />
                </div>
              )}

              {/* Answer */}
              {results[q] && (
                <div style={{ padding: '16px 20px' }}>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '8px' }}>
                    {results[q].answer}
                  </p>
                  <SourceCard sources={results[q].sources} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
