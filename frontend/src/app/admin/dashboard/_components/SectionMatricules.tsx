'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { IdCard, Check, HelpCircle, X, AlertTriangle, ArrowLeftRight } from 'lucide-react'

interface Props { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }

interface UnmatchedDetail { ligne: number; nom: string; prenom: string; raison: string }
interface FuzzyMatch {
  ligne: number; studentProfileId: string; userId: string
  nomFichier: string; prenomFichier: string; nomBase: string; prenomBase: string
  dateNaissance: string | null; matriculeNouveau: string
  similarityPercent: number
  status: 'PENDING' | 'CONFIRMED' | 'FLAGGED'
}

interface ImportJob {
  id: string; fileName: string; status: string
  totalRows: number; matchedRows: number; unmatchedRows: number; errorRows: number
  matchedRowsExact?: number; matchedRowsFuzzyConfirmed?: number; flaggedForCorrection?: number
  createdAt: string; processedAt: string | null
  // Ancien import (avant fuzzy matching) : tableau brut. Nouvel import : objet { unmatched, fuzzyMatches }.
  resultDetails: UnmatchedDetail[] | { unmatched: UnmatchedDetail[]; fuzzyMatches: FuzzyMatch[] } | null
}

const btnPri = { padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' as const }
const btnSec = { padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer' as const }

function extractUnmatched(details: ImportJob['resultDetails']): UnmatchedDetail[] {
  if (!details) return []
  if (Array.isArray(details)) return details
  return details.unmatched ?? []
}
function extractFuzzy(details: ImportJob['resultDetails']): FuzzyMatch[] {
  if (!details || Array.isArray(details)) return []
  return details.fuzzyMatches ?? []
}

export default function SectionMatricules({ onToast }: Props) {
  const t = useT('admin')
  const [jobs, setJobs] = useState<ImportJob[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<ImportJob | null>(null)
  const [importing, setImporting] = useState(false)
  const [processingLigne, setProcessingLigne] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchApi('/api/v2/matricules/import-jobs/current', { credentials: 'include' })
      const data = await res.json()
      setJobs(data.data ?? [])
    } catch { /* empty */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    try {
      setImporting(true)
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetchApi('/api/v2/matricules/import', {
        method: 'POST', credentials: 'include', body: fd,
      })
      const data = await res.json()
      if (data.success) {
        const r = data.data
        onToast(
          t('matricules.import_summary_toast')
            .replace('{exact}', String(r.matchedExact ?? r.matched))
            .replace('{fuzzy}', String(r.fuzzyPending ?? 0))
            .replace('{unmatched}', String(r.unmatched))
            .replace('{errors}', String(r.errors)),
          r.unmatched > 0 || (r.fuzzyPending ?? 0) > 0 ? 'info' : 'success',
        )
        setSelectedJob({
          id: r.jobId, fileName: file.name, status: 'COMPLETED',
          totalRows: r.total, matchedRows: r.matched, unmatchedRows: r.unmatched, errorRows: r.errors,
          matchedRowsExact: r.matchedExact, matchedRowsFuzzyConfirmed: 0, flaggedForCorrection: 0,
          createdAt: new Date().toISOString(), processedAt: new Date().toISOString(),
          resultDetails: { unmatched: r.unmatchedDetails ?? [], fuzzyMatches: r.fuzzyMatches ?? [] },
        })
        loadJobs()
      } else {
        onToast(data.message || t('matricules.error_generic'), 'error')
      }
    } catch { onToast(t('matricules.error_generic'), 'error') } finally { setImporting(false) }
  }

  const viewJob = async (jobId: string) => {
    try {
      const res = await fetchApi(`/api/v2/matricules/import-jobs/${jobId}`, { credentials: 'include' })
      const data = await res.json()
      setSelectedJob(data.data ?? null)
    } catch { onToast(t('matricules.error_generic'), 'error') }
  }

  const confirmFuzzy = async (ligne: number) => {
    if (!selectedJob) return
    setProcessingLigne(ligne)
    try {
      const res = await fetchApi(`/api/v2/matricules/fuzzy-matches/${selectedJob.id}/${ligne}/confirm`, {
        method: 'POST', credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        onToast(t('matricules.fuzzy_confirmed_toast'), 'success')
        viewJob(selectedJob.id)
        loadJobs()
      } else onToast(data.message || t('matricules.error_generic'), 'error')
    } catch { onToast(t('matricules.error_generic'), 'error') } finally { setProcessingLigne(null) }
  }

  const flagFuzzy = async (ligne: number) => {
    if (!selectedJob) return
    setProcessingLigne(ligne)
    try {
      const res = await fetchApi(`/api/v2/matricules/fuzzy-matches/${selectedJob.id}/${ligne}/flag`, {
        method: 'POST', credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        onToast(data.data?.message || t('matricules.fuzzy_flagged_toast'), 'info')
        viewJob(selectedJob.id)
        loadJobs()
      } else onToast(data.message || t('matricules.error_generic'), 'error')
    } catch { onToast(t('matricules.error_generic'), 'error') } finally { setProcessingLigne(null) }
  }

  const unmatchedDetails = extractUnmatched(selectedJob?.resultDetails ?? null)
  const fuzzyMatches = extractFuzzy(selectedJob?.resultDetails ?? null).filter(f => f.status === 'PENDING')

  return (
    <div style={{ padding: '24px 32px', height: '100%', overflowY: 'auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <IdCard size={20} strokeWidth={2} /> {t('matricules.title')}
      </h2>

      {/* Import */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{t('matricules.import_title')}</h3>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
          {t('matricules.import_desc')}
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()} style={btnSec}>{t('matricules.select_file')}</button>
          <button onClick={handleImport} disabled={importing} style={btnPri}>{importing ? '...' : t('matricules.start_import')}</button>
        </div>
      </div>

      {/* Historique */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{t('matricules.history')}</h3>
        {loading ? <p style={{ color: 'var(--text2)' }}>{t('common.loading')}</p> : jobs.length === 0 ? (
          <p style={{ color: 'var(--text3)', fontStyle: 'italic' }}>{t('matricules.no_imports')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {jobs.map(j => {
              const pendingFuzzy = extractFuzzy(j.resultDetails).filter(f => f.status === 'PENDING').length
              return (
                <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{j.fileName}</span>
                    <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--text3)' }}>{new Date(j.createdAt).toLocaleDateString()}</span>
                    <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: j.status === 'COMPLETED' ? 'rgba(22,163,74,0.12)' : 'var(--bg2)', color: j.status === 'COMPLETED' ? 'var(--green)' : 'var(--text2)' }}>{j.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text2)', alignItems: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={12} strokeWidth={2} /> {j.matchedRows}</span>
                    {pendingFuzzy > 0 && (
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: 'rgba(234,179,8,0.15)', color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <HelpCircle size={12} strokeWidth={2} /> {pendingFuzzy}
                      </span>
                    )}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><X size={12} strokeWidth={2} /> {j.unmatchedRows}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={12} strokeWidth={2} /> {j.errorRows}</span>
                    <button onClick={() => viewJob(j.id)} style={{ ...btnSec, fontSize: 11, padding: '4px 10px' }}>{t('matricules.view')}</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Détail job sélectionné */}
      {selectedJob && (
        <div style={{ marginTop: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{t('matricules.detail')} — {selectedJob.fileName}</h3>
            <button onClick={() => setSelectedJob(null)} style={btnSec}>{t('common.close')}</button>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={{ padding: '4px 12px', borderRadius: 14, fontSize: 13, fontWeight: 700, background: 'var(--blue-light)', color: 'var(--blue)' }}>{t('matricules.stat_total')} : {selectedJob.totalRows}</span>
            <span style={{ padding: '4px 12px', borderRadius: 14, fontSize: 13, fontWeight: 700, background: 'rgba(22,163,74,0.12)', color: 'var(--green)' }}>{t('matricules.stat_matched')} : {selectedJob.matchedRows}</span>
            {fuzzyMatches.length > 0 && (
              <span style={{ padding: '4px 12px', borderRadius: 14, fontSize: 13, fontWeight: 700, background: 'rgba(234,179,8,0.15)', color: '#b45309' }}>{t('matricules.stat_fuzzy_pending')} : {fuzzyMatches.length}</span>
            )}
            <span style={{ padding: '4px 12px', borderRadius: 14, fontSize: 13, fontWeight: 700, background: 'rgba(234,179,8,0.12)', color: '#b45309' }}>{t('matricules.stat_unmatched')} : {selectedJob.unmatchedRows}</span>
            <span style={{ padding: '4px 12px', borderRadius: 14, fontSize: 13, fontWeight: 700, background: 'rgba(239,68,68,0.12)', color: 'var(--red)' }}>{t('matricules.stat_errors')} : {selectedJob.errorRows}</span>
          </div>

          {/* Correspondances probables à confirmer */}
          {fuzzyMatches.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <HelpCircle size={15} strokeWidth={2} /> {t('matricules.fuzzy_section_title')}
              </h4>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>{t('matricules.fuzzy_section_desc')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fuzzyMatches.map(f => (
                  <div key={f.ligne} style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginBottom: 2 }}>{t('matricules.fuzzy_base_label')}</div>
                          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{f.nomBase} {f.prenomBase}</div>
                        </div>
                        <div style={{ color: 'var(--text3)', alignSelf: 'center', display: 'flex' }}><ArrowLeftRight size={14} strokeWidth={2} /></div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginBottom: 2 }}>{t('matricules.fuzzy_file_label')}</div>
                          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{f.nomFichier} {f.prenomFichier}</div>
                        </div>
                      </div>
                      <span style={{ padding: '4px 12px', borderRadius: 14, fontSize: 12, fontWeight: 800, background: '#b45309', color: '#fff' }}>
                        {f.similarityPercent}% {t('matricules.fuzzy_similarity_label')}
                      </span>
                    </div>
                    {f.dateNaissance && (
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                        {t('matricules.fuzzy_dob_label')} {f.dateNaissance}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => confirmFuzzy(f.ligne)} disabled={processingLigne === f.ligne}
                        style={{ ...btnPri, fontSize: 12, padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Check size={13} strokeWidth={2} /> {t('matricules.fuzzy_confirm_btn')}
                      </button>
                      <button onClick={() => flagFuzzy(f.ligne)} disabled={processingLigne === f.ligne}
                        style={{ ...btnSec, fontSize: 12, padding: '6px 14px', color: 'var(--red)', borderColor: 'rgba(220,38,38,0.3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={13} strokeWidth={2} /> {t('matricules.fuzzy_flag_btn')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {unmatchedDetails.length > 0 && (
            <div style={{ maxHeight: 250, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('matricules.col_ligne')}</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('matricules.col_nom')}</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('matricules.col_raison')}</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatchedDetails.map((d, i) => (
                    <tr key={i}>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)' }}>{d.ligne}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)' }}>{d.nom} {d.prenom}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)', color: d.raison.includes('Conflit') ? '#b45309' : 'var(--text2)' }}>{d.raison}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
