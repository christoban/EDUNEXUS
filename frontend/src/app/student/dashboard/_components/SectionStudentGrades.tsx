'use client'
import { useCallback } from 'react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import OfflineEmptyState from '@/components/OfflineEmptyState'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

interface GradesData {
  grades: any[]
  avg: number | null
  rank: { pos: number; total: number } | null
}

const MENTION_LEVELS = [
  { min: 16, label: 'TB' },
  { min: 14, label: 'B' },
  { min: 12, label: 'AB' },
  { min: 10, label: 'P' },
  { min: 0,  label: 'I' },
]

const MENTION_COLOR = (m: string): [string, string] => ({
  TB: ['#d1fae5', '#065f46'], B: ['#dbeafe', '#1e40af'],
  AB: ['#fef3c7', '#92400e'], P: ['#ffedd5', '#9a3412'], I: ['#fee2e2', '#991b1b'],
} as Record<string, [string, string]>)[m] ?? ['#f1f5f9', '#475569']

const NOTE_COLOR = (n: number) => n >= 14 ? '#059669' : n >= 10 ? '#1d4ed8' : '#dc2626'

function getMention(avg: number): string {
  for (const level of MENTION_LEVELS) {
    if (avg >= level.min) return level.label
  }
  return 'I'
}

function CacheBadge({ cachedAt }: { cachedAt: number | null }) {
  if (!cachedAt) return null
  const date = new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ background: '#fef3c7', border: '1px solid #d97706', borderRadius: 8, padding: '5px 12px', fontSize: 13, fontWeight: 600, color: '#92400e', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
      📦 Données du {date} — hors-ligne
    </div>
  )
}

export default function SectionStudentGrades({ onToast, user }: Props) {
  const cacheKey = user ? `student:grades:${user.id}` : ''

  const fetchFn = useCallback(async (): Promise<GradesData> => {
    const classId = user!.studentProfile?.class?.id
    const userId = user!.id

    const ayRes = await fetchApi('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json())
    let sequenceId = ''
    if (ayRes.success && ayRes.data?.length) {
      // Préférer l'année courante, sinon la première disponible
      const curYear = ayRes.data.find((y: any) => y.isCurrent) ?? ayRes.data[0]
      if (curYear) {
        const periods = curYear.periods ?? []
        const curPeriod = periods.find((p: any) => p.isCurrent) ?? periods[0]
        if (curPeriod) {
          const seqs = curPeriod.sequences ?? []
          const curSeq = seqs.find((s: any) => s.isCurrent) ?? seqs[seqs.length - 1]
          if (curSeq) sequenceId = curSeq.id
        }
      }
    }

    const [gradesRes, avgRes] = await Promise.all([
      fetchApi(`/api/v2/grades?sequenceId=${sequenceId}`, { credentials: 'include' }).then(r => r.json()),
      classId && sequenceId
        ? fetchApi(`/api/v2/grades/average/${userId}?classId=${classId}&sequenceId=${sequenceId}`, { credentials: 'include' }).then(r => r.json())
        : Promise.resolve(null),
    ])

    return {
      grades: gradesRes.grades ?? [],
      avg: avgRes?.average ?? null,
      rank: avgRes?.rank != null ? { pos: avgRes.rank, total: avgRes.totalStudents || 0 } : null,
    }
  }, [user])

  const { data, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<GradesData>(cacheKey, fetchFn)

  if (!user || loading) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: '#a89478', fontWeight: 600 }}>Chargement...</div>
      </div>
    )
  }

  if (error === 'OFFLINE_NO_CACHE') return <OfflineEmptyState />

  if (error) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{error}</div>
          <button onClick={refetch}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }}>
            🔄 Réessayer
          </button>
        </div>
      </div>
    )
  }

  const grades = data?.grades ?? []
  const avg = data?.avg ?? null
  const rank = data?.rank ?? null
  const displayAvg = avg ?? 0
  const mention = getMention(displayAvg)
  const mentionFull = mention === 'TB' ? 'Très Bien' : mention === 'B' ? 'Bien' : mention === 'AB' ? 'Assez Bien' : mention === 'P' ? 'Passable' : 'Insuffisant'
  const [mBg, mC] = MENTION_COLOR(mention)
  const subjectsAbove10 = grades.filter(g => (g.sequenceScore ?? g.sequenceAverage ?? 0) >= 10).length

  const subjectRows = grades
    .filter(g => g.subject)
    .reduce((acc: any[], g: any) => {
      if (acc.find(a => a.subjectId === g.subjectId)) return acc
      acc.push({
        subjectId: g.subjectId,
        name: g.subject?.name || '',
        coeff: g.coefficient || g.subject?.coefficient || 1,
        note: g.sequenceScore ?? g.sequenceAverage ?? 0,
      })
      return acc
    }, [])
    .sort((a: any, b: any) => a.name.localeCompare(b.name))

  void mBg; void mC

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: fromCache ? 8 : 26 }}>
        <div style={sTitle}>Mes notes</div>
        <div style={sSub}>Résultats par matière</div>
      </div>

      {fromCache && <CacheBadge cachedAt={cachedAt} />}

      <div style={{ background: 'linear-gradient(135deg,#1a2e1e,#243b29)', borderRadius: 16, padding: '22px 28px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 28 }}>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: 'white', lineHeight: 1 }}>{displayAvg.toFixed(1)}</div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginTop: 5 }}>Moyenne / 20</div>
        </div>
        <div style={{ width: 1, height: 60, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          {[
            { label: 'Rang', val: rank ? `${rank.pos}e / ${rank.total}` : '—' },
            { label: 'Mention', val: mentionFull },
            { label: 'Matières > 10', val: `${subjectsAbove10}/${subjectRows.length}` },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{s.label}</div>
              <div style={{ fontSize: 19, fontWeight: 900, color: 'white', marginTop: 4 }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
        {subjectRows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#a89478', fontSize: 15, fontWeight: 600 }}>Aucune note disponible pour le moment</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Matière', 'Coeff.', 'Note /20', 'Mention'].map(h => (
                <th key={h} style={thSt}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {subjectRows.map((sub) => {
                const subMention = getMention(sub.note)
                const [smBg, smC] = MENTION_COLOR(subMention)
                return (
                  <tr key={sub.subjectId}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                    <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>{sub.name}</td>
                    <td style={tdSt}>
                      <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 10px', borderRadius: 22, fontSize: 14, fontWeight: 900 }}>×{sub.coeff}</span>
                    </td>
                    <td style={tdSt}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: NOTE_COLOR(sub.note) }}>{sub.note.toFixed(1)}</span>
                    </td>
                    <td style={tdSt}>
                      <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: smBg, color: smC }}>{subMention}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
