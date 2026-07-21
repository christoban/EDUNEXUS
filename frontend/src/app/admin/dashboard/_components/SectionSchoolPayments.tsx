'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import SectionStudentPayments from './SectionStudentPayments'
import { Wallet, RefreshCw, Settings } from 'lucide-react'

interface Props { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }

interface PaymentOverview {
  anneeScolaire: string;
  totalEleves: number;
  minesec: { status: string; _count: { _all: number }; _sum: { montantAttendu: number | null; montantPaye: number | null } }[];
  etablissement: { status: string; _count: { _all: number }; _sum: { montantAttendu: number | null; montantPaye: number | null } }[];
}

const btnPri = { padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' as const }
const btnSec = { padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer' as const }

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  IMPAYE: { bg: 'rgba(239,68,68,0.12)', color: 'var(--red)' },
  PAYE: { bg: 'rgba(234,179,8,0.12)', color: '#b45309' },
  VERIFIE: { bg: 'rgba(22,163,74,0.12)', color: 'var(--green)' },
  EN_ATTENTE: { bg: 'rgba(234,179,8,0.12)', color: '#b45309' },
  LITIGE: { bg: 'rgba(239,68,68,0.12)', color: 'var(--red)' },
}

export default function SectionSchoolPayments({ onToast }: Props) {
  const t = useT('admin')
  const [overview, setOverview] = useState<PaymentOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [anneeScolaire, setAnneeScolaire] = useState('')
  const [years, setYears] = useState<{ id: string; label: string; isCurrent: boolean }[]>([])
  const [generatingSchool, setGeneratingSchool] = useState(false)

  useEffect(() => {
    fetchApi('/api/v2/academic-years', { credentials: 'include' })
      .then(r => r.json()).then(d => {
        const list = d.data ?? []
        setYears(list)
        const cur = list.find((y: any) => y.isCurrent)
        if (cur) setAnneeScolaire(cur.label)
      }).catch(() => {})
  }, [])

  const loadOverview = useCallback(async () => {
    if (!anneeScolaire) return
    try {
      setLoading(true)
      const res = await fetchApi(`/api/v2/paiements-minesec/dashboard/school?anneeScolaire=${encodeURIComponent(anneeScolaire)}`, { credentials: 'include' })
      const data = await res.json()
      setOverview(data.data ?? null)
    } catch { onToast('Erreur chargement', 'error') } finally { setLoading(false) }
  }, [anneeScolaire, onToast])

  useEffect(() => { loadOverview() }, [loadOverview])

  const generateForSchool = async () => {
    if (!anneeScolaire) return
    setGeneratingSchool(true)
    try {
      const res = await fetchApi('/api/v2/paiements-minesec/generate-school', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ anneeScolaire }),
      })
      const data = await res.json()
      if (data.success) {
        const r = data.data
        onToast(t('matricules.generate_school_toast').replace('{eleves}', String(r.elevesTraites)).replace('{paiements}', String(r.paiementsGeneres)), 'success')
        loadOverview()
      } else onToast(data.message || t('matricules.error_generic'), 'error')
    } catch { onToast(t('matricules.error_generic'), 'error') } finally { setGeneratingSchool(false) }
  }

  const getStats = (stats: PaymentOverview['minesec']) => {
    const impayes = stats.find(s => s.status === 'IMPAYE')
    const payes = stats.find(s => s.status === 'PAYE')
    const verifies = stats.find(s => s.status === 'VERIFIE')
    const totalAttendu = stats.reduce((s, p) => s + (p._sum.montantAttendu ?? 0), 0)
    const totalPaye = stats.reduce((s, p) => s + (p._sum.montantPaye ?? 0), 0)
    return {
      totalEleves: impayes?._count._all ?? 0,
      totalAttendu,
      totalPaye,
      tauxRecouvrement: totalAttendu > 0 ? Math.round((totalPaye / totalAttendu) * 100) : 0,
      verifies: verifies?._count._all ?? 0,
      payes: payes?._count._all ?? 0,
      impayes: impayes?._count._all ?? 0,
    }
  }

  return (
    <div style={{ padding: '24px 32px', height: '100%', overflowY: 'auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Wallet size={20} strokeWidth={2} /> {t('matricules.minesec_dashboard_title')}
      </h2>

      {/* Filtre année */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{t('lv2_choice.academic_year')}</label>
        <select value={anneeScolaire} onChange={e => setAnneeScolaire(e.target.value)} style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 }}>
          <option value="">—</option>
          {years.map(y => <option key={y.id} value={y.label}>{y.label}</option>)}
        </select>
      </div>

      {loading ? <p style={{ color: 'var(--text2)' }}>{t('common.loading')}</p> : !overview ? (
        <p style={{ color: 'var(--text3)', fontStyle: 'italic' }}>{t('matricules.no_imports')}</p>
      ) : (
        <>
          {/* Résumé global */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {(() => {
              const stats = getStats(overview.minesec)
              return [
                { label: t('matricules.minesec_total_attendu'), value: `${stats.totalAttendu.toLocaleString()} FCFA`, bg: 'var(--blue-light)', color: 'var(--blue)' },
                { label: t('matricules.minesec_total_paye'), value: `${stats.totalPaye.toLocaleString()} FCFA`, bg: 'rgba(22,163,74,0.12)', color: 'var(--green)' },
                { label: t('matricules.minesec_total_restant'), value: `${(stats.totalAttendu - stats.totalPaye).toLocaleString()} FCFA`, bg: 'rgba(239,68,68,0.12)', color: 'var(--red)' },
                { label: 'Taux recouvrement', value: `${stats.tauxRecouvrement}%`, bg: 'rgba(234,179,8,0.12)', color: '#b45309' },
              ].map((c, i) => (
                <div key={i} style={{ background: c.bg, color: c.color, borderRadius: 12, padding: '16px 20px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{c.value}</div>
                </div>
              ))
            })()}
          </div>

          {/* Détail par statut */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Frais MINESEC — Par statut</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 500 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>Statut</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>Nb paiements</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>Attendu</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>Payé</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.minesec.map((s, i) => {
                    const sc = STATUS_COLORS[s.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)' }
                    return (
                      <tr key={i}>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--bg2)' }}>
                          <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: sc.bg, color: sc.color }}>{s.status}</span>
                        </td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--bg2)', textAlign: 'center' }}>{s._count._all}</td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--bg2)', textAlign: 'right' }}>{(s._sum.montantAttendu ?? 0).toLocaleString()} FCFA</td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--bg2)', textAlign: 'right' }}>{(s._sum.montantPaye ?? 0).toLocaleString()} FCFA</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={loadOverview} style={{ ...btnSec, display: 'inline-flex', alignItems: 'center', gap: 6 }}><RefreshCw size={14} strokeWidth={2} /> {t('matricules.sync_btn')}</button>
            <button onClick={generateForSchool} disabled={generatingSchool} style={{ ...btnPri, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {generatingSchool ? '...' : <><Settings size={14} strokeWidth={2} /> {t('matricules.generate_school_btn')}</>}
            </button>
          </div>

          <SectionStudentPayments onToast={onToast} />
        </>
      )}
    </div>
  )
}
