'use client'
import { useState, useEffect, useCallback } from 'react'
import { BookOpen, AlarmClock, AlertTriangle, Package } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useT } from '@/lib/i18n'

interface Child { studentId: string; prenom: string; nom: string }

interface BookLoan {
  id: string
  status: string
  borrowedAt: string
  dueDate: string | null
  returnedAt: string | null
  book: { id: string; title: string; author: string | null; category: string | null }
  student: { id: string; firstName: string; lastName: string }
}

function loanBadge(t: (k: string) => string): Record<string, { bg: string; color: string; label: string }> {
  return {
    ACTIVE:   { bg: 'var(--green-light)', color: 'var(--green)', label: t('library.active')  },
    RETURNED: { bg: 'var(--bg2)', color: 'var(--text2)', label: t('library.returned') },
    OVERDUE:  { bg: 'var(--red-light)', color: 'var(--red)', label: t('library.overdue') },
  }
}

interface Props { userId?: string }

export default function SectionParentLibrary({ userId }: Props) {
  const t = useT('parent')
  const [children, setChildren]       = useState<Child[]>([])
  const [selectedChild, setSelected]  = useState<string>('')

  useEffect(() => {
    if (!userId) return
    fetchApi('/api/v2/parent/children', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (!d.success) return
        const kids: Child[] = (d.data || []).map((c: any) => ({
          studentId: c.studentId,
          prenom: c.prenom,
          nom: c.nom,
        }))
        setChildren(kids)
        if (kids.length > 0 && kids[0]) setSelected(kids[0].studentId)
      })
      .catch(() => {})
  }, [userId])

  const fetchLoansFn = useCallback(async (): Promise<BookLoan[]> => {
    const params = new URLSearchParams({ studentId: selectedChild })
    const res = await fetchApi(`/api/v2/library/my-loans?${params}`, { credentials: 'include' })
    const data = await res.json()
    if (!data.success) throw new Error(data.message || t('errorLoad'))
    return data.data || []
  }, [selectedChild, t])

  const { data: loans, loading, error, fromCache, cachedAt } = useCachedFetch<BookLoan[]>(
    selectedChild ? `parent-library-${selectedChild}` : '',
    fetchLoansFn,
  )
  const loanList = loans ?? []

  const active  = loanList.filter(l => l.status === 'ACTIVE').length
  const overdue = loanList.filter(l => l.status === 'OVERDUE').length

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 26 }}>
        <div style={sTitle}>{t('library.title')}</div>
        <div style={sSub}>{t('library.subtitle')}</div>
        {fromCache && cachedAt && (
          <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, padding: '5px 12px', fontSize: 13, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <Package size={14} strokeWidth={2} /> {t('cacheBadge').replace('{date}', new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))}
          </div>
        )}
      </div>

      {children.length > 1 && (
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('library.childFilter')}</span>
          <select
            value={selectedChild}
            onChange={e => setSelected(e.target.value)}
            style={{ background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 10, padding: '8px 14px', fontSize: 15, fontWeight: 700, color: 'var(--text)', outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
            {children.map(c => (
              <option key={c.studentId} value={c.studentId}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
      )}

      {!loading && !error && loanList.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { icon: BookOpen, bg: 'var(--blue-light)', val: loanList.length, label: t('library.totalLoans'), color: 'var(--blue)' },
            { icon: BookOpen, bg: 'var(--green-light)', val: active,        label: t('library.active'),    color: 'var(--green)' },
            { icon: AlarmClock, bg: 'var(--red-light)', val: overdue,       label: t('library.overdue'),   color: 'var(--red)' },
          ].map((k, i) => (
            <div key={i} style={{ background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '18px 20px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}><k.icon size={18} strokeWidth={2} /></div>
              <div style={{ fontSize: 26, fontWeight: 900, color: k.color }}>{k.val}</div>
              <div style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 600, marginTop: 4 }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
          <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!loading && error === 'OFFLINE_NO_CACHE' && <OfflineEmptyState />}

      {!loading && error && error !== 'OFFLINE_NO_CACHE' && (
        <div style={{ background: 'var(--red-light)', borderRadius: 14, padding: '16px 22px', color: 'var(--red)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={16} strokeWidth={2} /> {error}</div>
      )}

      {!loading && !error && loanList.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '60px 20px', textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><BookOpen size={40} strokeWidth={2} /></div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{t('library.emptyTitle')}</div>
          <div style={{ fontSize: 14, marginTop: 6 }}>{t('library.emptyDesc')}</div>
        </div>
      )}

      {!loading && !error && loanList.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 550 }}>
              <thead>
                <tr>{[t('library.titleCol'), t('library.category'), t('library.borrowedOn'), t('library.dueDate'), t('library.status')].map(h => (
                  <th key={h} style={thSt}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {loanList.map(l => {
                  const LOAN_BADGE = loanBadge(t)
                  const badge = LOAN_BADGE[l.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)', label: l.status }
                  const isOverdue = l.status === 'ACTIVE' && l.dueDate && new Date(l.dueDate) < new Date()
                  return (
                    <tr key={l.id}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                      <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)', maxWidth: 240 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.book.title}</div>
                        {l.book.author && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{l.book.author}</div>}
                      </td>
                      <td style={tdSt}>{l.book.category ?? '—'}</td>
                      <td style={tdSt}>{new Date(l.borrowedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                      <td style={tdSt}>
                        {l.dueDate ? (
                          <span style={{ fontWeight: 600, color: isOverdue ? 'var(--red)' : 'var(--text2)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            {isOverdue && <AlertTriangle size={14} strokeWidth={2} />}{new Date(l.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={tdSt}>
                        <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800, background: isOverdue ? 'var(--red-light)' : badge.bg, color: isOverdue ? 'var(--red)' : badge.color, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          {isOverdue ? <><AlarmClock size={13} strokeWidth={2} /> {t('library.overdueBadge')}</> : badge.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
const thSt: React.CSSProperties = { padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '12px 14px', fontSize: 15, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
