'use client'

import { useState, useCallback, useEffect } from 'react'
import { Bell, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

type StaffSection =
  | 'dashboard' | 'council' | 'grades' | 'timetable'
  | 'attendance' | 'finance' | 'cautions' | 'discipline'

interface Toast { id: number; msg: string; type: 'success' | 'error' | 'info' | 'warning' }
let toastId = 0

// ── Données démo ──
const KPI = [
  { icon: '🎓', bg: '#d1fae5', val: '6',  label: 'Classes supervisées',  trend: '2025-2026',     tBg: '#d1fae5', tC: '#065f46' },
  { icon: '📝', bg: '#fef3c7', val: '4',  label: 'Notes à valider',      trend: '⚠️ Urgent',     tBg: '#fef3c7', tC: '#92400e', nav: 'grades' as StaffSection },
  { icon: '📱', bg: '#dbeafe', val: '89', label: 'Paiements en attente', trend: 'Mobile Money',   tBg: '#dbeafe', tC: '#1e40af', nav: 'finance' as StaffSection },
  { icon: '🎓', bg: '#ede9fe', val: '2',  label: 'Conseils à tenir',     trend: 'Cette semaine', tBg: '#ede9fe', tC: '#5b21b6', nav: 'council' as StaffSection },
]

const PENDING_GRADES = [
  { classe: '6e A', matiere: 'Mathématiques', teacher: 'M. Dupont',   count: 45, submitted: '26/05', status: 'À valider' },
  { classe: '5e B', matiere: 'Français',      teacher: 'Mme Essomba', count: 42, submitted: '27/05', status: 'À valider' },
  { classe: '4e C', matiere: 'SVT',           teacher: 'M. Ateba',    count: 38, submitted: '28/05', status: 'Rejeté'    },
  { classe: '3e A', matiere: 'Histoire-Géo',  teacher: 'M. Kamga',    count: 40, submitted: '29/05', status: 'À valider' },
]

const COUNCILS = [
  { classe: '6e A', date: '30/05/2026', heure: '14h00', salle: 'Salle des profs', status: 'À venir',  pp: 'M. Dupont',   eleves: 45 },
  { classe: '3e A', date: '31/05/2026', heure: '15h00', salle: 'Salle des profs', status: 'À venir',  pp: 'Mme Kamga',   eleves: 40 },
  { classe: '5e B', date: '28/05/2026', heure: '16h00', salle: 'Salle des profs', status: 'Terminé',  pp: 'Mme Essomba', eleves: 42 },
]

const COUNCIL_DECISIONS = [
  { name: 'Marie Ngono',   avg: 14.2, absences: 1,  decision: 'PASS',          obs: '' },
  { name: 'Jean Kamga',    avg: 12.1, absences: 3,  decision: 'PASS',          obs: '' },
  { name: 'Paul Biya',     avg: 7.5,  absences: 12, decision: 'REPEAT',        obs: "Trop d'absences" },
  { name: 'Aminata Fouda', avg: 16.5, absences: 0,  decision: 'PASS',          obs: 'Félicitations' },
  { name: 'Sophie Ateba',  avg: 9.8,  absences: 5,  decision: 'DELIBERATION',  obs: '' },
]

const PAYMENTS = [
  { name: 'Marie Ngono',   classe: '6e A', label: 'Frais T2', amount: 75000, status: 'Impayé',  sB: '#fee2e2', sC: '#991b1b' },
  { name: 'Paul Biya',     classe: '4e C', label: 'Frais T2', amount: 75000, status: 'Partiel', sB: '#fef3c7', sC: '#92400e' },
  { name: 'Aminata Fouda', classe: '6e A', label: 'APEE',     amount: 15000, status: 'Impayé',  sB: '#fee2e2', sC: '#991b1b' },
]

const CAUTIONS = [
  { name: 'Jean Mballa',  montant: 25000, date: '15/09/2025', status: 'HELD',     sB: '#fef3c7', sC: '#92400e' },
  { name: 'Sophie Ateba', montant: 25000, date: '15/09/2025', status: 'HELD',     sB: '#fef3c7', sC: '#92400e' },
  { name: 'Paul Nkomo',   montant: 25000, date: '01/10/2025', status: 'REFUNDED', sB: '#d1fae5', sC: '#065f46' },
]

const DISCIPLINE = [
  { name: 'Paul Biya',   classe: '4e C', type: 'Avertissement', date: '22/05/2026', motif: 'Comportement perturbateur' },
  { name: 'Jean Kamga',  classe: '5e B', type: 'Blâme',         date: '18/05/2026', motif: 'Retards répétés' },
  { name: 'Marie Ateba', classe: '6e A', type: 'Avertissement', date: '10/05/2026', motif: 'Absence injustifiée' },
]

const TITLES: Record<StaffSection, string> = {
  dashboard:  'Tableau de bord',
  council:    'Conseil de classe',
  grades:     'Validation des notes',
  timetable:  'Emploi du temps',
  attendance: 'Présences',
  finance:    'Mobile Money',
  cautions:   'Cautions',
  discipline: 'Discipline',
}

const NAV_GROUPS: { label?: string; items: { id: StaffSection; icon: string; label: string; badge?: string; badgeColor?: 'red' | 'amber' | 'green' }[] }[] = [
  {
    items: [
      { id: 'dashboard', icon: '⊞', label: 'Tableau de bord' },
    ]
  },
  {
    label: 'Supervision',
    items: [
      { id: 'council',    icon: '🎓', label: 'Conseil de classe', badge: '2',  badgeColor: 'amber' },
      { id: 'grades',     icon: '📝', label: 'Validation notes',  badge: '4',  badgeColor: 'red'   },
      { id: 'attendance', icon: '✅', label: 'Présences' },
      { id: 'timetable',  icon: '📅', label: 'Emploi du temps' },
    ]
  },
  {
    label: 'Services',
    items: [
      { id: 'finance',    icon: '📱', label: 'Mobile Money',  badge: '89', badgeColor: 'red'   },
      { id: 'cautions',   icon: '🔒', label: 'Cautions' },
      { id: 'discipline', icon: '⚠️', label: 'Discipline' },
    ]
  },
]

const BADGE_STYLES = {
  red:   'bg-red-500/25 text-red-300',
  green: 'bg-green-500/20 text-green-300',
  amber: 'bg-amber-500/20 text-amber-300',
}

// ── Toast ──
function ToastItem({ t, onRemove }: { t: Toast; onRemove: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onRemove, 3500)
    return () => clearTimeout(timer)
  }, [onRemove])
  const ICONS = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' }
  const ST: Record<string, React.CSSProperties> = {
    success: { background: '#f0fdf4', border: '1.5px solid rgba(5,150,105,0.3)',  color: '#065f46' },
    error:   { background: '#fef2f2', border: '1.5px solid rgba(220,38,38,0.3)',  color: '#991b1b' },
    info:    { background: '#eff6ff', border: '1.5px solid rgba(29,78,216,0.2)',  color: '#1e40af' },
    warning: { background: '#fef3c7', border: '1.5px solid rgba(217,119,6,0.3)', color: '#92400e' },
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', minWidth: 260, maxWidth: 380, fontSize: 13, fontWeight: 700, animation: 'slideInRight 0.25s ease', ...ST[t.type] }}>
      <span style={{ fontSize: 16 }}>{ICONS[t.type]}</span><span>{t.msg}</span>
    </div>
  )
}

export default function StaffDashboard() {
  const [section, setSection] = useState<StaffSection>('dashboard')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [decisions, setDecisions] = useState<Record<number, string>>(
    Object.fromEntries(COUNCIL_DECISIONS.map((d, i) => [i, d.decision]))
  )

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
            <div className="text-[14px] text-white/35 font-semibold">Espace Censeur / Staff</div>
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
                    {item.badge && (
                      <span className={cn('ml-auto text-[13px] font-black rounded-lg', BADGE_STYLES[item.badgeColor ?? 'red'])} style={{ padding: '3px 6px' }}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </div>

        {/* User */}
        <div className="border-t border-white/[0.07]" style={{ padding: '20px 25px' }}>
          <div className="flex items-center gap-[12px] rounded-[10px] hover:bg-white/[0.06] cursor-pointer" style={{ padding: '12px 14px' }}>
            <div className="w-11 h-11 rounded-[11px] bg-gradient-to-br from-[#0d9488] to-[#059669] flex items-center justify-center text-white font-black text-[16px] flex-shrink-0">PC</div>
            <div className="min-w-0">
              <div className="text-[17px] font-bold text-white truncate">Pierre Censeur</div>
              <div className="text-[14px] text-white/35">Censeur · Staff</div>
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
          <span style={{ background: '#f0ebe3', border: '1px solid #e8e0d4', borderRadius: 20, padding: '4px 14px', fontSize: 15, fontWeight: 700, color: '#a89478' }}>
            Trimestre 2 · Séquence 3
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: '#f0ebe3', border: '1.5px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
              <Bell size={18} color="#6b5c45" />
              <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, background: '#dc2626', borderRadius: '50%', border: '2px solid white' }} />
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflow: 'hidden', background: '#f7f3ee' }}>

          {/* ── TABLEAU DE BORD ── */}
          {section === 'dashboard' && (
            <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
                <div>
                  <div style={sTitle}>Bonjour, Pierre 👋</div>
                  <div style={sSub}>Vendredi 29 Mai 2026 · Censeur</div>
                </div>
              </div>

              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 22 }}>
                {KPI.map((k, i) => (
                  <div key={i}
                    onClick={() => k.nav && setSection(k.nav)}
                    style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '22px 26px', cursor: k.nav ? 'pointer' : 'default', transition: 'all 0.15s' }}
                    onMouseEnter={e => k.nav && Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)' })}
                    onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{k.icon}</div>
                      <span style={{ fontSize: 14, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: k.tBg, color: k.tC, whiteSpace: 'nowrap' }}>{k.trend}</span>
                    </div>
                    <div style={{ fontSize: 36, fontWeight: 900, color: '#1a1209', lineHeight: 1 }}>{k.val}</div>
                    <div style={{ fontSize: 16, color: '#a89478', marginTop: 5, fontWeight: 600 }}>{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Alertes urgentes */}
              <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
                <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4' }}>
                  <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>🚨 Actions urgentes</span>
                </div>
                <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { icon: '📝', bg: '#fef3c7', color: '#92400e', border: 'rgba(217,119,6,0.2)',  text: '4 lots de notes en attente de validation', action: () => setSection('grades'),  btn: 'Valider →' },
                    { icon: '🎓', bg: '#ede9fe', color: '#5b21b6', border: 'rgba(91,33,182,0.2)',   text: '2 conseils de classe cette semaine',        action: () => setSection('council'), btn: 'Voir →' },
                    { icon: '📱', bg: '#fee2e2', color: '#991b1b', border: 'rgba(220,38,38,0.2)',   text: '89 paiements Mobile Money en attente',      action: () => setSection('finance'), btn: 'Traiter →' },
                  ].map((alert, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: alert.bg, borderRadius: 12, border: `1px solid ${alert.border}` }}>
                      <span style={{ fontSize: 22 }}>{alert.icon}</span>
                      <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: alert.color }}>{alert.text}</span>
                      <button onClick={alert.action}
                        style={{ padding: '7px 14px', borderRadius: 9, fontSize: 15, fontWeight: 800, background: 'white', color: alert.color, border: `1.5px solid ${alert.border}`, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {alert.btn}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── CONSEIL DE CLASSE ── */}
          {section === 'council' && (
            <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
                <div>
                  <div style={sTitle}>Conseil de classe</div>
                  <div style={sSub}>Délibérations et décisions — Trimestre 2</div>
                </div>
              </div>

              {/* Cartes conseils */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18, marginBottom: 22 }}>
                {COUNCILS.map((c, i) => (
                  <div key={i}
                    style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '20px 24px', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#d4c8b8', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' })}
                    onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#e8e0d4', boxShadow: 'none' })}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 26, fontWeight: 700, color: '#1a1209' }}>{c.classe}</div>
                      <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: c.status === 'Terminé' ? '#d1fae5' : '#dbeafe', color: c.status === 'Terminé' ? '#065f46' : '#1e40af' }}>{c.status}</span>
                    </div>
                    <div style={{ fontSize: 15, color: '#6b5c45', fontWeight: 600, marginBottom: 5 }}>📅 {c.date} à {c.heure}</div>
                    <div style={{ fontSize: 15, color: '#6b5c45', fontWeight: 600, marginBottom: 5 }}>📍 {c.salle}</div>
                    <div style={{ fontSize: 15, color: '#a89478', fontWeight: 600, marginBottom: 16 }}>👥 {c.eleves} élèves · PP : {c.pp}</div>
                    {c.status === 'À venir' && (
                      <button style={btnPrim} onClick={() => showToast(`Conseil ${c.classe} ouvert`, 'success')}>
                        🎓 Ouvrir le conseil
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Délibérations */}
              <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
                <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>🗳️ Délibérations — 6e A · Trimestre 2</span>
                  <button style={btnPrim} onClick={() => showToast('Conseil verrouillé avec succès', 'success')}>🔒 Verrouiller le conseil</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Élève', 'Moyenne', 'Absences', 'Décision', 'Observation'].map(h => (
                      <th key={h} style={thSt}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {COUNCIL_DECISIONS.map((d, i) => (
                      <tr key={i}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                        <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>{d.name}</td>
                        <td style={{ ...tdSt, fontWeight: 900, fontSize: 18, color: d.avg >= 14 ? '#059669' : d.avg >= 10 ? '#1d4ed8' : '#dc2626' }}>{d.avg}/20</td>
                        <td style={tdSt}>
                          <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: d.absences > 5 ? '#fee2e2' : '#f0ebe3', color: d.absences > 5 ? '#991b1b' : '#6b5c45' }}>
                            {d.absences}j
                          </span>
                        </td>
                        <td style={tdSt}>
                          <select
                            value={decisions[i]}
                            onChange={e => setDecisions(p => ({ ...p, [i]: e.target.value }))}
                            style={{ padding: '8px 12px', border: '1.5px solid #d4c8b8', borderRadius: 9, fontSize: 16, fontWeight: 700, fontFamily: 'inherit', outline: 'none', cursor: 'pointer', background: 'white', minWidth: 160, color: decisions[i] === 'PASS' ? '#059669' : decisions[i] === 'REPEAT' ? '#dc2626' : '#d97706' }}>
                            <option value="PASS">✅ Admis(e)</option>
                            <option value="REPEAT">↩️ Redoublant(e)</option>
                            <option value="DELIBERATION">⚖️ En délibération</option>
                          </select>
                        </td>
                        <td style={tdSt}>
                          <input type="text" defaultValue={d.obs} placeholder="Observation..."
                            style={{ width: 240, padding: '8px 12px', border: '1.5px solid #d4c8b8', borderRadius: 9, fontSize: 16, fontFamily: 'inherit', outline: 'none', background: 'white', color: '#1a1209' }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: '14px 22px', borderTop: '1px solid #e8e0d4', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button style={btnSec} onClick={() => showToast('Brouillon sauvegardé', 'info')}>💾 Sauvegarder</button>
                  <button style={btnPrim} onClick={() => showToast('Décisions validées pour 6e A', 'success')}>✅ Valider les décisions</button>
                </div>
              </div>
            </div>
          )}

          {/* ── VALIDATION NOTES ── */}
          {section === 'grades' && (
            <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
              <div style={{ marginBottom: 26 }}>
                <div style={sTitle}>Validation des notes</div>
                <div style={sSub}>4 lots en attente · Votre rôle : vérifier et valider</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {PENDING_GRADES.map((g, i) => (
                  <div key={i}
                    style={{ background: 'white', borderRadius: 16, border: `1.5px solid ${g.status === 'Rejeté' ? 'rgba(220,38,38,0.3)' : '#e8e0d4'}`, padding: '20px 26px', display: 'flex', alignItems: 'center', gap: 18 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: g.status === 'Rejeté' ? '#fee2e2' : '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                      {g.status === 'Rejeté' ? '✕' : '📝'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1209', marginBottom: 6 }}>
                        {g.classe} — {g.matiere}
                      </div>
                      <div style={{ display: 'flex', gap: 18, fontSize: 14, color: '#a89478', fontWeight: 600 }}>
                        <span>👤 {g.teacher}</span>
                        <span>👥 {g.count} élèves</span>
                        <span>📅 Soumis le {g.submitted}/2026</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: g.status === 'Rejeté' ? '#fee2e2' : '#fef3c7', color: g.status === 'Rejeté' ? '#991b1b' : '#92400e' }}>
                        {g.status}
                      </span>
                      <button
                        style={{ padding: '8px 16px', borderRadius: 9, fontSize: 15, fontWeight: 800, background: '#d1fae5', color: '#065f46', border: '1px solid rgba(5,150,105,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}
                        onClick={() => showToast(`Notes ${g.classe} validées`, 'success')}>✅ Valider</button>
                      <button
                        style={{ padding: '8px 16px', borderRadius: 9, fontSize: 15, fontWeight: 800, background: '#fee2e2', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}
                        onClick={() => showToast(`Notes ${g.classe} rejetées`, 'error')}>✕ Rejeter</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── FINANCE ── */}
          {section === 'finance' && (
            <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
                <div>
                  <div style={sTitle}>Mobile Money — Paiements</div>
                  <div style={sSub}>MTN MoMo &amp; Orange Money · Suivi des impayés</div>
                </div>
                <button style={btnPrim} onClick={() => showToast('Rappel SMS envoyé aux parents', 'success')}>
                  📱 Envoyer rappels SMS
                </button>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18, marginBottom: 22 }}>
                {[
                  { label: 'Total dû',  val: '2 850 000', sub: 'XAF ce trimestre',     bg: '#f0ebe3', color: '#1a1209' },
                  { label: 'Recouvré', val: '2 109 000', sub: '74% du total',          bg: '#d1fae5', color: '#065f46' },
                  { label: 'Impayé',   val: '741 000',   sub: '89 élèves concernés',   bg: '#fee2e2', color: '#991b1b' },
                ].map((s, i) => (
                  <div key={i} style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '22px 26px' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#a89478', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{s.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 15, color: '#a89478', marginTop: 5 }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
                <div style={{ padding: '14px 22px', borderBottom: '1px solid #e8e0d4', display: 'flex', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0ebe3', border: '1.5px solid #e8e0d4', borderRadius: 10, padding: '8px 12px', flex: 1 }}>
                    <span>🔍</span>
                    <input placeholder="Rechercher un élève..." style={{ background: 'none', border: 'none', outline: 'none', fontSize: 16, fontFamily: 'inherit', fontWeight: 600, width: '100%' }} />
                  </div>
                  <select style={selectSt}><option>Tous statuts</option><option>Impayé</option><option>Partiel</option></select>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Élève', 'Classe', 'Libellé', 'Montant', 'Statut', 'Actions'].map(h => <th key={h} style={thSt}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {PAYMENTS.map((p, i) => (
                      <tr key={i}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                        <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>{p.name}</td>
                        <td style={tdSt}>
                          <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 10px', borderRadius: 22, fontSize: 14, fontWeight: 800 }}>{p.classe}</span>
                        </td>
                        <td style={tdSt}>{p.label}</td>
                        <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>{p.amount.toLocaleString()} XAF</td>
                        <td style={tdSt}>
                          <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: p.sB, color: p.sC }}>{p.status}</span>
                        </td>
                        <td style={tdSt}>
                          <button
                            style={{ padding: '7px 14px', borderRadius: 9, fontSize: 15, fontWeight: 800, background: '#f0ebe3', color: '#6b5c45', border: '1px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }}
                            onClick={() => showToast(`Rappel envoyé à ${p.name}`, 'success')}>
                            📱 Rappel
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── CAUTIONS ── */}
          {section === 'cautions' && (
            <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
              <div style={{ marginBottom: 26 }}>
                <div style={sTitle}>Gestion des cautions</div>
                <div style={sSub}>Dépôts de garantie · HELD → REFUNDED ou PERMANENTLY_HELD</div>
              </div>
              <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Élève', 'Montant', 'Date dépôt', 'Statut', 'Actions'].map(h => <th key={h} style={thSt}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {CAUTIONS.map((c, i) => (
                      <tr key={i}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                        <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>{c.name}</td>
                        <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>{c.montant.toLocaleString()} XAF</td>
                        <td style={tdSt}>{c.date}</td>
                        <td style={tdSt}>
                          <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: c.sB, color: c.sC }}>{c.status}</span>
                        </td>
                        <td style={tdSt}>
                          {c.status === 'HELD' && (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                style={{ padding: '7px 14px', borderRadius: 9, fontSize: 15, fontWeight: 800, background: '#d1fae5', color: '#065f46', border: '1px solid rgba(5,150,105,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}
                                onClick={() => showToast(`Caution de ${c.name} remboursée`, 'success')}>
                                ✅ Rembourser
                              </button>
                              <button
                                style={{ padding: '7px 14px', borderRadius: 9, fontSize: 15, fontWeight: 800, background: '#fee2e2', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}
                                onClick={() => showToast(`Caution de ${c.name} retenue`, 'error')}>
                                🔒 Retenir
                              </button>
                            </div>
                          )}
                          {c.status === 'REFUNDED' && (
                            <span style={{ fontSize: 15, color: '#a89478', fontStyle: 'italic' }}>Remboursée</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── DISCIPLINE ── */}
          {section === 'discipline' && (
            <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
                <div>
                  <div style={sTitle}>Discipline</div>
                  <div style={sSub}>Avertissements, blâmes et sanctions</div>
                </div>
                <button style={btnPrim} onClick={() => showToast('Nouvelle sanction enregistrée', 'success')}>
                  + Nouvelle sanction
                </button>
              </div>
              <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Élève', 'Classe', 'Sanction', 'Date', 'Motif', 'Actions'].map(h => <th key={h} style={thSt}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {DISCIPLINE.map((d, i) => (
                      <tr key={i}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                        <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>{d.name}</td>
                        <td style={tdSt}>
                          <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 10px', borderRadius: 22, fontSize: 14, fontWeight: 800 }}>{d.classe}</span>
                        </td>
                        <td style={tdSt}>
                          <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: d.type === 'Blâme' ? '#fee2e2' : '#fef3c7', color: d.type === 'Blâme' ? '#991b1b' : '#92400e' }}>
                            {d.type}
                          </span>
                        </td>
                        <td style={tdSt}>{d.date}</td>
                        <td style={tdSt}>{d.motif}</td>
                        <td style={tdSt}>
                          <button
                            style={{ padding: '7px 14px', borderRadius: 9, fontSize: 15, fontWeight: 800, background: '#f0ebe3', color: '#6b5c45', border: '1px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }}
                            onClick={() => showToast(`PDF sanction ${d.name}`, 'info')}>
                            📄 PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── PLACEHOLDERS ── */}
          {(section === 'timetable' || section === 'attendance') && (
            <div style={{ padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: 52, textAlign: 'center', maxWidth: 520 }}>
                <div style={{ fontSize: 60, marginBottom: 20 }}>{section === 'timetable' ? '📅' : '✅'}</div>
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
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8 }
const btnSec: React.CSSProperties = { padding: '10px 18px', borderRadius: 10, fontSize: 16, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const selectSt: React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, padding: '8px 12px', fontSize: 16, fontWeight: 700, color: '#6b5c45', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
