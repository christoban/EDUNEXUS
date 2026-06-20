'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchApi } from '@/lib/fetchApi'

const JOURS = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI']
const JOURS_LABELS: Record<string, string> = {
  LUNDI: 'Lun', MARDI: 'Mar', MERCREDI: 'Mer', JEUDI: 'Jeu', VENDREDI: 'Ven', SAMEDI: 'Sam',
}

interface PeriodeGrille {
  ordre: number
  debut: string
  fin: string
  type: 'COURS' | 'PETITE_PAUSE' | 'GRANDE_PAUSE'
  duree: number
}

interface GridForm {
  heureDebut: string
  dureePeriode: number
  periodesAvantP1: number
  dureePetitePause: number
  periodesAvantP2: number
  dureeGrandePause: number
  periodesApresP2: number
  joursActifs: string[]
}

const DEFAULT: GridForm = {
  heureDebut: '07:30',
  dureePeriode: 55,
  periodesAvantP1: 2,
  dureePetitePause: 15,
  periodesAvantP2: 3,
  dureeGrandePause: 30,
  periodesApresP2: 2,
  joursActifs: ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI'],
}

// Calcul du squelette côté client (identique à la logique backend)
function calculerSquelette(f: GridForm): PeriodeGrille[] {
  const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m ?? 0) }
  const toTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const result: PeriodeGrille[] = []
  let cursor = toMins(f.heureDebut)
  let ordre = 1

  const cours = (n: number) => {
    for (let i = 0; i < n; i++) {
      const d = toTime(cursor); cursor += f.dureePeriode
      result.push({ ordre: ordre++, debut: d, fin: toTime(cursor), type: 'COURS', duree: f.dureePeriode })
    }
  }

  cours(f.periodesAvantP1)
  if (f.dureePetitePause > 0 && f.periodesAvantP1 > 0) {
    const d = toTime(cursor); cursor += f.dureePetitePause
    result.push({ ordre: 0, debut: d, fin: toTime(cursor), type: 'PETITE_PAUSE', duree: f.dureePetitePause })
  }
  cours(f.periodesAvantP2)
  if (f.dureeGrandePause > 0 && f.periodesAvantP2 > 0) {
    const d = toTime(cursor); cursor += f.dureeGrandePause
    result.push({ ordre: 0, debut: d, fin: toTime(cursor), type: 'GRANDE_PAUSE', duree: f.dureeGrandePause })
  }
  cours(f.periodesApresP2)
  return result
}

const sScroll: React.CSSProperties = { height: '100%', overflowY: 'auto', padding: '32px 40px' }
const sCard: React.CSSProperties = { background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '28px 32px' }
const sLabel: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#6b5c45', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }
const sInput: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e8e0d4', fontSize: 15, color: '#1a1209', fontFamily: 'inherit', boxSizing: 'border-box' }
const sNum: React.CSSProperties = { ...sInput, width: 90 }

export default function SectionGrilleHoraire({ onToast }: { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [form, setForm] = useState<GridForm>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [existingTimetables, setExistingTimetables] = useState(0)
  const [isConfigured, setIsConfigured] = useState(false)

  // Charger la config existante
  useEffect(() => {
    fetchApi('/api/v2/timetable-grid-config', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          setForm({ ...d.data.config })
          setIsConfigured(true)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const squelette = useMemo(() => {
    try { return calculerSquelette(form) } catch { return [] }
  }, [form])

  const totalPeriodes = (form.periodesAvantP1 ?? 0) + (form.periodesAvantP2 ?? 0) + (form.periodesApresP2 ?? 0)

  const set = useCallback(<K extends keyof GridForm>(k: K, v: GridForm[K]) => {
    setForm(f => ({ ...f, [k]: v }))
  }, [])

  const toggleJour = (jour: string) => {
    setForm(f => ({
      ...f,
      joursActifs: f.joursActifs.includes(jour)
        ? f.joursActifs.filter(j => j !== jour)
        : [...f.joursActifs, jour],
    }))
  }

  const handleSave = async () => {
    if (totalPeriodes < 1) { onToast('Configurez au moins 1 période', 'error'); return }
    if (form.joursActifs.length === 0) { onToast('Sélectionnez au moins un jour', 'error'); return }
    setSaving(true)
    try {
      const res = await fetchApi('/api/v2/timetable-grid-config', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      setIsConfigured(true)
      setExistingTimetables(d.data.timetableCount ?? 0)
      onToast('Configuration enregistrée', 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ ...sScroll, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a89478' }}>Chargement…</div>
  }

  const derniereHeure = squelette.length > 0 ? squelette[squelette.length - 1].fin : '—'

  return (
    <div style={sScroll}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 26, fontWeight: 700, color: '#1a1209', marginBottom: 6 }}>
          Configuration grille horaire
        </div>
        <div style={{ fontSize: 15, color: '#a89478' }}>
          Définissez la structure de vos journées scolaires. Cette grille sera utilisée pour tous les emplois du temps.
        </div>
      </div>

      {/* Avertissement EDT existants */}
      {isConfigured && existingTimetables > 0 && (
        <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: '14px 20px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div style={{ fontSize: 14, color: '#92400e' }}>
            <strong>Attention :</strong> {existingTimetables} emploi{existingTimetables > 1 ? 's' : ''} du temps exist{existingTimetables > 1 ? 'ent' : 'e'} déjà.
            Modifier la grille affectera tous les emplois du temps existants.
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* ── Formulaire ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={sCard}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1209', marginBottom: 20 }}>⚙️ Paramètres</div>

            {/* Heure de début */}
            <div style={{ marginBottom: 16 }}>
              <div style={sLabel}>Heure de début</div>
              <input type="time" style={{ ...sInput, width: 140 }} value={form.heureDebut}
                onChange={e => set('heureDebut', e.target.value)} />
            </div>

            {/* Durée d'une période */}
            <div style={{ marginBottom: 16 }}>
              <div style={sLabel}>Durée d'une période (min)</div>
              <input type="number" style={sNum} min={30} max={120} value={form.dureePeriode}
                onChange={e => set('dureePeriode', Number(e.target.value))} />
            </div>

            <div style={{ height: 1, background: '#e8e0d4', margin: '16px 0' }} />

            {/* Bloc 1 */}
            <div style={{ fontSize: 14, fontWeight: 700, color: '#6b5c45', marginBottom: 12 }}>Bloc 1 → Petite pause</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={sLabel}>Périodes avant petite pause</div>
                <input type="number" style={sNum} min={0} max={6} value={form.periodesAvantP1}
                  onChange={e => set('periodesAvantP1', Number(e.target.value))} />
              </div>
              <div>
                <div style={sLabel}>Durée petite pause (min)</div>
                <input type="number" style={sNum} min={0} max={60} value={form.dureePetitePause}
                  onChange={e => set('dureePetitePause', Number(e.target.value))} />
              </div>
            </div>

            {/* Bloc 2 */}
            <div style={{ fontSize: 14, fontWeight: 700, color: '#6b5c45', marginBottom: 12 }}>Bloc 2 → Grande pause</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={sLabel}>Périodes avant grande pause</div>
                <input type="number" style={sNum} min={0} max={6} value={form.periodesAvantP2}
                  onChange={e => set('periodesAvantP2', Number(e.target.value))} />
              </div>
              <div>
                <div style={sLabel}>Durée grande pause (min)</div>
                <input type="number" style={sNum} min={0} max={90} value={form.dureeGrandePause}
                  onChange={e => set('dureeGrandePause', Number(e.target.value))} />
              </div>
            </div>

            {/* Bloc 3 */}
            <div style={{ fontSize: 14, fontWeight: 700, color: '#6b5c45', marginBottom: 12 }}>Bloc 3 → Fin de journée</div>
            <div style={{ marginBottom: 16 }}>
              <div style={sLabel}>Périodes après grande pause</div>
              <input type="number" style={sNum} min={0} max={6} value={form.periodesApresP2}
                onChange={e => set('periodesApresP2', Number(e.target.value))} />
            </div>

            <div style={{ height: 1, background: '#e8e0d4', margin: '16px 0' }} />

            {/* Jours actifs */}
            <div style={{ marginBottom: 20 }}>
              <div style={sLabel}>Jours actifs</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {JOURS.map(j => (
                  <button key={j} onClick={() => toggleJour(j)} style={{
                    padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1.5px solid',
                    background: form.joursActifs.includes(j) ? '#1a2e1e' : 'white',
                    color: form.joursActifs.includes(j) ? 'white' : '#6b5c45',
                    borderColor: form.joursActifs.includes(j) ? '#1a2e1e' : '#e8e0d4',
                  }}>
                    {JOURS_LABELS[j]}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI rapide */}
            <div style={{ background: '#f7f3ee', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#6b5c45' }}>
              <strong>{totalPeriodes}</strong> période{totalPeriodes > 1 ? 's' : ''} par jour
              {derniereHeure !== '—' && <> · Fin à <strong>{derniereHeure}</strong></>}
              {' · '}<strong>{form.joursActifs.length}</strong> jours/semaine
            </div>

            <button onClick={handleSave} disabled={saving || totalPeriodes < 1} style={{
              width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', cursor: saving ? 'wait' : 'pointer',
              background: saving ? '#a89478' : '#1a2e1e', color: 'white', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
            }}>
              {saving ? '⏳ Enregistrement…' : '💾 Enregistrer la configuration'}
            </button>
          </div>
        </div>

        {/* ── Aperçu squelette ── */}
        <div style={sCard}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1209', marginBottom: 20 }}>👁️ Aperçu de la grille</div>
          {squelette.length === 0 ? (
            <div style={{ color: '#a89478', textAlign: 'center', padding: '40px 0' }}>
              Configurez au moins une période pour voir l'aperçu.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e8e0d4' }}>
                  <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#6b5c45', textTransform: 'uppercase', width: 60 }}>N°</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#6b5c45', textTransform: 'uppercase' }}>Début</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#6b5c45', textTransform: 'uppercase' }}>Fin</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#6b5c45', textTransform: 'uppercase', width: 70 }}>Durée</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#6b5c45', textTransform: 'uppercase' }}>Type</th>
                </tr>
              </thead>
              <tbody>
                {squelette.map((p, i) => {
                  const isPause = p.type !== 'COURS'
                  const bg = p.type === 'GRANDE_PAUSE' ? '#fef3c7' : p.type === 'PETITE_PAUSE' ? '#f0fdf4' : 'white'
                  const label = p.type === 'COURS' ? `Période ${p.ordre}` : p.type === 'PETITE_PAUSE' ? '☕ Petite pause' : '🍽️ Grande pause'
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f0ebe3', background: bg }}>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 15, fontWeight: 800, color: isPause ? '#a89478' : '#1a1209' }}>
                        {isPause ? '—' : p.ordre}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 15, fontWeight: 600, color: '#1a1209', fontVariantNumeric: 'tabular-nums' }}>{p.debut}</td>
                      <td style={{ padding: '10px 12px', fontSize: 15, fontWeight: 600, color: '#1a1209', fontVariantNumeric: 'tabular-nums' }}>{p.fin}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 14, color: '#6b5c45', fontWeight: 600 }}>{p.duree} min</td>
                      <td style={{ padding: '10px 12px', fontSize: 14, color: isPause ? '#059669' : '#6b5c45' }}>{label}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
