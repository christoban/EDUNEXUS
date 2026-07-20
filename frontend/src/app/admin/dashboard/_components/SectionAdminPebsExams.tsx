'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { BookOpen, AlertTriangle } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }

interface Session { id: string; name: string; level: string; status: string; examDate: string; targetClassId: string; selectionThreshold: number | null; availableSeats: number | null }
interface Candidate { id: string; studentProfileId: string; firstName: string; lastName: string; currentClassName: string; examScore: number | null; selectionResult: string }
interface Summary { session: Session; total: number; pending: number; selectionnes: number; nonSelectionnes: number; candidates: Candidate[] }
interface Anomalie { type: string; severity: string; message: string }
interface TransferPreview { needsConfirmation: boolean; toTransfer: { id: string; name: string; fromClass: string }[]; targetClassId: string }

const btnPri = { padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' as const }
const btnSec = { padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer' as const }
const inputStyle = { padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 }

export default function SectionAdminPebsExams({ onToast }: Props) {
  const t = useT('admin')
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [anomalies, setAnomalies] = useState<Anomalie[]>([])
  const [transferPreview, setTransferPreview] = useState<TransferPreview | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const scanFileRef = useRef<HTMLInputElement>(null)

  const [formName, setFormName] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formLevel, setFormLevel] = useState('')
  const [formYear, setFormYear] = useState('')
  const [formThreshold, setFormThreshold] = useState('')
  const [formSeats, setFormSeats] = useState('')
  const [formTargetClass, setFormTargetClass] = useState('')
  const [years, setYears] = useState<{ id: string; label: string; isCurrent: boolean }[]>([])
  const [classes, setClasses] = useState<{ id: string; name: string; level: string | null }[]>([])
  const [creating, setCreating] = useState(false)

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchApi('/api/v2/pebs-exams', { credentials: 'include' })
      const data = await res.json()
      setSessions(data.data ?? [])
    } catch { /* empty */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  // Rafraîchissement temps réel quand l'assistant IA agit sur les sessions/candidats PEBS.
  useEffect(() => {
    const onChanged = (e: Event) => {
      const entity = (e as CustomEvent<{ entity?: string }>).detail?.entity
      if (entity === 'pebsExamSession') loadSessions()
      if (entity === 'pebsExamCandidate' && summary) openSummary(summary.session.id)
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [loadSessions, summary])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchApi('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json()).then(d => {
      const list = d.data ?? []; setYears(list)
      const cur = list.find((y: any) => y.isCurrent); if (cur) setFormYear(cur.id)
    }).catch(() => {})
    fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()).then(d => setClasses(d.data ?? [])).catch(() => {})
  }, [])

  const niveaux = [...new Set(classes.map(c => c.level).filter(Boolean))]
  const classesForLevel = classes.filter(c => c.level === formLevel)

  const handleCreate = async () => {
    if (!formName || !formDate || !formLevel || !formYear || !formTargetClass) {
      onToast(t('lv2_choice.fill_all'), 'error'); return
    }
    try {
      setCreating(true)
      const res = await fetchApi('/api/v2/pebs-exams', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name: formName, examDate: formDate, level: formLevel, academicYearId: formYear,
          selectionThreshold: formThreshold ? Number(formThreshold) : undefined,
          availableSeats: formSeats ? Number(formSeats) : undefined, targetClassId: formTargetClass }),
      })
      const data = await res.json()
      if (data.success) { onToast('Session créée', 'success'); setFormName(''); setFormDate(''); setFormLevel(''); setFormThreshold(''); setFormSeats(''); setFormTargetClass(''); loadSessions() }
      else onToast(data.message || 'Erreur', 'error')
    } catch { onToast('Erreur', 'error') } finally { setCreating(false) }
  }

  const openSummary = async (sessionId: string) => {
    try {
      const res = await fetchApi(`/api/v2/pebs-exams/${sessionId}/summary`, { credentials: 'include' })
      const data = await res.json()
      setSummary(data.data ?? null); setAnomalies([]); setTransferPreview(null)
    } catch { onToast('Erreur', 'error') }
  }

  const handleCompute = async (sessionId: string) => {
    try {
      const res = await fetchApi(`/api/v2/pebs-exams/${sessionId}/compute-selection`, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (data.success) { onToast(`Sélectionnés: ${data.data.selectionnes}, Non sélectionnés: ${data.data.nonSelectionnes}`, 'success'); openSummary(sessionId) }
      else onToast(data.message || 'Erreur', 'error')
    } catch { onToast('Erreur', 'error') }
  }

  const handleApplyTransfer = async (sessionId: string) => {
    try {
      const res = await fetchApi(`/api/v2/pebs-exams/${sessionId}/apply-transfer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ confirmed: false }),
      })
      const data = await res.json()
      if (data.success && data.data.needsConfirmation) {
        setTransferPreview(data.data)
      } else if (data.success) {
        onToast(`${data.data.transferred} élève(s) transféré(s)`, 'success')
        openSummary(sessionId)
      } else onToast(data.message || 'Erreur', 'error')
    } catch { onToast('Erreur', 'error') }
  }

  const confirmTransfer = async (sessionId: string) => {
    try {
      const res = await fetchApi(`/api/v2/pebs-exams/${sessionId}/apply-transfer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ confirmed: true }),
      })
      const data = await res.json()
      if (data.success) {
        onToast(`${data.data.transferred} élève(s) transféré(s) avec succès`, 'success')
        setTransferPreview(null)
        openSummary(sessionId)
      } else onToast(data.message || 'Erreur', 'error')
    } catch { onToast('Erreur', 'error') }
  }

  const handleAnomalies = async (sessionId: string) => {
    try {
      const res = await fetchApi(`/api/v2/pebs-exams/${sessionId}/detect-anomalies`, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      setAnomalies(data.data?.anomalies ?? [])
      if ((data.data?.anomalies ?? []).length === 0) onToast('Aucune anomalie', 'success')
    } catch { onToast('Erreur', 'error') }
  }

  const handleScan = async (sessionId: string) => {
    const file = scanFileRef.current?.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      try {
        const res = await fetchApi(`/api/v2/pebs-exams/${sessionId}/candidates/scan`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type || 'image/jpeg' }),
        })
        const data = await res.json()
        if (data.success) {
          if ((data.data?.warnings ?? []).length) onToast(data.data.warnings.join('; '), 'info')
          else onToast(`${(data.data?.candidats ?? []).length} candidat(s) extrait(s)`, 'success')
        } else onToast(data.message || 'Erreur', 'error')
      } catch { onToast('Erreur scan', 'error') }
    }
    reader.readAsDataURL(file)
  }

  const niveauxLabels: Record<string, string> = {}
  classes.forEach(c => { if (c.level) niveauxLabels[c.level] = c.level })

  return (
    <div style={{ padding: '24px 32px', height: '100%', overflowY: 'auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}><BookOpen size={22} /> {t('pebs_exams.title')}</h2>

      {/* Création */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{t('pebs_exams.create_session')}</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
          <div style={{ flex: 2, minWidth: 200 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('pebs_exams.session_name')}</label>
            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Sélection PEBS 6e 2026" style={{ ...inputStyle, width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('lv2_choice.level')}</label>
            <select value={formLevel} onChange={e => { setFormLevel(e.target.value); setFormTargetClass('') }} style={{ ...inputStyle, minWidth: 100 }}>
              <option value="">—</option>
              {niveaux.map(n => <option key={n} value={n!}>{n}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('pebs_exams.target_class')}</label>
            <select value={formTargetClass} onChange={e => setFormTargetClass(e.target.value)} style={{ ...inputStyle, minWidth: 140 }}>
              <option value="">—</option>
              {classesForLevel.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('entrance_exams.exam_date')}</label>
            <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('lv2_choice.academic_year')}</label>
            <select value={formYear} onChange={e => setFormYear(e.target.value)} style={{ ...inputStyle, minWidth: 140 }}>
              <option value="">—</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('entrance_exams.threshold')}</label>
            <input type="number" value={formThreshold} onChange={e => setFormThreshold(e.target.value)} placeholder="/20" style={{ ...inputStyle, width: 80 }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('entrance_exams.seats')}</label>
            <input type="number" value={formSeats} onChange={e => setFormSeats(e.target.value)} style={{ ...inputStyle, width: 80 }} />
          </div>
          <button onClick={handleCreate} disabled={creating} style={btnPri}>{creating ? '...' : t('lv2_choice.create')}</button>
        </div>
      </div>

      {/* Sessions */}
      {loading ? <p style={{ color: 'var(--text2)' }}>{t('common.loading')}</p> : sessions.length === 0 ? (
        <p style={{ color: 'var(--text3)', fontStyle: 'italic' }}>{t('pebs_exams.no_sessions')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {sessions.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 18px' }}>
              <div>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{s.name}</span>
                <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--text2)' }}>{new Date(s.examDate).toLocaleDateString()} — {s.level}</span>
                <span style={{ marginLeft: 12, padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: s.status === 'APPLIED' ? 'rgba(22,163,74,0.12)' : s.status === 'RESULTS_PENDING' ? 'rgba(234,179,8,0.12)' : 'var(--bg2)', color: s.status === 'APPLIED' ? 'var(--green)' : s.status === 'RESULTS_PENDING' ? '#b45309' : 'var(--text2)' }}>
                  {s.status}
                </span>
              </div>
              <button onClick={() => openSummary(s.id)} style={btnSec}>{t('entrance_exams.view')}</button>
            </div>
          ))}
        </div>
      )}

      {/* Résumé */}
      {summary && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{summary.session.name}</h3>
            <button onClick={() => { setSummary(null); setTransferPreview(null) }} style={btnSec}>{t('common.close')}</button>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            {[
              { label: t('entrance_exams.total'), value: summary.total, bg: 'var(--blue-light)', color: 'var(--blue)' },
              { label: t('entrance_exams.pending'), value: summary.pending, bg: 'var(--bg2)', color: 'var(--text2)' },
              { label: t('pebs_exams.selectionnes'), value: summary.selectionnes, bg: 'rgba(22,163,74,0.12)', color: 'var(--green)' },
              { label: t('pebs_exams.non_selectionnes'), value: summary.nonSelectionnes, bg: 'rgba(239,68,68,0.12)', color: 'var(--red)' },
            ].map(c => (
              <span key={c.label} style={{ padding: '4px 12px', borderRadius: 14, fontSize: 13, fontWeight: 700, background: c.bg, color: c.color }}>{c.label} : {c.value}</span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <button data-help-id="pebs-compute-btn" onClick={() => handleCompute(summary.session.id)} style={{ ...btnPri, background: 'var(--blue)' }}>{t('pebs_exams.compute')}</button>
            {summary.session.status !== 'APPLIED' && summary.selectionnes > 0 && (
              <button data-help-id="pebs-apply-transfer-btn" onClick={() => handleApplyTransfer(summary.session.id)} style={{ ...btnPri, background: '#b45309' }}>{t('pebs_exams.apply_transfer')}</button>
            )}
            <button onClick={() => handleAnomalies(summary.session.id)} style={btnSec}>{t('entrance_exams.detect_anomalies')}</button>
            <div>
              <input ref={scanFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={() => handleScan(summary.session.id)} />
              <button onClick={() => scanFileRef.current?.click()} style={{ ...btnSec, color: 'var(--purple)' }}>{t('entrance_exams.scan')}</button>
            </div>
          </div>

          {/* Anomalies */}
          {anomalies.length > 0 && (
            <div style={{ marginBottom: 16, padding: 12, background: 'rgba(234,179,8,0.08)', borderRadius: 8, border: '1px solid rgba(234,179,8,0.2)' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>{t('entrance_exams.anomalies_found')} ({anomalies.length})</p>
              {anomalies.map((a, i) => <p key={i} style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>• {a.message}</p>)}
            </div>
          )}

          {/* Aperçu transfert */}
          {transferPreview && (
            <div style={{ marginBottom: 16, padding: 16, background: 'rgba(234,179,8,0.08)', borderRadius: 8, border: '2px solid rgba(234,179,8,0.3)' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#b45309', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}><AlertTriangle size={15} /> {t('pebs_exams.confirm_transfer_title')}</p>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>
                {t('pebs_exams.confirm_transfer_desc').replace('{count}', String(transferPreview.toTransfer.length))}
              </p>
              <ul style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12, paddingLeft: 20 }}>
                {transferPreview.toTransfer.map(c => (
                  <li key={c.id}>{c.name} — {t('pebs_exams.from')} {c.fromClass} {t('pebs_exams.to')} {classes.find(cl => cl.id === transferPreview.targetClassId)?.name ?? '?'}</li>
                ))}
              </ul>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => confirmTransfer(summary.session.id)} style={{ ...btnPri, background: '#b45309' }}>{t('pebs_exams.confirm_transfer')}</button>
                <button onClick={() => setTransferPreview(null)} style={btnSec}>{t('common.close')}</button>
              </div>
            </div>
          )}

          {/* Tableau */}
          <div style={{ maxHeight: 350, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('entrance_exams.col_name')}</th>
                  <th style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('pebs_exams.col_current_class')}</th>
                  <th style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('entrance_exams.col_score')}</th>
                  <th style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('entrance_exams.col_status')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.candidates.map(c => (
                  <tr key={c.id}>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)' }}>{c.lastName} {c.firstName}</td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)', textAlign: 'center', color: 'var(--text2)' }}>{c.currentClassName}</td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)', textAlign: 'center' }}>{c.examScore ?? '—'}</td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)', textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: c.selectionResult === 'SELECTIONNE' ? 'rgba(22,163,74,0.12)' : c.selectionResult === 'NON_SELECTIONNE' ? 'rgba(239,68,68,0.12)' : 'var(--bg2)', color: c.selectionResult === 'SELECTIONNE' ? 'var(--green)' : c.selectionResult === 'NON_SELECTIONNE' ? 'var(--red)' : 'var(--text2)' }}>
                        {c.selectionResult}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
