'use client'
import { useState, useEffect } from 'react'
import { fetchApi } from '@/lib/fetchApi'

interface BookLoan {
  id: string
  status: string
  borrowedAt: string
  dueDate: string | null
  returnedAt: string | null
  book: { id: string; title: string; author: string | null; category: string | null }
}

const LOAN_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  ACTIVE:   { bg: '#d1fae5', color: '#065f46', label: 'En cours'   },
  RETURNED: { bg: '#f1f5f9', color: '#475569', label: 'Rendu'      },
  OVERDUE:  { bg: '#fee2e2', color: '#991b1b', label: 'En retard'  },
}

export default function SectionStudentLibrary() {
  const [loans, setLoans]     = useState<BookLoan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchApi('/api/v2/library/my-loans', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (!d.success) throw new Error(d.message || 'Erreur')
        setLoans(d.data || [])
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false))
  }, [])

  const active  = loans.filter(l => l.status === 'ACTIVE').length
  const overdue = loans.filter(l => l.status === 'OVERDUE').length

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 26 }}>
        <div style={sTitle}>Mes lectures</div>
        <div style={sSub}>Livres empruntés à la bibliothèque de l&apos;établissement</div>
      </div>

      {!loading && !error && loans.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { icon: '📚', bg: '#dbeafe', val: loans.length,  label: 'Emprunts au total',  color: '#1e40af' },
            { icon: '📖', bg: '#d1fae5', val: active,         label: 'En cours',            color: '#065f46' },
            { icon: '⏰', bg: '#fee2e2', val: overdue,        label: 'En retard',           color: '#991b1b' },
          ].map((k, i) => (
            <div key={i} style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', padding: '18px 20px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 10 }}>{k.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: k.color }}>{k.val}</div>
              <div style={{ fontSize: 14, color: '#a89478', fontWeight: 600, marginTop: 4 }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
          <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!loading && error && (
        <div style={{ background: '#fee2e2', borderRadius: 14, padding: '16px 22px', color: '#dc2626', fontWeight: 700 }}>⚠️ {error}</div>
      )}

      {!loading && !error && loans.length === 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '60px 20px', textAlign: 'center', color: '#a89478' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Aucun emprunt enregistré</div>
          <div style={{ fontSize: 14, marginTop: 6 }}>Demandez au bibliothécaire d&apos;enregistrer un emprunt en votre nom</div>
        </div>
      )}

      {!loading && !error && loans.length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Titre', 'Catégorie', 'Emprunté le', 'Date limite', 'Statut'].map(h => (
                <th key={h} style={thSt}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {loans.map(l => {
                const badge = LOAN_BADGE[l.status] ?? { bg: '#f1f5f9', color: '#475569', label: l.status }
                const isOverdue = l.status === 'ACTIVE' && l.dueDate && new Date(l.dueDate) < new Date()
                return (
                  <tr key={l.id}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                    <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209', maxWidth: 260 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.book.title}</div>
                      {l.book.author && <div style={{ fontSize: 13, color: '#a89478', marginTop: 2 }}>{l.book.author}</div>}
                    </td>
                    <td style={tdSt}>{l.book.category ?? '—'}</td>
                    <td style={tdSt}>{new Date(l.borrowedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                    <td style={tdSt}>
                      {l.dueDate ? (
                        <span style={{ fontWeight: 600, color: isOverdue ? '#dc2626' : '#6b5c45' }}>
                          {isOverdue && '⚠️ '}{new Date(l.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={tdSt}>
                      <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800, background: isOverdue ? '#fee2e2' : badge.bg, color: isOverdue ? '#991b1b' : badge.color }}>
                        {isOverdue ? '⏰ En retard' : badge.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const thSt: React.CSSProperties = { padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '12px 14px', fontSize: 15, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
