'use client'

import { useEffect, useState, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { TrendingUp, TrendingDown, Minus, Award, AlertTriangle, BookOpen } from 'lucide-react'

interface MatiereProfil {
  subjectId: string
  subjectName: string
  coefficient: number
  moyennesParPeriode: (number | null)[]
  moyenneAnnuelle: number
  classification: 'FORCE' | 'ACQUIS' | 'FAIBLE' | 'CRITIQUE'
  tendance: 'HAUSSE' | 'STABLE' | 'BAISSE'
}

interface ProfilData {
  studentFirstName: string
  studentLastName: string
  periodes: { periodId: string; nom: string; moyenneGenerale: number | null }[]
  matieres: MatiereProfil[]
  forces: string[]
  faiblesses: string[]
  moyenneGeneraleAnnuelle: number | null
}

interface Props {
  studentId: string
  academicYearId?: string
}

const CLASSIFICATION_STYLES: Record<string, { bg: string; color: string; labelKey: string }> = {
  FORCE: { bg: 'var(--green-light)', color: 'var(--green)', labelKey: 'academic.class_force' },
  ACQUIS: { bg: 'var(--blue-light)', color: 'var(--blue)', labelKey: 'academic.class_acquis' },
  FAIBLE: { bg: 'var(--amber-light)', color: 'var(--amber)', labelKey: 'academic.class_faible' },
  CRITIQUE: { bg: 'var(--red-light)', color: 'var(--red)', labelKey: 'academic.class_critique' },
}

export default function SectionProfilAcademique({ studentId, academicYearId }: Props) {
  const t = useT('student')
  const [data, setData] = useState<ProfilData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const charger = useCallback(async () => {
    if (!studentId) return
    setLoading(true)
    setError(null)
    try {
      const q = academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : ''
      const res = await fetchApi(`/api/v2/students/${studentId}/academic-profile${q}`, {
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data)
      } else {
        setError(json.message || 'Erreur lors du chargement')
      }
    } catch {
      setError('Impossible de charger le profil académique')
    } finally {
      setLoading(false)
    }
  }, [studentId, academicYearId])

  useEffect(() => {
    charger()
  }, [charger])

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text2)' }}>
        {t('academic.loading')}
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 16, background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8 }}>
        {error}
      </div>
    )
  }

  if (!data || data.matieres.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)' }}>
        <BookOpen size={32} style={{ color: 'var(--text2)', marginBottom: 8 }} />
        <p style={{ color: 'var(--text2)', margin: 0, fontSize: 14 }}>{t('academic.empty')}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* En-tête : Moyenne générale annuelle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        background: 'var(--bg2)',
        borderRadius: 12,
        border: '1px solid var(--border)',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text)' }}>
            {t('academic.title')}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text2)' }}>
            {data.studentFirstName} {data.studentLastName}
          </p>
        </div>
        {data.moyenneGeneraleAnnuelle !== null && (
          <div style={{
            padding: '8px 16px',
            background: 'var(--blue-light)',
            color: 'var(--blue)',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 16,
          }}>
            {t('academic.annual_average')} : {data.moyenneGeneraleAnnuelle.toFixed(2)}
          </div>
        )}
      </div>

      {/* Forces et Faiblesses */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* Points forts */}
        <div style={{
          padding: 16,
          background: 'var(--bg2)',
          borderRadius: 12,
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--green)' }}>
            <Award size={18} />
            <strong style={{ fontSize: 14 }}>{t('academic.strengths')}</strong>
          </div>
          {data.forces.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text2)' }}>{t('academic.no_strengths')}</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {data.forces.map((f) => (
                <span
                  key={f}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 16,
                    background: 'var(--green-light)',
                    color: 'var(--green)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Points à améliorer */}
        <div style={{
          padding: 16,
          background: 'var(--bg2)',
          borderRadius: 12,
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--red)' }}>
            <AlertTriangle size={18} />
            <strong style={{ fontSize: 14 }}>{t('academic.weaknesses')}</strong>
          </div>
          {data.faiblesses.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text2)' }}>{t('academic.no_weaknesses')}</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {data.faiblesses.map((w) => (
                <span
                  key={w}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 16,
                    background: 'var(--red-light)',
                    color: 'var(--red)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {w}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tableau détaillé des matières */}
      <div style={{
        background: 'var(--bg2)',
        borderRadius: 12,
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', color: 'var(--text2)', fontWeight: 600 }}>{t('academic.subject')}</th>
                <th style={{ padding: '12px 12px', color: 'var(--text2)', fontWeight: 600 }}>Coef</th>
                {data.periodes.map((p) => (
                  <th key={p.periodId} style={{ padding: '12px 12px', color: 'var(--text2)', fontWeight: 600 }}>
                    {p.nom}
                  </th>
                ))}
                <th style={{ padding: '12px 12px', color: 'var(--text2)', fontWeight: 600 }}>{t('academic.annual_avg_short')}</th>
                <th style={{ padding: '12px 12px', color: 'var(--text2)', fontWeight: 600 }}>{t('academic.status')}</th>
                <th style={{ padding: '12px 16px', color: 'var(--text2)', fontWeight: 600 }}>{t('academic.trend')}</th>
              </tr>
            </thead>
            <tbody>
              {data.matieres.map((m) => {
                const style = CLASSIFICATION_STYLES[m.classification] || CLASSIFICATION_STYLES.ACQUIS
                return (
                  <tr key={m.subjectId} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>{m.subjectName}</td>
                    <td style={{ padding: '12px 12px', color: 'var(--text2)' }}>{m.coefficient}</td>
                    {m.moyennesParPeriode.map((avg, i) => (
                      <td key={i} style={{ padding: '12px 12px', color: avg !== null ? 'var(--text)' : 'var(--text2)' }}>
                        {avg !== null ? avg.toFixed(2) : '—'}
                      </td>
                    ))}
                    <td style={{ padding: '12px 12px', fontWeight: 700, color: 'var(--text)' }}>
                      {m.moyenneAnnuelle.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: style.bg,
                        color: style.color,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                      }}>
                        {t(style.labelKey)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {m.tendance === 'HAUSSE' && (
                        <span style={{ color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <TrendingUp size={14} /> {t('academic.trend_up')}
                        </span>
                      )}
                      {m.tendance === 'BAISSE' && (
                        <span style={{ color: 'var(--red)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <TrendingDown size={14} /> {t('academic.trend_down')}
                        </span>
                      )}
                      {m.tendance === 'STABLE' && (
                        <span style={{ color: 'var(--text2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Minus size={14} /> {t('academic.trend_stable')}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
