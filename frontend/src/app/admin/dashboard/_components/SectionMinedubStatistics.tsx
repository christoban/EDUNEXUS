'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }

const PRIMARY_LEVELS = ['SIL', 'CP', 'CE1', 'CE2', 'CM1', 'CM2']

const INFRA_ROWS = [
  { key: 'sallesClasseOccupees', label: 'Salles de classe occupées' },
  { key: 'sallesClasseNonOccupees', label: 'Salles de classe non occupées' },
  { key: 'salleInformatique', label: 'Salle informatique' },
  { key: 'logementFonction', label: 'Logement de fonction' },
  { key: 'magasins', label: 'Magasins' },
  { key: 'toilettesLatrines', label: 'Toilettes ou latrines' },
]
const INFRA_SUB_KEYS = [
  { key: 'durBon', label: 'Dur — Bon' }, { key: 'durAssezBon', label: 'Dur — Assez bon' }, { key: 'durMauvais', label: 'Dur — Mauvais' },
  { key: 'semiDurBon', label: 'Semi-dur — Bon' }, { key: 'semiDurAssezBon', label: 'Semi-dur — Assez bon' }, { key: 'semiDurMauvais', label: 'Semi-dur — Mauvais' },
  { key: 'provisoireBon', label: 'Provisoire — Bon' }, { key: 'provisoireAssezBon', label: 'Provisoire — Assez bon' }, { key: 'provisoireMauvais', label: 'Provisoire — Mauvais' },
]

interface Supplement {
  zoneImplantation: string | null
  ordreEnseignement: string | null
  elevesVulnerablesDetail: Record<string, any> | null
  infrastructuresDetail: Record<string, any> | null
  commoditesDetail: Record<string, any> | null
  lastUpdatedAt: string | null
}
interface ChampNonResolu { section: string; champ: string; raison: string }
interface Report { id: string; generatedAt: string; filePath: string | null }

const btnPri = { padding: '10px 20px', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' as const }
const btnSec = { padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer' as const }
const inputStyle = { padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, width: '100%', boxSizing: 'border-box' as const }
const smallInputStyle = { ...inputStyle, padding: '6px 10px', fontSize: 13 }
const cardStyleCls = 'rounded-[16px] md:rounded-[12px] p-[16px] md:p-[20px] mb-[12px] md:mb-[20px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[var(--border)]'
const cardStyle = { background: 'var(--surface)' }

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', margin: '12px 0 6px' }}>{children}</div>
}

export default function SectionMinedubStatistics({ onToast }: Props) {
  const t = useT('admin')
  const [tab, setTab] = useState<'supplement' | 'generer'>('supplement')
  const [supplement, setSupplement] = useState<Supplement | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expandedInfraRow, setExpandedInfraRow] = useState<string | null>(null)

  const [generating, setGenerating] = useState(false)
  const [champsNonResolus, setChampsNonResolus] = useState<ChampNonResolu[]>([])
  const [lastReport, setLastReport] = useState<Report | null>(null)
  const [reports, setReports] = useState<Report[]>([])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [supRes, repRes] = await Promise.all([
        fetchApi('/api/v2/statistical-campaign-minedub/supplement', { credentials: 'include' }),
        fetchApi('/api/v2/statistical-campaign-minedub/reports', { credentials: 'include' }),
      ])
      const supData = await supRes.json()
      const repData = await repRes.json()
      if (supData.success) { setSupplement(supData.data); setForm(supData.data ?? {}) }
      if (repData.success) setReports(repData.data || [])
    } catch { onToast(t('minedubStats.errorGeneric'), 'error') } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const saveSupplement = async () => {
    setSaving(true)
    try {
      const res = await fetchApi('/api/v2/statistical-campaign-minedub/supplement', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) { onToast(t('minedubStats.supplementSaved'), 'success'); setSupplement(data.data) }
      else onToast(data.message || t('minedubStats.errorGeneric'), 'error')
    } catch { onToast(t('minedubStats.errorGeneric'), 'error') } finally { setSaving(false) }
  }

  const setVulnerable = (niveau: string, key: string, value: number | null) => {
    const detail = { ...(form.elevesVulnerablesDetail ?? {}) }
    detail[niveau] = { ...(detail[niveau] ?? {}), [key]: value }
    setForm((f) => ({ ...f, elevesVulnerablesDetail: detail }))
  }
  const getVulnerable = (niveau: string, key: string): number | null => form.elevesVulnerablesDetail?.[niveau]?.[key] ?? null

  const setInfraValue = (roomKey: string, subKey: string, value: number | null) => {
    const detail = { ...(form.infrastructuresDetail ?? {}) }
    detail[roomKey] = { ...(detail[roomKey] ?? {}), [subKey]: value }
    setForm((f) => ({ ...f, infrastructuresDetail: detail }))
  }
  const getInfraValue = (roomKey: string, subKey: string): number | null => form.infrastructuresDetail?.[roomKey]?.[subKey] ?? null
  const getInfraTotal = (roomKey: string): number => {
    const row = form.infrastructuresDetail?.[roomKey]
    if (!row) return 0
    return INFRA_SUB_KEYS.reduce((sum, k) => sum + (Number(row[k.key]) || 0), 0)
  }

  const setCommodite = (key: string, value: string) => {
    setForm((f) => ({ ...f, commoditesDetail: { ...(f.commoditesDetail ?? {}), [key]: value } }))
  }

  const genererRapport = async () => {
    setGenerating(true)
    setChampsNonResolus([])
    try {
      const res = await fetchApi('/api/v2/statistical-campaign-minedub/generer', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!data.success) { onToast(data.message || t('minedubStats.errorGeneric'), 'error'); return }
      setChampsNonResolus(data.data.champsNonResolus || [])
      setLastReport({ id: data.data.reportId, generatedAt: new Date().toISOString(), filePath: data.data.filePath })
      onToast(t('minedubStats.generationSuccess'), 'success')
      fetchAll()
    } catch { onToast(t('minedubStats.errorGeneric'), 'error') } finally { setGenerating(false) }
  }

  const downloadReport = (id: string) => window.open(`/api/v2/statistical-campaign-minedub/reports/${id}/download`, '_blank')

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>{t('common.loading') || '...'}</div>

  return (
    <div className="px-4 py-5 md:px-8 md:py-7" style={{ height: '100%', overflowY: 'auto' }}>
      <div className="mb-[16px] md:mb-[20px]">
        <h2 className="text-[22px] md:text-[28px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>{t('minedubStats.title')}</h2>
        <p className="text-[13px] md:text-[14px]" style={{ color: 'var(--text3)', marginTop: 4 }}>{t('minedubStats.subtitle')}</p>
      </div>

      <div className="text-[11.5px] md:text-[12px] px-[13px] md:px-[16px] py-[11px] md:py-[10px] mb-[16px] md:mb-[20px]" style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid #eab308', borderRadius: 10, color: '#92400e' }}>
        {t('minedubStats.nonOfficialWarning')}
      </div>

      <div className="gap-[6px] md:gap-[8px] mb-[16px] md:mb-[20px]" style={{ display: 'flex' }}>
        <button onClick={() => setTab('supplement')} className="flex-1 md:flex-none rounded-[12px] md:rounded-[8px] text-[12.5px] md:text-[14px] py-[10px] px-0 md:px-[20px] md:py-[10px]" style={{ ...(tab === 'supplement' ? btnPri : btnSec), padding: undefined }}>{t('minedubStats.tabSupplement')}</button>
        <button onClick={() => setTab('generer')} className="flex-1 md:flex-none rounded-[12px] md:rounded-[8px] text-[12.5px] md:text-[14px] py-[10px] px-0 md:px-[20px] md:py-[10px]" style={{ ...(tab === 'generer' ? btnPri : btnSec), padding: undefined }}>{t('minedubStats.tabGenerer')}</button>
      </div>

      {tab === 'supplement' && (
        <div>
          {supplement?.lastUpdatedAt && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
              {t('minedubStats.lastUpdated')} : {new Date(supplement.lastUpdatedAt).toLocaleDateString()}
            </div>
          )}

          <div className={cardStyleCls} style={cardStyle}>
            <h3 className="text-[14px] md:text-[16px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('minedubStats.sectionIdentification')}</h3>
            <FieldLabel>{t('minedubStats.fieldZone')}</FieldLabel>
            <select style={inputStyle} value={form.zoneImplantation ?? ''} onChange={(e) => setForm((f) => ({ ...f, zoneImplantation: e.target.value || null }))}>
              <option value="">—</option>
              <option value="URBAINE">{t('minedubStats.zoneUrbaine')}</option>
              <option value="RURALE">{t('minedubStats.zoneRurale')}</option>
            </select>
            <FieldLabel>{t('minedubStats.fieldOrdre')}</FieldLabel>
            <select style={inputStyle} value={form.ordreEnseignement ?? ''} onChange={(e) => setForm((f) => ({ ...f, ordreEnseignement: e.target.value || null }))}>
              <option value="">—</option>
              <option value="PUBLIC">{t('minedubStats.ordrePublic')}</option>
              <option value="PRIVE_CATHOLIQUE">{t('minedubStats.ordreCatholique')}</option>
              <option value="PRIVE_PROTESTANT">{t('minedubStats.ordreProtestant')}</option>
              <option value="PRIVE_ISLAMIQUE">{t('minedubStats.ordreIslamique')}</option>
              <option value="PRIVE_LAIC">{t('minedubStats.ordreLaic')}</option>
              <option value="COMMUNAUTAIRE">{t('minedubStats.ordreCommunautaire')}</option>
            </select>
          </div>

          <div className={cardStyleCls} style={cardStyle}>
            <h3 className="text-[14px] md:text-[16px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('minedubStats.sectionVulnerables')}</h3>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>{t('minedubStats.vulnerablesHint')}</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>{t('minedubStats.colNiveau')}</th>
                    <th style={{ padding: '6px 8px' }}>{t('minedubStats.colRefugiesF')}</th>
                    <th style={{ padding: '6px 8px' }}>{t('minedubStats.colRefugiesG')}</th>
                    <th style={{ padding: '6px 8px' }}>{t('minedubStats.colDeplacesF')}</th>
                    <th style={{ padding: '6px 8px' }}>{t('minedubStats.colDeplacesG')}</th>
                    <th style={{ padding: '6px 8px' }}>{t('minedubStats.colHandicapesF')}</th>
                    <th style={{ padding: '6px 8px' }}>{t('minedubStats.colHandicapesG')}</th>
                  </tr>
                </thead>
                <tbody>
                  {PRIMARY_LEVELS.map((niveau) => (
                    <tr key={niveau} style={{ borderTop: '1px solid var(--bg)' }}>
                      <td style={{ padding: '4px 8px', fontWeight: 700 }}>{niveau}</td>
                      {(['refugiesF', 'refugiesG', 'deplacesF', 'deplacesG', 'handicapesF', 'handicapesG'] as const).map((k) => (
                        <td key={k} style={{ padding: '4px 6px' }}>
                          <input style={{ ...smallInputStyle, width: 60 }} type="number" min={0}
                            value={getVulnerable(niveau, k) ?? ''}
                            onChange={(e) => setVulnerable(niveau, k, e.target.value === '' ? null : Number(e.target.value))} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={cardStyleCls} style={cardStyle}>
            <h3 className="text-[14px] md:text-[16px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('minedubStats.sectionInfrastructures')}</h3>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>{t('minedubStats.infrastructuresHint')}</p>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {INFRA_ROWS.map((row) => {
                const isOpen = expandedInfraRow === row.key
                return (
                  <div key={row.key} style={{ borderTop: '1px solid var(--bg)' }}>
                    <div onClick={() => setExpandedInfraRow(isOpen ? null : row.key)}
                      className="flex-wrap gap-[6px]"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer' }}>
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>{row.label}</span>
                      <span className="gap-[10px] md:gap-[14px]" style={{ fontSize: 12, color: 'var(--text3)', display: 'flex' }}>
                        <span>{t('minedubStats.infraTotal')}: <strong style={{ color: 'var(--text)' }}>{getInfraTotal(row.key)}</strong></span>
                        <span>{isOpen ? '▲' : '▼'}</span>
                      </span>
                    </div>
                    {isOpen && (
                      <div style={{ padding: '4px 14px 14px', background: 'var(--bg2)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        {INFRA_SUB_KEYS.map((sub) => (
                          <div key={sub.key} style={{ minWidth: 110 }}>
                            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{sub.label}</div>
                            <input style={smallInputStyle} type="number" min={0}
                              value={getInfraValue(row.key, sub.key) ?? ''}
                              onChange={(e) => setInfraValue(row.key, sub.key, e.target.value === '' ? null : Number(e.target.value))} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className={cardStyleCls} style={cardStyle}>
            <h3 className="text-[14px] md:text-[16px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>{t('minedubStats.sectionCommodites')}</h3>
            {(['pointEau', 'latrines', 'electricite', 'cantine'] as const).map((key) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <FieldLabel>{t(`minedubStats.commodite_${key}`)}</FieldLabel>
                <input style={inputStyle} value={form.commoditesDetail?.[key] ?? ''} onChange={(e) => setCommodite(key, e.target.value)} />
              </div>
            ))}
          </div>

          <button onClick={saveSupplement} disabled={saving} style={btnPri}>{saving ? '...' : t('minedubStats.saveSupplement')}</button>
        </div>
      )}

      {tab === 'generer' && (
        <div>
          <div className={cardStyleCls} style={cardStyle}>
            <p className="text-[12.5px] md:text-[14px]" style={{ color: 'var(--text2)', marginBottom: 16, lineHeight: 1.5 }}>{t('minedubStats.generateDescription')}</p>
            <button onClick={genererRapport} disabled={generating} className="w-full justify-center" style={{ ...btnPri, display: 'inline-flex', alignItems: 'center' }}>{generating ? '...' : t('minedubStats.generateBtn')}</button>
          </div>

          {lastReport && (
            <div className={cardStyleCls} style={{ ...cardStyle, border: '1.5px solid var(--green)' }}>
              <p className="text-[13px] md:text-[14px]" style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 8 }}>{t('minedubStats.generationSuccess')}</p>
              <button onClick={() => downloadReport(lastReport.id)} style={btnSec}>{t('minedubStats.downloadBtn')}</button>
              {champsNonResolus.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>
                    {t('minedubStats.champsNonResolusTitle', { count: String(champsNonResolus.length) })}
                  </p>
                  {champsNonResolus.map((c, i) => (
                    <div key={i} style={{ fontSize: 12, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700 }}>{c.section}</span> — <span style={{ color: 'var(--text3)' }}>{c.raison}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={cardStyleCls} style={cardStyle}>
            <h3 className="text-[14px] md:text-[16px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>{t('minedubStats.historyTitle')}</h3>
            {reports.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text3)' }}>{t('minedubStats.historyEmpty')}</p>
            ) : (
              <>
              {/* ── Cartes empilées — mobile ── */}
              <div className="md:hidden flex flex-col" style={{ gap: 8 }}>
                {reports.map((r) => (
                  <div key={r.id} className="rounded-[14px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)', padding: '13px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{new Date(r.generatedAt).toLocaleString()}</div>
                    <button onClick={() => downloadReport(r.id)} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 800, background: 'var(--bg2)', color: 'var(--text)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>{t('minedubStats.downloadBtn')}</button>
                  </div>
                ))}
              </div>
              {/* ── Tableau — desktop ── */}
              <div className="hidden md:block">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {reports.map((r) => (
                      <tr key={r.id} style={{ borderTop: '1px solid var(--bg)' }}>
                        <td style={{ padding: '8px 12px', color: 'var(--text2)' }}>{new Date(r.generatedAt).toLocaleString()}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <button onClick={() => downloadReport(r.id)} style={{ ...btnSec, padding: '4px 10px', fontSize: 12 }}>{t('minedubStats.downloadBtn')}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
