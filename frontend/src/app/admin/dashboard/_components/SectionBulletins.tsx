'use client'
import { useState, useEffect } from 'react'
import { PartyPopper, Search, AlertTriangle, CheckCircle2, Loader2, FileText, BarChart3, Package, Upload, Eye } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { fetchApi } from '@/lib/fetchApi'
import AnimatedBackground from '@/components/AnimatedBackground'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface ClassItem { id: string; name: string }

interface CheckResult {
  canGenerateReportCard: boolean
  periodId: string
  conseilLocked: boolean
  reason: string | null
  stats: {
    total: number
    VALIDATED: number
    LOCKED: number
    SUBMITTED: number
    DRAFT: number
    REJECTED: number
  }
}

interface ReportCardItem {
  id: string
  generalAverage?: number | null
  rank?: number | null
  student?: { firstName: string; lastName: string }
}

export default function SectionBulletins({ onToast }: Props) {
  const t = useT('grades')
  const [classes, setClasses]     = useState<ClassItem[]>([])
  const [classId, setClassId]     = useState('')
  const [check, setCheck]         = useState<CheckResult | null>(null)
  const [reportCards, setReportCards] = useState<ReportCardItem[]>([])
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingCheck, setLoadingCheck]     = useState(false)
  const [generating, setGenerating]         = useState(false)
  const [exporting, setExporting]           = useState(false)
  const [sending, setSending]               = useState(false)
  const [celebrate, setCelebrate]           = useState(false)

  // Auto-fermeture de l'écran de célébration (habillage ponctuel, pas un écran de travail)
  useEffect(() => {
    if (!celebrate) return
    const timer = setTimeout(() => setCelebrate(false), 6000)
    return () => clearTimeout(timer)
  }, [celebrate])

  useEffect(() => {
    fetchApi('/api/v2/classes', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setClasses(d.data || []))
      .catch(() => {})
      .finally(() => setLoadingClasses(false))
  }, [])

  const loadClass = async () => {
    if (!classId) { onToast('Sélectionnez une classe', 'info'); return }
    setLoadingCheck(true)
    setCheck(null)
    setReportCards([])
    try {
      const [checkRes, rcRes] = await Promise.all([
        fetchApi(`/api/v2/report-cards/check/${classId}`, { credentials: 'include' }),
        fetchApi(`/api/v2/report-cards?classId=${classId}&limit=100`, { credentials: 'include' }),
      ])
      if (checkRes.ok) {
        const cd = await checkRes.json()
        setCheck(cd)
      }
      if (rcRes.ok) {
        const rd = await rcRes.json()
        setReportCards(rd.reportCards ?? rd.data ?? [])
      }
    } catch {
      onToast('Erreur de chargement', 'error')
    } finally {
      setLoadingCheck(false)
    }
  }

  const handleGenerate = async () => {
    if (!classId || !check?.canGenerateReportCard) return
    setGenerating(true)
    try {
      const res = await fetchApi('/api/v2/report-cards/generate', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          academicPeriodId: check.periodId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Génération des bulletins lancée', 'success')
      setCelebrate(true)
      loadClass()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de génération', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleExportZip = async () => {
    if (!classId) return
    setExporting(true)
    try {
      const res = await fetchApi(`/api/v2/report-cards/export/${classId}`, { method: 'POST', credentials: 'include' })
      if (!res.ok) throw new Error('Erreur export')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `bulletins-${classId}.zip`; a.click()
      URL.revokeObjectURL(url)
      onToast('ZIP téléchargé', 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur export', 'error')
    } finally {
      setExporting(false)
    }
  }

  const handleSendParents = async () => {
    if (!classId) return
    setSending(true)
    try {
      const res = await fetchApi('/api/v2/report-cards/send', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Bulletins envoyés aux parents', 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur envoi', 'error')
    } finally {
      setSending(false)
    }
  }

  const className = classes.find(c => c.id === classId)?.name ?? ''
  const validatedCount = check ? (check.stats.VALIDATED + check.stats.LOCKED) : 0

  const checks = check ? [
    {
      warn: check.stats.total === 0,
      title: check.stats.total === 0
        ? 'Aucune note enregistrée'
        : `Notes : ${validatedCount}/${check.stats.total} validées`,
      sub: check.stats.total === 0
        ? 'Saisissez les notes avant de générer'
        : `${check.stats.SUBMITTED} en attente · ${check.stats.DRAFT} brouillons · ${check.stats.REJECTED} rejetées`,
    },
    {
      warn: !check.conseilLocked,
      title: check.conseilLocked ? 'Conseil de classe verrouillé' : 'Conseil de classe non verrouillé',
      sub: check.conseilLocked
        ? 'Le conseil de classe du Trimestre 1 est validé'
        : 'Le censeur doit verrouiller le conseil de classe avant la génération',
    },
    {
      warn: !check.canGenerateReportCard,
      title: check.canGenerateReportCard ? 'Prêt pour la génération' : (check.reason ?? 'Non prêt'),
      sub: check.canGenerateReportCard
        ? 'Toutes les conditions sont remplies'
        : 'Réglez les points ci-dessus avant de générer',
    },
  ] : []

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Célébration ponctuelle après génération réussie — teinte fixe, texte clair fixe */}
      {celebrate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'edu-celebIn 0.3s ease both' }}>
          <style>{`@keyframes edu-celebIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
          <AnimatedBackground variant="celebration" style={{ zIndex: 0 }} />
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: 32, maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, color: 'white' }}><PartyPopper size={74} /></div>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 30, fontWeight: 700, color: 'white', marginBottom: 10 }}>
              {t('bulletins.celebrate.title')}
            </div>
            <div style={{ fontSize: 17, color: 'rgba(247,243,238,0.75)', marginBottom: 30, lineHeight: 1.6 }}>
              {t('bulletins.celebrate.subtitle')}
            </div>
            <button onClick={() => setCelebrate(false)}
              style={{ background: 'var(--green)', color: 'white', fontWeight: 800, fontSize: 16, padding: '13px 34px', borderRadius: 11, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              {t('bulletins.celebrate.cta')}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 26 }}>
        <div style={sTitle}>{t('bulletins.title')}</div>
        <div style={sSub}>Génération et distribution</div>
      </div>

      {/* Sélecteur de classe */}
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '14px 20px', marginBottom: 18, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={classId} onChange={e => setClassId(e.target.value)} style={selectSt} disabled={loadingClasses}>
          <option value="">{loadingClasses ? 'Chargement…' : 'Sélectionner une classe'}</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button style={{ ...btnPrim, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={loadClass} disabled={loadingClasses || loadingCheck || !classId}>
          {loadingCheck ? <><Loader2 size={15} className="animate-spin" /> Chargement…</> : 'Charger'}
        </button>
      </div>

      {loadingCheck && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loadingCheck && check && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

          {/* Pré-vérification */}
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 8 }}><Search size={16} /> Pré-vérification — {className}</span>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {checks.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 16px', background: c.warn ? 'var(--amber-light)' : 'var(--green-light)', borderRadius: 11 }}>
                  {c.warn ? <AlertTriangle size={22} color="var(--amber)" /> : <CheckCircle2 size={22} color="var(--green)" />}
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: c.warn ? 'var(--amber)' : 'var(--green)' }}>{c.title}</div>
                    <div style={{ fontSize: 14, color: c.warn ? 'var(--amber)' : 'var(--green)', marginTop: 3, lineHeight: 1.5 }}>{c.sub}</div>
                  </div>
                </div>
              ))}
              <button
                style={{ ...btnPrim, marginTop: 6, opacity: check.canGenerateReportCard ? 1 : 0.45, cursor: check.canGenerateReportCard ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                onClick={handleGenerate}
                disabled={!check.canGenerateReportCard || generating}>
                {generating ? <><Loader2 size={16} className="animate-spin" /> Génération en cours…</> : <><FileText size={16} /> Générer les bulletins →</>}
              </button>
            </div>
          </div>

          {/* Bulletins générés */}
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <BarChart3 size={16} /> Bulletins générés ({reportCards.length})
              </span>
              {reportCards.length > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ ...btnSec, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={handleExportZip} disabled={exporting}>
                    {exporting ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />} ZIP
                  </button>
                  <button style={{ ...btnSec, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={handleSendParents} disabled={sending}>
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Envoyer
                  </button>
                </div>
              )}
            </div>

            {reportCards.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 16 }}>
                Aucun bulletin généré pour cette classe
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Élève', 'Moy. gén.', 'Rang', 'PDF'].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {reportCards.slice(0, 15).map((b) => (
                    <tr key={b.id}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                      <td style={tdSt}>
                        <strong style={{ color: 'var(--text)' }}>
                          {b.student ? `${b.student.firstName} ${b.student.lastName}` : 'Élève'}
                        </strong>
                      </td>
                      <td style={tdSt}>
                        <strong style={{ color: (b.generalAverage ?? 0) < 10 ? 'var(--red)' : 'var(--green)', fontSize: 18 }}>
                          {b.generalAverage != null ? b.generalAverage.toFixed(2) : '—'}
                        </strong>
                      </td>
                      <td style={tdSt}>{b.rank != null ? `${b.rank}e` : '—'}</td>
                      <td style={tdSt}>
                        <button style={{ ...btnSec, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                          onClick={() => window.open(`/api/v2/report-cards/${b.id}/pdf`, '_blank')}>
                          <Eye size={14} /> PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                  {reportCards.length > 15 && (
                    <tr>
                      <td colSpan={4} style={{ ...tdSt, textAlign: 'center', color: 'var(--text3)', fontStyle: 'italic' }}>
                        + {reportCards.length - 15} autres bulletins
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {!loadingCheck && !check && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '70px 32px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><FileText size={52} /></div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Sélectionnez une classe
          </div>
          <div style={{ fontSize: 16, color: 'var(--text3)' }}>
            Choisissez une classe et cliquez sur « Charger » pour voir les bulletins.
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '7px 14px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const selectSt: React.CSSProperties = { background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 10, padding: '8px 12px', fontSize: 16, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px' }
const tdSt: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: 'var(--text2)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
