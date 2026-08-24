'use client'
import { useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { AlertTriangle, Package } from 'lucide-react'
import StudentFollowUpButtons from '@/features/suivi-eleves/StudentFollowUpButtons'

interface AtRiskStudent {
  studentId: string
  name: string
  classId: string | null
  className: string
  // COMPOSITE = score de santé scolaire général (uniquement pour les classes dont l'enseignant
  // est professeur principal) ; SUBJECT_DROP = chute détectée dans SA matière précisément, pour
  // les classes où il n'est qu'enseignant de matière — jamais le score général dans ce cas
  // (relecture juillet 2026, "jamais pour le score général… absences, discipline, paiement ne le
  // concernent pas").
  source: 'COMPOSITE' | 'SUBJECT_DROP'
  healthScore: number | null
  alertLevel: 'critical' | 'warning' | null
  subjectName: string | null
  conseil: string | null
  conseilDate: string | null
  recommendationId: string | null
  isProfesseurPrincipal: boolean
  mesMatieres: { id: string; name: string }[]
}

interface AtRiskResponse {
  students: AtRiskStudent[]
  summary: { critical: number; warning: number }
  conseillerPedagogiqueDisponible: boolean
}

interface Props {
  currentUserId: string
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function SectionTeacherAtRisk({ currentUserId, onToast }: Props) {
  const t = useT('teacher')
  const tcommon = useT('common')

  const fetchAtRiskFn = useCallback(async (): Promise<AtRiskResponse> => {
    const res = await fetchApi('/api/v2/ai/at-risk-students', { credentials: 'include' }).then(r => r.json())
    return res
  }, [])

  const { data, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<AtRiskResponse>('teacher:at-risk-students', fetchAtRiskFn)
  const students = data?.students ?? []
  const summary = data?.summary ?? { critical: 0, warning: 0 }
  const conseillerDisponible = data?.conseillerPedagogiqueDisponible ?? false

  if (loading) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{t('at_risk.loading')}</div>
      </div>
    )
  }

  if (error && error !== 'OFFLINE_NO_CACHE') {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{t('at_risk.load_error')}</div>
          <button onClick={refetch}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('at_risk.retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 26 }}>
        <div style={sTitle}>{t('at_risk.title')}</div>
        <div style={sSub}>{t('at_risk.subtitle')}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          {summary.critical > 0 && (
            <span style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '5px 14px', borderRadius: 20, fontSize: 14, fontWeight: 800 }}>
              {t('at_risk.summary_critical').replace('{count}', String(summary.critical))}
            </span>
          )}
          {summary.warning > 0 && (
            <span style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '5px 14px', borderRadius: 20, fontSize: 14, fontWeight: 800 }}>
              {t('at_risk.summary_warning').replace('{count}', String(summary.warning))}
            </span>
          )}
        </div>
        {fromCache && cachedAt && (
          <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, padding: '5px 12px', fontSize: 13, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <Package size={14} strokeWidth={2} /> {tcommon('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
          </div>
        )}
      </div>

      {students.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', padding: 48, textAlign: 'center', maxWidth: 460 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><AlertTriangle size={40} color="var(--green)" /></div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 19, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            {t('at_risk.empty_title')}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 500 }}>{t('at_risk.empty_sub')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {students.map((s) => {
            const isSubjectDrop = s.source === 'SUBJECT_DROP'
            const isCritical = s.alertLevel === 'critical'
            const color = isSubjectDrop ? 'var(--blue)' : isCritical ? 'var(--red)' : 'var(--amber)'
            const bg = isSubjectDrop ? 'var(--blue-light)' : isCritical ? 'var(--red-light)' : 'var(--amber-light)'
            return (
              <div key={`${s.studentId}-${s.source}-${s.subjectName ?? ''}`}
                style={{ background: 'var(--surface)', borderRadius: 14, border: `1.5px solid ${!isSubjectDrop && isCritical ? 'var(--red)' : 'var(--border)'}`, padding: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{s.name}</div>
                    <div style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 600 }}>{s.className}</div>
                  </div>
                  <span style={{ background: bg, color, padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 800 }}>
                    {isSubjectDrop ? t('at_risk.level_subject_drop') : isCritical ? t('at_risk.level_critical') : t('at_risk.level_warning')}
                  </span>
                </div>

                {isSubjectDrop ? (
                  <div style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 600, marginBottom: s.conseil ? 14 : 0 }}>
                    {t('at_risk.subject_drop_label')} <strong>{s.subjectName}</strong>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: s.conseil ? 14 : 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)' }}>{t('at_risk.score_label')}</span>
                    <span style={{ fontSize: 20, fontWeight: 900, color }}>{s.healthScore}<span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)' }}>/100</span></span>
                  </div>
                )}

                {s.conseil && (
                  <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                      {t('at_risk.advice_title')}
                    </div>
                    <div style={{ fontSize: 15, color: 'var(--text2)', fontWeight: 500, lineHeight: 1.5 }}>{s.conseil}</div>
                  </div>
                )}

                <StudentFollowUpButtons
                  studentId={s.studentId}
                  triggeringRecommendationId={s.recommendationId}
                  role={s.isProfesseurPrincipal ? 'PROF_PRINCIPAL' : 'ENSEIGNANT_MATIERE'}
                  mesMatieres={s.mesMatieres}
                  conseillerDisponible={conseillerDisponible}
                  currentUserId={currentUserId}
                  onToast={onToast}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
