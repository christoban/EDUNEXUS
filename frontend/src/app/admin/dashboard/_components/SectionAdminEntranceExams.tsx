'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }

interface Session {
  id: string; name: string; status: string; examDate: string
  admissionThreshold: number | null; availableSeats: number | null
}

interface Candidate {
  id: string; firstName: string; lastName: string; examScore: number | null
  admissionStatus: string; cepResult: string | null; cepResultDate: string | null
  studentProfileId: string | null
}

interface Summary {
  session: Session; total: number; pending: number; admisProvisoire: number
  confirms: number; annules: number; cepPending: number; candidates: Candidate[]
}

interface Anomalie { type: string; severity: string; message: string; candidateIds: string[] }

interface ScannedCandidate { firstName: string; lastName: string; dateOfBirth?: string; examScore?: number; confidence: string }

const btnPri = { padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' as const }
const btnSec = { padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer' as const }
const inputStyle = { padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 }

export default function SectionAdminEntranceExams({ onToast }: Props) {
  const t = useT('admin')
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [anomalies, setAnomalies] = useState<Anomalie[]>([])
  const [scannedPreview, setScannedPreview] = useState<ScannedCandidate[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const scanFileRef = useRef<HTMLInputElement>(null)

  // Form création
  const [formName, setFormName] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formYear, setFormYear] = useState('')
  const [formThreshold, setFormThreshold] = useState('')
  const [formSeats, setFormSeats] = useState('')
  const [years, setYears] = useState<{ id: string; label: string; isCurrent: boolean }[]>([])
  const [creating, setCreating] = useState(false)

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchApi('/api/v2/entrance-exams', { credentials: 'include' })
      const data = await res.json()
      setSessions(data.data ?? [])
    } catch { /* empty */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])
  useEffect(() => {
    fetchApi('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json()).then(d => {
      const list = d.data ?? []
      setYears(list)
      const cur = list.find((y: any) => y.isCurrent)
      if (cur) setFormYear(cur.id)
    }).catch(() => {})
  }, [])

  const handleCreate = async () => {
    if (!formName || !formDate || !formYear) { onToast(t('lv2_choice.fill_all'), 'error'); return }
    try {
      setCreating(true)
      const res = await fetchApi('/api/v2/entrance-exams', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name: formName, examDate: formDate, academicYearId: formYear,
          admissionThreshold: formThreshold ? Number(formThreshold) : undefined,
          availableSeats: formSeats ? Number(formSeats) : undefined }),
      })
      const data = await res.json()
      if (data.success) { onToast('Session créée', 'success'); setFormName(''); setFormDate(''); setFormThreshold(''); setFormSeats(''); loadSessions() }
      else onToast(data.message || 'Erreur', 'error')
    } catch { onToast('Erreur', 'error') } finally { setCreating(false) }
  }

  const openSummary = async (sessionId: string) => {
    try {
      const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/summary`, { credentials: 'include' })
      const data = await res.json()
      setSummary(data.data ?? null)
      setAnomalies([])
      setScannedPreview([])
    } catch { onToast('Erreur', 'error') }
  }

  const handleImport = async (sessionId: string) => {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/candidates/import`, {
        method: 'POST', credentials: 'include', body: fd,
      })
      const data = await res.json()
      if (data.success) { onToast(`${data.data.added} candidat(s) importé(s)`, 'success'); openSummary(sessionId) }
      else onToast(data.message || 'Erreur', 'error')
    } catch { onToast('Erreur', 'error') }
  }

  const handleCompute = async (sessionId: string) => {
    try {
      const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/compute-admission`, {
        method: 'POST', credentials: 'include',
      })
      const data = await res.json()
      if (data.success) { onToast(`Admis: ${data.data.admis}, Non-admis: ${data.data.nonAdmis}`, 'success'); openSummary(sessionId) }
      else onToast(data.message || 'Erreur', 'error')
    } catch { onToast('Erreur', 'error') }
  }

  const handleCep = async (candidateId: string, result: 'REUSSI' | 'ECHOUE') => {
    if (result === 'ECHOUE' && !confirm('Confirmer l\'échec CEP ? Le candidat sera annulé.')) return
    try {
      const res = await fetchApi(`/api/v2/entrance-exams/candidates/${candidateId}/cep-result`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ cepResult: result }),
      })
      const data = await res.json()
      if (data.success) {
        onToast(result === 'REUSSI' ? `Admission confirmée — ${data.data.onboardingCreated ? 'dossier d\'inscription envoyé au parent' : 'lien non envoyé (vérifiez le téléphone du parent)'}` : 'Admission annulée', result === 'REUSSI' ? 'success' : 'info')
        if (summary) openSummary(summary.session.id)
      } else onToast(data.message || 'Erreur', 'error')
    } catch { onToast('Erreur', 'error') }
  }

  const handleAnomalies = async (sessionId: string) => {
    try {
      const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/detect-anomalies`, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      setAnomalies(data.data?.anomalies ?? [])
      if ((data.data?.anomalies ?? []).length === 0) onToast('Aucune anomalie détectée', 'success')
    } catch { onToast('Erreur', 'error') }
  }

  const handleScan = async (sessionId: string) => {
    const file = scanFileRef.current?.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      try {
        const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/candidates/scan`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type || 'image/jpeg' }),
        })
        const data = await res.json()
        if (data.success) {
          setScannedPreview(data.data?.candidats ?? [])
          if ((data.data?.warnings ?? []).length) onToast(data.data.warnings.join('; '), 'info')
          else onToast(`${(data.data?.candidats ?? []).length} candidat(s) extrait(s)`, 'success')
        } else onToast(data.message || 'Erreur', 'error')
      } catch { onToast('Erreur scan', 'error') }
    }
    reader.readAsDataURL(file)
  }

  const handleConfirmScan = async (sessionId: string) => {
    if (scannedPreview.length === 0) return
    const candidats = scannedPreview.map(c => ({
      firstName: c.firstName, lastName: c.lastName,
      dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth) : undefined,
      examScore: c.examScore,
    }))
    try {
      const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/candidates`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ candidats }),
      })
      const data = await res.json()
      if (data.success) { onToast(`${data.data.added} candidat(s) ajouté(s)`, 'success'); setScannedPreview([]); openSummary(sessionId) }
      else onToast(data.message || 'Erreur', 'error')
    } catch { onToast('Erreur', 'error') }
  }

  return (
    <div style={{ padding: '24px 32px', height: '100%', overflowY: 'auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 20 }}>📋 {t('entrance_exams.title')}</h2>

      {/* Création */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{t('entrance_exams.create_session')}</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
          <div style={{ flex: 2, minWidth: 200 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('entrance_exams.session_name')}</label>
            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Concours d'entrée 6e 2026-2027" style={{ ...inputStyle, width: '100%' }} />
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

      {/* Liste des sessions */}
      {loading ? <p style={{ color: 'var(--text2)' }}>{t('common.loading')}</p> : sessions.length === 0 ? (
        <p style={{ color: 'var(--text3)', fontStyle: 'italic' }}>{t('entrance_exams.no_sessions')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {sessions.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 18px' }}>
              <div>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{s.name}</span>
                <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--text2)' }}>{new Date(s.examDate).toLocaleDateString()}</span>
                <span style={{ marginLeft: 12, padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: s.status === 'DRAFT' ? 'var(--bg2)' : s.status === 'RESULTS_PENDING' ? 'rgba(234,179,8,0.12)' : 'var(--green-light)', color: s.status === 'DRAFT' ? 'var(--text2)' : s.status === 'RESULTS_PENDING' ? '#b45309' : 'var(--green)' }}>
                  {s.status}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => openSummary(s.id)} style={btnSec}>{t('entrance_exams.view')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Panneau résumé */}
      {summary && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{summary.session.name}</h3>
            <button onClick={() => setSummary(null)} style={btnSec}>{t('common.close')}</button>
          </div>

          {/* Compteurs */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            {[
              { label: t('entrance_exams.total'), value: summary.total, bg: 'var(--blue-light)', color: 'var(--blue)' },
              { label: t('entrance_exams.pending'), value: summary.pending, bg: 'var(--bg2)', color: 'var(--text2)' },
              { label: t('entrance_exams.admis_provisoire'), value: summary.admisProvisoire, bg: 'rgba(234,179,8,0.12)', color: '#b45309' },
              { label: t('entrance_exams.confirmed'), value: summary.confirms, bg: 'rgba(22,163,74,0.12)', color: 'var(--green)' },
              { label: t('entrance_exams.cancelled'), value: summary.annules, bg: 'rgba(239,68,68,0.12)', color: 'var(--red)' },
              { label: t('entrance_exams.cep_pending'), value: summary.cepPending, bg: 'rgba(234,179,8,0.12)', color: '#b45309' },
            ].map(c => (
              <span key={c.label} style={{ padding: '4px 12px', borderRadius: 14, fontSize: 13, fontWeight: 700, background: c.bg, color: c.color }}>
                {c.label} : {c.value}
              </span>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={() => handleImport(summary.session.id)} />
              <button onClick={() => fileRef.current?.click()} style={btnSec}>{t('entrance_exams.import')}</button>
            </div>
            <button onClick={() => handleCompute(summary.session.id)} style={{ ...btnPri, background: 'var(--blue)' }}>{t('entrance_exams.compute')}</button>
            <button onClick={() => handleAnomalies(summary.session.id)} style={{ ...btnSec, color: '#b45309' }}>{t('entrance_exams.detect_anomalies')}</button>
            <div>
              <input ref={scanFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={() => handleScan(summary.session.id)} />
              <button onClick={() => scanFileRef.current?.click()} style={{ ...btnSec, color: 'var(--purple)' }}>{t('entrance_exams.scan')}</button>
            </div>
          </div>

          {/* Anomalies */}
          {anomalies.length > 0 && (
            <div style={{ marginBottom: 16, padding: 12, background: 'rgba(234,179,8,0.08)', borderRadius: 8, border: '1px solid rgba(234,179,8,0.2)' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>{t('entrance_exams.anomalies_found')} ({anomalies.length})</p>
              {anomalies.map((a, i) => (
                <p key={i} style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>• {a.message}</p>
              ))}
            </div>
          )}

          {/* Scan preview */}
          {scannedPreview.length > 0 && (
            <div style={{ marginBottom: 16, padding: 12, background: 'rgba(124,58,237,0.08)', borderRadius: 8, border: '1px solid rgba(124,58,237,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--purple)' }}>{t('entrance_exams.scan_preview')} ({scannedPreview.length})</p>
                <button onClick={() => handleConfirmScan(summary.session.id)} style={{ ...btnPri, background: 'var(--purple)', fontSize: 12, padding: '5px 14px' }}>{t('entrance_exams.confirm_scan')}</button>
              </div>
              {scannedPreview.map((c, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>
                  {c.lastName} {c.firstName} {c.examScore != null ? `— ${c.examScore}` : ''} <span style={{ opacity: 0.5 }}>({c.confidence})</span>
                </div>
              ))}
            </div>
          )}

          {/* Tableau candidats */}
          <div style={{ maxHeight: 350, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('entrance_exams.col_name')}</th>
                  <th style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('entrance_exams.col_score')}</th>
                  <th style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('entrance_exams.col_status')}</th>
                  <th style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('entrance_exams.col_cep')}</th>
                  <th style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('entrance_exams.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.candidates.map(c => (
                  <tr key={c.id}>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)' }}>{c.lastName} {c.firstName}</td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)', textAlign: 'center' }}>{c.examScore ?? '—'}</td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)', textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: c.admissionStatus === 'CONFIRME' ? 'rgba(22,163,74,0.12)' : c.admissionStatus === 'ADMIS_PROVISOIRE' ? 'rgba(234,179,8,0.12)' : c.admissionStatus === 'ANNULE' ? 'rgba(239,68,68,0.12)' : 'var(--bg2)', color: c.admissionStatus === 'CONFIRME' ? 'var(--green)' : c.admissionStatus === 'ADMIS_PROVISOIRE' ? '#b45309' : c.admissionStatus === 'ANNULE' ? 'var(--red)' : 'var(--text2)' }}>
                        {c.admissionStatus}
                      </span>
                    </td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)', textAlign: 'center' }}>
                      {c.admissionStatus === 'ADMIS_PROVISOIRE' && c.cepResult !== 'REUSSI' && c.cepResult !== 'ECHOUE' ? (
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button onClick={() => handleCep(c.id, 'REUSSI')} style={{ ...btnPri, fontSize: 11, padding: '3px 10px', background: 'var(--green)' }}>✓ Réussi</button>
                          <button onClick={() => handleCep(c.id, 'ECHOUE')} style={{ ...btnPri, fontSize: 11, padding: '3px 10px', background: 'var(--red)' }}>✗ Échoué</button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text2)' }}>{c.cepResult ?? '—'}</span>
                      )}
                    </td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)', textAlign: 'center', fontSize: 11, color: 'var(--text3)' }}>
                      {c.studentProfileId ? `Profil: ${c.studentProfileId.slice(0, 8)}...` : '—'}
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
