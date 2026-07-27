'use client'
import { useState, useEffect } from 'react'
import { Compass } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

type SuggestedTrack = { track: string; score: number; justification: string }
interface Recommandation {
  status: string; suggestedTracks: SuggestedTrack[] | null
  finalTrack: string | null; studentChosenTrack: string | null
}
interface Child { studentId: string; prenom: string; nom: string }

const CHECKPOINTS = ['FIN_TROISIEME', 'FIN_SECONDE_C'] as const

const STATUS_LABEL_KEY: Record<string, string> = {
  CALCULEE: 'orientationCheckpoint.status_calculee',
  VALIDEE_CONSEILLER: 'orientationCheckpoint.status_validee_conseiller',
  PROPOSEE_A_L_ELEVE: 'orientationCheckpoint.status_proposee_eleve',
  VALIDEE_ELEVE: 'orientationCheckpoint.status_validee_eleve',
  VALIDEE_PAR_DEFAUT: 'orientationCheckpoint.status_validee_par_defaut',
}

// Miroir lecture seule de l'écran élève (A.6 point 5) — le parent voit où en est le processus
// d'orientation de chaque enfant, mais ne peut jamais choisir à sa place.
export default function OrientationCheckpointParentView({ children }: { children: Child[] }) {
  const t = useT('parent')
  const [entries, setEntries] = useState<Array<{ child: Child; checkpointType: string; reco: Recommandation }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (children.length === 0) { setLoading(false); return }
    (async () => {
      const found: Array<{ child: Child; checkpointType: string; reco: Recommandation }> = []
      for (const child of children) {
        for (const cp of CHECKPOINTS) {
          try {
            const res = await fetchApi(`/api/v2/orientation/ma-recommandation/${cp}?studentId=${child.studentId}`, { credentials: 'include' })
            const json = await res.json()
            if (json.success && json.data) found.push({ child, checkpointType: cp, reco: json.data })
          } catch { /* silencieux */ }
        }
      }
      setEntries(found)
      setLoading(false)
    })()
  }, [children])

  if (loading || entries.length === 0) return null

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Compass size={18} strokeWidth={2} /> {t('orientationCheckpoint.section_title')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {entries.map(({ child, checkpointType, reco }) => (
          <div key={`${child.studentId}-${checkpointType}`} style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{child.prenom} {child.nom}</span>
              <span style={{ background: 'var(--bg2)', color: 'var(--text2)', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                {t(`orientationCheckpoint.${checkpointType === 'FIN_TROISIEME' ? 'checkpoint_3e' : 'checkpoint_2ndeC'}`)}
              </span>
            </div>
            {reco.finalTrack ? (
              <div style={{ fontSize: 14, color: 'var(--green)', fontWeight: 700 }}>
                {t('orientationCheckpoint.parent_final_track')} <strong>{reco.finalTrack}</strong>
              </div>
            ) : (
              <div style={{ fontSize: 14, color: 'var(--text3)' }}>
                {t('orientationCheckpoint.parent_status_prefix')} {STATUS_LABEL_KEY[reco.status] ? t(STATUS_LABEL_KEY[reco.status]!) : reco.status}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
