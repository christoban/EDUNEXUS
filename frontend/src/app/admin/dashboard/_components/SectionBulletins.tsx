'use client'
import { useState, useEffect } from 'react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface ClassItem { id: string; name: string }

interface CheckResult {
  canGenerateReportCard: boolean
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
  const [classes, setClasses]     = useState<ClassItem[]>([])
  const [classId, setClassId]     = useState('')
  const [check, setCheck]         = useState<CheckResult | null>(null)
  const [reportCards, setReportCards] = useState<ReportCardItem[]>([])
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingCheck, setLoadingCheck]     = useState(false)
  const [generating, setGenerating]         = useState(false)
  const [exporting, setExporting]           = useState(false)
  const [sending, setSending]               = useState(false)

  useEffect(() => {
    fetch('/api/v2/classes', { credentials: 'include' })
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
        fetch(`/api/v2/report-cards/check/${classId}`, { credentials: 'include' }),
        fetch(`/api/v2/report-cards?classId=${classId}&limit=100`, { credentials: 'include' }),
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
      const res = await fetch('/api/v2/report-cards/generate', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Génération des bulletins lancée', 'success')
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
      const res = await fetch(`/api/v2/report-cards/export/${classId}`, { method: 'POST', credentials: 'include' })
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
      const res = await fetch('/api/v2/report-cards/send', {
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
      warn: !check.canGenerateReportCard,
      title: check.canGenerateReportCard ? '✅ Prêt pour la génération' : 'Notes non entièrement validées',
      sub: check.canGenerateReportCard
        ? 'Toutes les notes sont validées ou verrouillées'
        : 'Validez toutes les notes avant de générer les bulletins',
    },
  ] : []

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ marginBottom: 26 }}>
        <div style={sTitle}>Bulletins</div>
        <div style={sSub}>Génération et distribution</div>
      </div>

      {/* Sélecteur de classe */}
      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '14px 20px', marginBottom: 18, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={classId} onChange={e => setClassId(e.target.value)} style={selectSt} disabled={loadingClasses}>
          <option value="">{loadingClasses ? 'Chargement…' : 'Sélectionner une classe'}</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button style={btnPrim} onClick={loadClass} disabled={loadingClasses || loadingCheck || !classId}>
          {loadingCheck ? '⏳ Chargement…' : 'Charger'}
        </button>
      </div>

      {loadingCheck && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loadingCheck && check && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

          {/* Pré-vérification */}
          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4' }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>🔍 Pré-vérification — {className}</span>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {checks.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 16px', background: c.warn ? '#fef3c7' : '#d1fae5', borderRadius: 11 }}>
                  <span style={{ fontSize: 22 }}>{c.warn ? '⚠️' : '✅'}</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: c.warn ? '#92400e' : '#065f46' }}>{c.title}</div>
                    <div style={{ fontSize: 14, color: c.warn ? '#92400e' : '#065f46', marginTop: 3, lineHeight: 1.5 }}>{c.sub}</div>
                  </div>
                </div>
              ))}
              <button
                style={{ ...btnPrim, marginTop: 6, opacity: check.canGenerateReportCard ? 1 : 0.45, cursor: check.canGenerateReportCard ? 'pointer' : 'not-allowed' }}
                onClick={handleGenerate}
                disabled={!check.canGenerateReportCard || generating}>
                {generating ? '⏳ Génération en cours…' : '📄 Générer les bulletins →'}
              </button>
            </div>
          </div>

          {/* Bulletins générés */}
          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>
                📊 Bulletins générés ({reportCards.length})
              </span>
              {reportCards.length > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={btnSec} onClick={handleExportZip} disabled={exporting}>
                    {exporting ? '⏳' : '📦'} ZIP
                  </button>
                  <button style={btnSec} onClick={handleSendParents} disabled={sending}>
                    {sending ? '⏳' : '📤'} Envoyer
                  </button>
                </div>
              )}
            </div>

            {reportCards.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#a89478', fontSize: 16 }}>
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
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                      <td style={tdSt}>
                        <strong style={{ color: '#1a1209' }}>
                          {b.student ? `${b.student.firstName} ${b.student.lastName}` : 'Élève'}
                        </strong>
                      </td>
                      <td style={tdSt}>
                        <strong style={{ color: (b.generalAverage ?? 0) < 10 ? '#dc2626' : '#059669', fontSize: 18 }}>
                          {b.generalAverage != null ? b.generalAverage.toFixed(2) : '—'}
                        </strong>
                      </td>
                      <td style={tdSt}>{b.rank != null ? `${b.rank}e` : '—'}</td>
                      <td style={tdSt}>
                        <button style={btnSec}
                          onClick={() => window.open(`/api/v2/report-cards/${b.id}/pdf`, '_blank')}>
                          👁 PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                  {reportCards.length > 15 && (
                    <tr>
                      <td colSpan={4} style={{ ...tdSt, textAlign: 'center', color: '#a89478', fontStyle: 'italic' }}>
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
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '70px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>📄</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>
            Sélectionnez une classe
          </div>
          <div style={{ fontSize: 16, color: '#a89478' }}>
            Choisissez une classe et cliquez sur « Charger » pour voir les bulletins.
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '7px 14px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const selectSt: React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, padding: '8px 12px', fontSize: 16, fontWeight: 700, color: '#6b5c45', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px' }
const tdSt: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
