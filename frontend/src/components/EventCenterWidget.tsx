'use client'
import { useState, useEffect, useCallback } from 'react'
import { CalendarClock, ChevronRight, X } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface ActiveEvent {
  id: string
  title: string
  status: 'UPCOMING' | 'ACTIVE' | 'CLOSED'
  openDate: string | null
  closeDate: string | null
}

interface Props {
  /** Omis pour les rôles sans écran de gestion des événements (tous sauf Admin) — le bouton
   * « Voir » n'est alors pas affiché, seul le rappel informatif + fermeture reste possible. */
  onNav?: (section: string) => void
}

/**
 * Bandeau partagé entre tous les dashboards (Admin, Staff, Enseignant, Parent, Élève) — discret,
 * jamais un pan entier de menu qui apparaît/disparaît (voir
 * Plan_Evenements_Calendrier_ZekoulABia.md section 5). L'API `/api/v2/academic-events/active`
 * filtre déjà côté serveur par le rôle de l'appelant, ce composant n'a donc rien à filtrer
 * lui-même.
 */
export default function EventCenterWidget({ onNav }: Props) {
  const t = useT('common')
  const [events, setEvents] = useState<ActiveEvent[]>([])
  const [dismissed, setDismissed] = useState<string[]>([])

  const fetchActive = useCallback(async () => {
    try {
      const res = await fetchApi('/api/v2/academic-events/active', { credentials: 'include' })
      const data = await res.json()
      if (data.success) setEvents(data.data || [])
    } catch { /* silencieux — widget non critique */ }
  }, [])

  useEffect(() => { fetchActive() }, [fetchActive])

  const visibles = events.filter(e => !dismissed.includes(e.id))
  if (visibles.length === 0) return null

  const daysUntil = (d: string | null) => {
    if (!d) return null
    return Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  }

  return (
    <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', padding: '10px 32px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
      {visibles.map(ev => {
        const jours = ev.status === 'UPCOMING' ? daysUntil(ev.openDate) : daysUntil(ev.closeDate)
        const label = ev.status === 'UPCOMING'
          ? t('academicEvents.widgetOpensIn', { title: ev.title, days: String(jours ?? 0) })
          : t('academicEvents.widgetOpenUntil', { title: ev.title, date: ev.closeDate ? new Date(ev.closeDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—' })
        return (
          <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 700, color: 'var(--text2)' }}>
            <CalendarClock size={15} color="var(--amber)" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{label}</span>
            {onNav && (
              <button onClick={() => onNav('academic-events')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 2, fontFamily: 'inherit' }}>
                {t('academicEvents.widgetSeeMore')} <ChevronRight size={13} />
              </button>
            )}
            <button onClick={() => setDismissed(d => [...d, ev.id])}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}>
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
