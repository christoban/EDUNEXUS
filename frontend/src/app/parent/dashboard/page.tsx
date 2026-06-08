'use client'

import { useState, useCallback, useEffect } from 'react'
import { Bell, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

type ParentSection = 'children' | 'grades' | 'attendance' | 'payments' | 'timetable' | 'settings'

interface Toast {
  id: number
  msg: string
  type: 'success' | 'error' | 'info' | 'warning'
}

let toastId = 0

// ── Données démo ──
const CHILDREN = [
  {
    id: 1, firstName: 'Jean', lastName: 'Ngono',
    classe: '6e A',
    tauxPresence: 97, tauxPonctualite: 94, joursAbsent: 1,
    derniereeMoyenne: 14.2, derniereeMention: 'Bien',
    indiceSante: 82,
  },
  {
    id: 2, firstName: 'Marie', lastName: 'Ngono',
    classe: '3e A',
    tauxPresence: 91, tauxPonctualite: 88, joursAbsent: 3,
    derniereeMoyenne: 11.5, derniereeMention: 'Assez Bien',
    indiceSante: 65,
  },
]

const BULLETINS = [
  { student: 'Jean Ngono',  periode: 'Trimestre 1', avg: 14.2, rang: '3e / 45',  mention: 'Bien',       mBg: '#d1fae5', mC: '#065f46' },
  { student: 'Jean Ngono',  periode: 'Trimestre 2', avg: 13.8, rang: '5e / 45',  mention: 'Bien',       mBg: '#d1fae5', mC: '#065f46' },
  { student: 'Marie Ngono', periode: 'Trimestre 1', avg: 11.5, rang: '18e / 40', mention: 'Assez Bien', mBg: '#dbeafe', mC: '#1e40af' },
]

const PAYMENTS = [
  { student: 'Jean Ngono',  label: 'Frais de scolarité — Trimestre 2', amount: 75000, paid: 75000, status: 'Payé',   sB: '#d1fae5', sC: '#065f46', date: '15/02/2026' },
  { student: 'Marie Ngono', label: 'Frais de scolarité — Trimestre 2', amount: 75000, paid: 40000, status: 'Partiel', sB: '#fef3c7', sC: '#92400e', date: '20/02/2026' },
  { student: 'Jean Ngono',  label: 'APEE — Année 2025-2026',           amount: 15000, paid: 15000, status: 'Payé',   sB: '#d1fae5', sC: '#065f46', date: '10/10/2025' },
  { student: 'Marie Ngono', label: 'APEE — Année 2025-2026',           amount: 15000, paid: 0,     status: 'Impayé', sB: '#fee2e2', sC: '#991b1b', date: '—' },
]

const HEALTH_COLORS = (s: number): [string, string, string] =>
  s >= 86 ? ['#d1fae5', '#065f46', 'PROGRESSION']
  : s >= 71 ? ['#dbeafe', '#1e40af', 'STABLE']
  : s >= 51 ? ['#fef3c7', '#92400e', 'MOYEN']
  : s >= 31 ? ['#ffedd5', '#9a3412', 'ÉLEVÉ']
  : ['#fee2e2', '#991b1b', 'CRITIQUE']

const TITLES: Record<ParentSection, string> = {
  children:   'Mes enfants',
  grades:     'Bulletins & Notes',
  attendance: 'Présences',
  payments:   'Paiements Mobile Money',
  timetable:  'Emploi du temps',
  settings:   'Paramètres',
}

const NAV_GROUPS: { label?: string; items: { id: ParentSection; icon: string; label: string }[] }[] = [
  {
    items: [
      { id: 'children', icon: '👨‍👩‍👧', label: 'Mes enfants' },
    ]
  },
  {
    label: 'Académique',
    items: [
      { id: 'grades',     icon: '📄', label: 'Bulletins & Notes' },
      { id: 'attendance', icon: '✅', label: 'Présences' },
      { id: 'timetable',  icon: '📅', label: 'Emploi du temps' },
    ]
  },
  {
    label: 'Services',
    items: [
      { id: 'payments', icon: '📱', label: 'Paiements' },
      { id: 'settings', icon: '⚙️', label: 'Paramètres' },
    ]
  },
]

// ── Toast item ──
function ToastItem({ t, onRemove }: { t: Toast; onRemove: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onRemove, 3500)
    return () => clearTimeout(timer)
  }, [onRemove])
  const ICONS = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' }
  const STYLES: Record<string, React.CSSProperties> = {
    success: { background: '#f0fdf4', border: '1.5px solid rgba(5,150,105,0.3)',  color: '#065f46' },
    error:   { background: '#fef2f2', border: '1.5px solid rgba(220,38,38,0.3)',  color: '#991b1b' },
    info:    { background: '#eff6ff', border: '1.5px solid rgba(29,78,216,0.2)',  color: '#1e40af' },
    warning: { background: '#fef3c7', border: '1.5px solid rgba(217,119,6,0.3)', color: '#92400e' },
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', minWidth: 260, maxWidth: 380, fontSize: 13, fontWeight: 700, animation: 'slideInRight 0.25s ease', ...STYLES[t.type] }}>
      <span style={{ fontSize: 16 }}>{ICONS[t.type]}</span>
      <span>{t.msg}</span>
    </div>
  )
}

// ── Badge santé ──
function HealthBadge({ score }: { score: number }) {
  const [bg, color, label] = HEALTH_COLORS(score)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 46, height: 46, borderRadius: '50%', background: bg, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 900, color, flexShrink: 0 }}>
        {score}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color }}>{label}</div>
        <div style={{ fontSize: 12, color: '#a89478', marginTop: 1 }}>Indice santé</div>
      </div>
    </div>
  )
}

export default function ParentDashboard() {
  const [section, setSection] = useState<ParentSection>('children')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [selectedChild, setSelectedChild] = useState(0)

  const showToast = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, msg, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f7f3ee', fontFamily: 'var(--font-nunito),Nunito,sans-serif' }}>

      {/* ── SIDEBAR ── */}
      <aside className="w-[320px] min-w-[320px] bg-[#1a2e1e] flex flex-col h-screen flex-shrink-0 relative overflow-hidden">
        {/* Bande déco */}
        <div className="absolute top-0 left-0 right-0 h-[5px] z-10"
          style={{ background: 'repeating-linear-gradient(90deg,#f59e0b 0,#f59e0b 13px,#22c55e 13px,#22c55e 25px,#ef4444 25px,#ef4444 37px,#60a5fa 37px,#60a5fa 49px)' }} />

        {/* Brand */}
        <div className="flex items-center gap-[13px] border-b border-white/[0.07]" style={{ padding: '25px 25px' }}>
          <div className="w-13 h-13 rounded-[14px] bg-gradient-to-br from-[#f59e0b] to-[#22c55e] flex items-center justify-center text-[26px] flex-shrink-0">🎓</div>
          <div>
            <div className="font-spectral text-[25px] font-bold text-white leading-tight">EduNexus</div>
            <div className="text-[14px] text-white/35 font-semibold">Portail Parent</div>
          </div>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden" style={{ padding: '25px 25px' }}>
          {/* École pill */}
          <div className="bg-white/[0.06] border border-white/10 rounded-[10px] mb-[25px]" style={{ padding: '20px 23px' }}>
            <div className="flex items-center gap-[8px]">
              <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-[#059669] to-[#1d4ed8] flex items-center justify-center text-[15px] font-black text-white flex-shrink-0">LS</div>
              <div className="min-w-0">
                <div className="text-[16px] font-bold text-white truncate">Lycée du Succès</div>
                <div className="text-[13px] text-white/35">2025–2026 · Francophone</div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-[10px] py-1">
            {NAV_GROUPS.map((group, gi) => (
              <div key={gi}>
                {group.label && (
                  <div className="text-[14px] font-black text-white/30 tracking-[1.2px] uppercase" style={{ padding: '11px 0 0 0' }}>
                    {group.label}
                  </div>
                )}
                {group.items.map(item => (
                  <button key={item.id} onClick={() => setSection(item.id)}
                    className={cn(
                      'w-full flex items-center gap-[20px] rounded-lg mb-[1px]',
                      'text-[16px] font-semibold transition-all duration-[120ms] text-left border-none cursor-pointer font-nunito',
                      section === item.id
                        ? 'bg-[#3a6b44] text-white'
                        : 'bg-transparent text-white/52 hover:bg-[#243b29] hover:text-white/82'
                    )}
                    style={{ padding: '6px 9px' }}>
                    <span className="text-[23px] w-[18px] text-center flex-shrink-0">{item.icon}</span>
                    <span className="truncate flex-1">{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </div>

        {/* User */}
        <div className="border-t border-white/[0.07]" style={{ padding: '20px 25px' }}>
          <div className="flex items-center gap-[12px] rounded-[10px] hover:bg-white/[0.06] cursor-pointer" style={{ padding: '12px 14px' }}>
            <div className="w-11 h-11 rounded-[11px] bg-gradient-to-br from-[#d97706] to-[#ea580c] flex items-center justify-center text-white font-black text-[16px] flex-shrink-0">PN</div>
            <div className="min-w-0">
              <div className="text-[17px] font-bold text-white truncate">Paul Ngono</div>
              <div className="text-[14px] text-white/35">Parent · 2 enfants</div>
            </div>
            <button className="ml-auto" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Topbar */}
        <header style={{ height: 68, background: 'white', borderBottom: '1.5px solid #e8e0d4', display: 'flex', alignItems: 'center', padding: '0 32px', gap: 14, flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209' }}>
            {TITLES[section]}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: '#f0ebe3', border: '1.5px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
              <Bell size={18} color="#6b5c45" />
              <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, background: '#dc2626', borderRadius: '50%', border: '2px solid white' }} />
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflow: 'hidden', background: '#f7f3ee' }}>

          {/* ── MES ENFANTS ── */}
          {section === 'children' && (
            <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
              <div style={{ marginBottom: 26 }}>
                <div style={sTitle}>Mes enfants</div>
                <div style={sSub}>Suivi scolaire en temps réel · 2 enfants inscrits</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }}>
                {CHILDREN.map((child, i) => {
                  const avg = child.derniereeMoyenne
                  const avgColor = avg >= 14 ? '#059669' : avg >= 10 ? '#1d4ed8' : '#dc2626'
                  return (
                    <div key={i}
                      style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden', transition: 'all 0.15s' }}
                      onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)' })}
                      onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}>

                      {/* Header enfant */}
                      <div style={{ padding: '22px 26px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg,${i === 0 ? '#1d4ed8,#7c3aed' : '#059669,#0d9488'})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 18, flexShrink: 0 }}>
                          {child.firstName[0]}{child.lastName[0]}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1209', fontFamily: 'var(--font-spectral),Spectral,serif' }}>{child.firstName} {child.lastName}</div>
                          <div style={{ fontSize: 15, color: '#a89478', marginTop: 3 }}>Élève · {child.classe}</div>
                        </div>
                        <HealthBadge score={child.indiceSante} />
                      </div>

                      {/* Stats */}
                      <div style={{ padding: '18px 26px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
                          {[
                            { label: 'Dernière moyenne', val: `${avg}/20`, color: avgColor },
                            { label: 'Taux présence',    val: `${child.tauxPresence}%`,    color: child.tauxPresence >= 90    ? '#059669' : '#d97706' },
                            { label: 'Ponctualité',      val: `${child.tauxPonctualite}%`, color: child.tauxPonctualite >= 90 ? '#059669' : '#d97706' },
                          ].map((stat, j) => (
                            <div key={j} style={{ background: '#f0ebe3', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
                              <div style={{ fontSize: 24, fontWeight: 900, color: stat.color }}>{stat.val}</div>
                              <div style={{ fontSize: 13, color: '#a89478', fontWeight: 700, marginTop: 4 }}>{stat.label}</div>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                          <span style={{ fontSize: 16, color: '#6b5c45', fontWeight: 600 }}>
                            🏆 Mention : <strong style={{ color: '#1a1209' }}>{child.derniereeMention}</strong>
                          </span>
                          <span style={{ fontSize: 15, color: '#a89478' }}>
                            {child.joursAbsent} jour{child.joursAbsent > 1 ? 's' : ''} d&apos;absence
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                          {[
                            { label: '📄 Bulletins',  action: () => setSection('grades'),     prim: true  },
                            { label: '✅ Présences',  action: () => setSection('attendance'),  prim: false },
                            { label: '📱 Paiements',  action: () => setSection('payments'),   prim: false },
                          ].map((btn, j) => (
                            <button key={j} onClick={btn.action}
                              style={{ flex: 1, padding: '9px 14px', borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', border: btn.prim ? 'none' : '1.5px solid #d4c8b8', background: btn.prim ? 'linear-gradient(135deg,#059669,#047857)' : 'white', color: btn.prim ? 'white' : '#6b5c45', transition: 'all 0.12s' }}
                              onMouseEnter={e => { if (!btn.prim) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#059669', color: '#059669' }) }}
                              onMouseLeave={e => { if (!btn.prim) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#d4c8b8', color: '#6b5c45' }) }}>
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── BULLETINS & NOTES ── */}
          {section === 'grades' && (
            <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
              <div style={{ marginBottom: 26 }}>
                <div style={sTitle}>Bulletins & Notes</div>
                <div style={sSub}>Résultats scolaires de vos enfants</div>
              </div>

              {/* Sélecteur enfant */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                {CHILDREN.map((c, i) => (
                  <button key={i} onClick={() => setSelectedChild(i)}
                    style={{ padding: '8px 18px', borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid', transition: 'all 0.12s', background: selectedChild === i ? '#d1fae5' : 'white', borderColor: selectedChild === i ? '#059669' : '#d4c8b8', color: selectedChild === i ? '#065f46' : '#6b5c45' }}>
                    {c.firstName} {c.lastName}
                  </button>
                ))}
              </div>

              <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Période', 'Moyenne générale', 'Rang', 'Mention', 'Actions'].map(h => (
                      <th key={h} style={thSt}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {BULLETINS
                      .filter(b => b.student === `${CHILDREN[selectedChild].firstName} ${CHILDREN[selectedChild].lastName}`)
                      .map((b, i) => (
                        <tr key={i}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                          <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>{b.periode}</td>
                          <td style={{ ...tdSt, fontWeight: 900, fontSize: 20, color: b.avg >= 14 ? '#059669' : b.avg >= 10 ? '#1d4ed8' : '#dc2626' }}>{b.avg}/20</td>
                          <td style={tdSt}>{b.rang}</td>
                          <td style={tdSt}>
                            <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: b.mBg, color: b.mC }}>{b.mention}</span>
                          </td>
                          <td style={tdSt}>
                            <button
                              style={{ padding: '7px 14px', borderRadius: 9, fontSize: 15, fontWeight: 800, background: 'white', color: '#059669', border: '1.5px solid #059669', cursor: 'pointer', fontFamily: 'inherit' }}
                              onClick={() => showToast(`Téléchargement du bulletin ${b.periode}`, 'success')}>
                              📥 PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── PRÉSENCES ── */}
          {section === 'attendance' && (
            <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
              <div style={{ marginBottom: 26 }}>
                <div style={sTitle}>Présences</div>
                <div style={sSub}>Suivi de l&apos;assiduité de vos enfants</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }}>
                {CHILDREN.map((child, i) => (
                  <div key={i} style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>👤 {child.firstName} {child.lastName}</span>
                      <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: '#dbeafe', color: '#1e40af' }}>{child.classe}</span>
                    </div>
                    <div style={{ padding: '18px 22px' }}>
                      {[
                        { label: 'Taux de présence', val: child.tauxPresence, color: child.tauxPresence >= 90 ? '#059669' : '#d97706' },
                        { label: 'Ponctualité',      val: child.tauxPonctualite, color: child.tauxPonctualite >= 90 ? '#059669' : '#d97706' },
                      ].map((stat, j) => (
                        <div key={j} style={{ marginBottom: j === 0 ? 16 : 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: '#6b5c45', marginBottom: 7 }}>
                            <span>{stat.label}</span>
                            <span style={{ color: stat.color, fontWeight: 900 }}>{stat.val}%</span>
                          </div>
                          <div style={{ height: 8, background: '#e8e0d4', borderRadius: 8, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${stat.val}%`, background: stat.color, borderRadius: 8, transition: 'width 1s' }} />
                          </div>
                        </div>
                      ))}

                      <div style={{ display: 'flex', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid #e8e0d4' }}>
                        {[
                          { label: 'Jours absents', val: child.joursAbsent, bg: '#fee2e2', c: '#991b1b' },
                          { label: 'Ce mois',       val: '30 jours',        bg: '#f0ebe3', c: '#6b5c45' },
                        ].map((s, j) => (
                          <div key={j} style={{ flex: 1, background: s.bg, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                            <div style={{ fontSize: 22, fontWeight: 900, color: s.c }}>{s.val}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: s.c, opacity: 0.8, marginTop: 3 }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── PAIEMENTS ── */}
          {section === 'payments' && (
            <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
                <div>
                  <div style={sTitle}>Paiements Mobile Money</div>
                  <div style={sSub}>Frais scolaires · MTN MoMo &amp; Orange Money</div>
                </div>
                <button style={btnPrim} onClick={() => showToast('Initier un paiement Mobile Money...', 'info')}>
                  📱 Payer maintenant
                </button>
              </div>

              {/* Alerte impayé */}
              <div style={{ background: '#fef3c7', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 14, padding: '16px 22px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 22 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#92400e' }}>1 paiement en attente</div>
                  <div style={{ fontSize: 15, color: '#d97706', marginTop: 3 }}>Marie Ngono — APEE 2025-2026 · 15 000 XAF</div>
                </div>
                <button
                  style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 9, fontSize: 15, fontWeight: 800, background: '#d97706', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                  onClick={() => showToast('Paiement Orange Money initié...', 'info')}>
                  Payer →
                </button>
              </div>

              <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Élève', 'Libellé', 'Montant', 'Payé', 'Statut', 'Date'].map(h => (
                      <th key={h} style={thSt}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {PAYMENTS.map((p, i) => (
                      <tr key={i}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                        <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>{p.student}</td>
                        <td style={tdSt}>{p.label}</td>
                        <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>{p.amount.toLocaleString()} XAF</td>
                        <td style={{ ...tdSt, fontWeight: 700, color: p.paid >= p.amount ? '#059669' : p.paid > 0 ? '#d97706' : '#dc2626' }}>
                          {p.paid.toLocaleString()} XAF
                        </td>
                        <td style={tdSt}>
                          <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: p.sB, color: p.sC }}>{p.status}</span>
                        </td>
                        <td style={tdSt}>{p.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── PLACEHOLDERS ── */}
          {(section === 'timetable' || section === 'settings') && (
            <div style={{ padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: 52, textAlign: 'center', maxWidth: 520 }}>
                <div style={{ fontSize: 60, marginBottom: 20 }}>{section === 'timetable' ? '📅' : '⚙️'}</div>
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 26, fontWeight: 700, color: '#1a1209', marginBottom: 12 }}>
                  {TITLES[section]}
                </div>
                <div style={{ fontSize: 17, color: '#a89478', fontWeight: 500, lineHeight: 1.7 }}>
                  Cette section est en cours de développement.<br />Revenez bientôt.
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Toasts */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', top: 74, right: 20, zIndex: 500, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {toasts.map(t => <ToastItem key={t.id} t={t} onRemove={() => removeToast(t.id)} />)}
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
