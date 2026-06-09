'use client'

import { useState, useCallback, useEffect } from 'react'
import { Bell, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { logoutUser } from '@/lib/userAuth'

type StudentSection = 'dashboard' | 'grades' | 'bulletins' | 'timetable' | 'exams' | 'attendance'

interface Toast { id: number; msg: string; type: 'success' | 'error' | 'info' | 'warning' }
let toastId = 0

// ── Données démo ──
const STUDENT = {
  firstName: 'Marie', lastName: 'Ngono',
  classe: '6e A', matricule: '2025-0342',
  moyenne: 14.2, rang: '3e / 45', mention: 'Bien',
  tauxPresence: 97, indiceSante: 82,
}

const SUBJECTS = [
  { name: 'Mathématiques',          coeff: 4, note: 15.5, mention: 'TB',  teacher: 'M. Dupont',   trend: '↑' },
  { name: 'Français & Littérature', coeff: 4, note: 13.0, mention: 'B',   teacher: 'Mme Essomba', trend: '→' },
  { name: 'Sciences de la Vie',     coeff: 3, note: 16.0, mention: 'TB',  teacher: 'M. Ateba',    trend: '↑' },
  { name: 'Physique-Chimie',        coeff: 3, note: 11.5, mention: 'AB',  teacher: 'M. Nkomo',    trend: '↓' },
  { name: 'Histoire-Géographie',    coeff: 2, note: 14.0, mention: 'B',   teacher: 'M. Kamga',    trend: '→' },
  { name: 'Anglais',                coeff: 3, note: 12.5, mention: 'AB',  teacher: 'Mme Fouda',   trend: '↑' },
  { name: 'EPS',                    coeff: 1, note: 17.0, mention: 'TB',  teacher: 'M. Bello',    trend: '→' },
]

const BULLETINS = [
  { periode: 'Trimestre 1', avg: 14.2, rang: '3e / 45', mention: 'Bien', mBg: '#d1fae5', mC: '#065f46' },
  { periode: 'Trimestre 2', avg: 13.8, rang: '5e / 45', mention: 'Bien', mBg: '#d1fae5', mC: '#065f46' },
]

const EXAMS = [
  { title: 'DS Maths — Algèbre',    type: 'Devoir',        date: '02/06/2026', duree: '60 min',  status: 'À venir',  sB: '#dbeafe', sC: '#1e40af' },
  { title: 'Composition Français',  type: 'Composition',   date: '05/06/2026', duree: '120 min', status: 'À venir',  sB: '#dbeafe', sC: '#1e40af' },
  { title: 'Interro SVT — Cellule', type: 'Interrogation', date: '20/05/2026', duree: '30 min',  status: 'Terminé', sB: '#d1fae5', sC: '#065f46' },
]

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']
const TIMES = ['07:30–08:30', '08:30–09:30', '09:30–10:30', '10:30–11:30', '12:00–13:00', '13:00–14:00']
type Slot = { subject: string; teacher: string; color: string } | null
const SLOTS: Record<string, Slot> = {
  '0-0': { subject: 'Mathématiques',  teacher: 'M. Dupont',   color: '#059669' },
  '0-2': { subject: 'Anglais',        teacher: 'Mme Fouda',   color: '#1d4ed8' },
  '1-1': { subject: 'Français',       teacher: 'Mme Essomba', color: '#7c3aed' },
  '1-3': { subject: 'Histoire-Géo',   teacher: 'M. Kamga',    color: '#d97706' },
  '2-0': { subject: 'SVT',            teacher: 'M. Ateba',    color: '#0d9488' },
  '2-4': { subject: 'Physique-Chimie',teacher: 'M. Nkomo',    color: '#dc2626' },
  '3-2': { subject: 'Mathématiques',  teacher: 'M. Dupont',   color: '#059669' },
  '4-1': { subject: 'EPS',            teacher: 'M. Bello',    color: '#ea580c' },
  '4-3': { subject: 'Français',       teacher: 'Mme Essomba', color: '#7c3aed' },
}

const MENTION_COLOR = (m: string): [string, string] => ({
  TB: ['#d1fae5', '#065f46'], B: ['#dbeafe', '#1e40af'],
  AB: ['#fef3c7', '#92400e'], P: ['#ffedd5', '#9a3412'], I: ['#fee2e2', '#991b1b'],
} as Record<string, [string, string]>)[m] ?? ['#f1f5f9', '#475569']

const NOTE_COLOR = (n: number) => n >= 14 ? '#059669' : n >= 10 ? '#1d4ed8' : '#dc2626'

const HEALTH_LABEL = (s: number): [string, string, string] =>
  s >= 86 ? ['#d1fae5', '#065f46', 'PROGRESSION 📈']
  : s >= 71 ? ['#dbeafe', '#1e40af', 'STABLE ✅']
  : s >= 51 ? ['#fef3c7', '#92400e', 'MOYEN ⚠️']
  : ['#fee2e2', '#991b1b', 'À SURVEILLER 🚨']

const TITLES: Record<StudentSection, string> = {
  dashboard:  'Tableau de bord',
  grades:     'Mes notes',
  bulletins:  'Mes bulletins',
  timetable:  'Mon emploi du temps',
  exams:      'Mes examens',
  attendance: 'Mes présences',
}

const NAV_GROUPS: { label?: string; items: { id: StudentSection; icon: string; label: string }[] }[] = [
  {
    items: [
      { id: 'dashboard', icon: '⊞', label: 'Tableau de bord' },
    ]
  },
  {
    label: 'Résultats',
    items: [
      { id: 'grades',    icon: '📝', label: 'Mes notes' },
      { id: 'bulletins', icon: '📄', label: 'Bulletins' },
    ]
  },
  {
    label: 'Agenda scolaire',
    items: [
      { id: 'timetable',  icon: '📅', label: 'Emploi du temps' },
      { id: 'exams',      icon: '📋', label: 'Examens' },
      { id: 'attendance', icon: '✅', label: 'Mes présences' },
    ]
  },
]

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
      <span style={{ fontSize: 16 }}>{ICONS[t.type]}</span>
      <span>{t.msg}</span>
    </div>
  )
}

export default function StudentDashboard() {
  const [section, setSection] = useState<StudentSection>('dashboard')
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, msg, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const [hBg, hC, hLabel] = HEALTH_LABEL(STUDENT.indiceSante)

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
            <div className="text-[14px] text-white/35 font-semibold">Espace Élève</div>
          </div>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden" style={{ padding: '25px 25px' }}>
          {/* École pill */}
          <div className="bg-white/[0.06] border border-white/10 rounded-[10px] mb-[25px]" style={{ padding: '20px 23px' }}>
            <div className="flex items-center gap-[8px]">
              <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-[#059669] to-[#1d4ed8] flex items-center justify-center text-[15px] font-black text-white flex-shrink-0">LS</div>
              <div className="min-w-0">
                <div className="text-[16px] font-bold text-white truncate">Lycée du Succès</div>
                <div className="text-[13px] text-white/35">{STUDENT.classe} · 2025–2026</div>
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
            <div className="w-11 h-11 rounded-[11px] bg-gradient-to-br from-[#7c3aed] to-[#1d4ed8] flex items-center justify-center text-white font-black text-[16px] flex-shrink-0">MN</div>
            <div className="min-w-0">
              <div className="text-[17px] font-bold text-white truncate">Marie Ngono</div>
              <div className="text-[14px] text-white/35">Élève · {STUDENT.classe}</div>
            </div>
            <button onClick={logoutUser} title="Se déconnecter" className="ml-auto"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 4, borderRadius: 6 }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(239,68,68,0.8)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'}>
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

          {/* ── DASHBOARD ── */}
          {section === 'dashboard' && (
            <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>

              {/* Hero banner */}
              <div style={{ background: 'linear-gradient(135deg,#1a2e1e,#243b29)', borderRadius: 20, padding: '32px 36px', marginBottom: 26, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: -50, top: -50, width: 240, height: 240, borderRadius: '50%', background: 'rgba(74,222,128,0.05)', pointerEvents: 'none' }} />
                <div>
                  <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 30, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                    Bonjour, {STUDENT.firstName} 👋
                  </div>
                  <div style={{ fontSize: 17, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                    {STUDENT.classe} · Matricule : {STUDENT.matricule}
                  </div>
                  <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ background: '#d1fae5', color: '#065f46', padding: '5px 14px', borderRadius: 22, fontSize: 15, fontWeight: 800 }}>
                      🏆 {STUDENT.rang}
                    </span>
                    <span style={{ background: hBg, color: hC, padding: '5px 14px', borderRadius: 22, fontSize: 15, fontWeight: 800 }}>
                      ❤️ {hLabel}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 56, fontWeight: 900, color: 'white', lineHeight: 1 }}>{STUDENT.moyenne}</div>
                  <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>Moyenne générale /20</div>
                  <div style={{ marginTop: 10, background: '#d1fae5', color: '#065f46', padding: '5px 16px', borderRadius: 22, fontSize: 14, fontWeight: 800, display: 'inline-block' }}>
                    {STUDENT.mention}
                  </div>
                </div>
              </div>

              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 22 }}>
                {[
                  { icon: '📝', bg: '#d1fae5', val: `${STUDENT.moyenne}/20`, label: 'Moyenne générale',  trend: STUDENT.mention,    tBg: '#d1fae5', tC: '#065f46' },
                  { icon: '🏆', bg: '#dbeafe', val: STUDENT.rang.split('/')[0].trim(), label: `Rang sur ${STUDENT.rang.split('/')[1].trim()} élèves`, trend: 'Ce trimestre', tBg: '#dbeafe', tC: '#1e40af' },
                  { icon: '✅', bg: '#fef3c7', val: `${STUDENT.tauxPresence}%`, label: 'Taux de présence', trend: 'Trimestre 2',  tBg: '#d1fae5', tC: '#065f46' },
                  { icon: '📚', bg: '#ede9fe', val: String(SUBJECTS.length),  label: 'Matières suivies', trend: `Coeff. ${SUBJECTS.reduce((s, sub) => s + sub.coeff, 0)}`, tBg: '#ede9fe', tC: '#5b21b6' },
                ].map((k, i) => (
                  <div key={i}
                    style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '22px 26px', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)' })}
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

              {/* Prochains cours */}
              <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
                <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4' }}>
                  <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>📅 Prochains cours aujourd&apos;hui</span>
                </div>
                <div style={{ padding: '16px 22px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {[
                    { time: '08:30', subject: 'Français',  teacher: 'Mme Essomba', salle: 'Salle 4',  color: '#7c3aed' },
                    { time: '10:30', subject: 'Histoire',  teacher: 'M. Kamga',    salle: 'Salle 9',  color: '#d97706' },
                    { time: '14:00', subject: 'EPS',       teacher: 'M. Bello',    salle: 'Gymnase',  color: '#ea580c' },
                  ].map((c, i) => (
                    <div key={i} style={{ flex: 1, minWidth: 180, background: '#f7f3ee', borderRadius: 12, padding: '14px 16px', borderLeft: `3px solid ${c.color}` }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#a89478', marginBottom: 5 }}>{c.time}</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>{c.subject}</div>
                      <div style={{ fontSize: 14, color: '#a89478', marginTop: 4 }}>{c.teacher} · {c.salle}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── MES NOTES ── */}
          {section === 'grades' && (
            <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
              <div style={{ marginBottom: 26 }}>
                <div style={sTitle}>Mes notes — Trimestre 2</div>
                <div style={sSub}>Résultats par matière · {STUDENT.classe}</div>
              </div>

              {/* Résumé sombre */}
              <div style={{ background: 'linear-gradient(135deg,#1a2e1e,#243b29)', borderRadius: 16, padding: '22px 28px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 28 }}>
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 48, fontWeight: 900, color: 'white', lineHeight: 1 }}>{STUDENT.moyenne}</div>
                  <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginTop: 5 }}>Moyenne / 20</div>
                </div>
                <div style={{ width: 1, height: 60, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
                <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Rang', val: STUDENT.rang },
                    { label: 'Mention', val: STUDENT.mention },
                    { label: 'Matières > 10', val: `${SUBJECTS.filter(s => s.note >= 10).length}/${SUBJECTS.length}` },
                  ].map((s, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{s.label}</div>
                      <div style={{ fontSize: 19, fontWeight: 900, color: 'white', marginTop: 4 }}>{s.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Matière', 'Coeff.', 'Note /20', 'Mention', 'Tendance', 'Enseignant'].map(h => (
                      <th key={h} style={thSt}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {SUBJECTS.map((sub, i) => {
                      const [mBg, mC] = MENTION_COLOR(sub.mention)
                      return (
                        <tr key={i}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                          <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>{sub.name}</td>
                          <td style={tdSt}>
                            <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 10px', borderRadius: 22, fontSize: 14, fontWeight: 900 }}>×{sub.coeff}</span>
                          </td>
                          <td style={tdSt}>
                            <span style={{ fontSize: 22, fontWeight: 900, color: NOTE_COLOR(sub.note) }}>{sub.note}</span>
                          </td>
                          <td style={tdSt}>
                            <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: mBg, color: mC }}>{sub.mention}</span>
                          </td>
                          <td style={{ ...tdSt, fontSize: 20 }}>
                            <span style={{ color: sub.trend === '↑' ? '#059669' : sub.trend === '↓' ? '#dc2626' : '#a89478' }}>{sub.trend}</span>
                          </td>
                          <td style={tdSt}>{sub.teacher}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── BULLETINS ── */}
          {section === 'bulletins' && (
            <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
              <div style={{ marginBottom: 26 }}>
                <div style={sTitle}>Mes bulletins</div>
                <div style={sSub}>Résultats officiels par trimestre</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }}>
                {BULLETINS.map((b, i) => (
                  <div key={i} style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
                    <div style={{ padding: '18px 22px', borderBottom: '1px solid #e8e0d4', background: 'linear-gradient(135deg,#1a2e1e,#243b29)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 19, fontWeight: 700, color: 'white' }}>{b.periode}</div>
                      <span style={{ background: b.mBg, color: b.mC, padding: '4px 14px', borderRadius: 22, fontSize: 14, fontWeight: 800 }}>{b.mention}</span>
                    </div>
                    <div style={{ padding: '22px 22px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                        <div style={{ background: '#f0ebe3', borderRadius: 12, padding: '16px 18px', textAlign: 'center' }}>
                          <div style={{ fontSize: 40, fontWeight: 900, color: NOTE_COLOR(b.avg) }}>{b.avg}</div>
                          <div style={{ fontSize: 13, color: '#a89478', fontWeight: 700, marginTop: 4 }}>Moyenne / 20</div>
                        </div>
                        <div style={{ background: '#f0ebe3', borderRadius: 12, padding: '16px 18px', textAlign: 'center' }}>
                          <div style={{ fontSize: 30, fontWeight: 900, color: '#1a1209' }}>{b.rang.split('/')[0].trim()}</div>
                          <div style={{ fontSize: 13, color: '#a89478', fontWeight: 700, marginTop: 4 }}>Rang / {b.rang.split('/')[1].trim()} élèves</div>
                        </div>
                      </div>
                      <button
                        style={{ width: '100%', padding: '12px 16px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                        onClick={() => showToast(`Téléchargement bulletin ${b.periode}`, 'success')}>
                        📥 Télécharger le bulletin PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── EMPLOI DU TEMPS ── */}
          {section === 'timetable' && (
            <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
              <div style={{ marginBottom: 26 }}>
                <div style={sTitle}>Mon emploi du temps</div>
                <div style={sSub}>{STUDENT.classe} · Semaine du 26 au 30 Mai 2026</div>
              </div>
              <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                    <thead>
                      <tr>
                        <th style={{ ...thSt, width: 100 }}>Horaire</th>
                        {DAYS.map(d => <th key={d} style={thSt}>{d}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {TIMES.map((time, ti) => (
                        <tr key={ti}>
                          <td style={{ padding: '10px 11px', background: '#f0ebe3', fontSize: 13, fontWeight: 800, color: '#a89478', textAlign: 'center', border: '1px solid #e8e0d4', whiteSpace: 'nowrap' }}>
                            {time}
                          </td>
                          {DAYS.map((_, di) => {
                            const slot = SLOTS[`${di}-${ti}`]
                            return (
                              <td key={di} style={{ padding: 0, border: '1px solid #e8e0d4', verticalAlign: 'top', minWidth: 140, height: 76 }}>
                                {slot ? (
                                  <div style={{ padding: 10, height: '100%', background: `${slot.color}12`, borderLeft: `3px solid ${slot.color}` }}>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: slot.color }}>{slot.subject}</div>
                                    <div style={{ fontSize: 12, color: '#a89478', marginTop: 3 }}>{slot.teacher}</div>
                                  </div>
                                ) : (
                                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4c8b8', fontSize: 20 }}>·</div>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── EXAMENS ── */}
          {section === 'exams' && (
            <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
              <div style={{ marginBottom: 26 }}>
                <div style={sTitle}>Mes examens</div>
                <div style={sSub}>Devoirs, compositions et interrogations</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {EXAMS.map((exam, i) => (
                  <div key={i}
                    style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '20px 26px', display: 'flex', alignItems: 'center', gap: 18, transition: 'all 0.15s', cursor: 'pointer' }}
                    onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#d4c8b8', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' })}
                    onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#e8e0d4', boxShadow: 'none' })}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: exam.status === 'Terminé' ? '#d1fae5' : '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                      {exam.status === 'Terminé' ? '✅' : '📋'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1209', marginBottom: 6 }}>{exam.title}</div>
                      <div style={{ display: 'flex', gap: 18, fontSize: 14, color: '#a89478', fontWeight: 600 }}>
                        <span>📅 {exam.date}</span>
                        <span>⏱ {exam.duree}</span>
                        <span>🏫 {STUDENT.classe}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                      <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: exam.sB, color: exam.sC }}>{exam.status}</span>
                      <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: '#f0ebe3', color: '#6b5c45' }}>{exam.type}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── PRÉSENCES ── */}
          {section === 'attendance' && (
            <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
              <div style={{ marginBottom: 26 }}>
                <div style={sTitle}>Mes présences</div>
                <div style={sSub}>Suivi de votre assiduité · Trimestre 2</div>
              </div>

              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 22 }}>
                {[
                  { icon: '✅', bg: '#d1fae5', val: '97%', label: 'Taux de présence', color: '#065f46' },
                  { icon: '✗',  bg: '#fee2e2', val: '1',   label: 'Jours absents',    color: '#991b1b' },
                  { icon: '~',  bg: '#fef3c7', val: '2',   label: 'Retards',          color: '#92400e' },
                  { icon: 'E',  bg: '#dbeafe', val: '0',   label: 'Excusés',          color: '#1e40af' },
                ].map((s, i) => (
                  <div key={i} style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '22px 26px' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: s.color, marginBottom: 12 }}>{s.icon}</div>
                    <div style={{ fontSize: 36, fontWeight: 900, color: '#1a1209', lineHeight: 1 }}>{s.val}</div>
                    <div style={{ fontSize: 16, color: '#a89478', marginTop: 5, fontWeight: 600 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Évolution hebdomadaire */}
              <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '18px 22px' }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1209', marginBottom: 18 }}>📊 Évolution ce mois</div>
                {[
                  { week: 'Semaine 1 (29 avr – 3 mai)',  p: 100, a: 0  },
                  { week: 'Semaine 2 (6 – 10 mai)',       p: 100, a: 0  },
                  { week: 'Semaine 3 (13 – 17 mai)',      p: 80,  a: 20 },
                  { week: 'Semaine 4 (20 – 24 mai)',      p: 100, a: 0  },
                  { week: 'Semaine 5 (27 – 31 mai)',      p: 100, a: 0  },
                ].map((w, i) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: '#6b5c45', marginBottom: 6 }}>
                      <span>{w.week}</span>
                      <span style={{ color: w.a > 0 ? '#dc2626' : '#059669', fontWeight: 900 }}>
                        {w.a > 0 ? `${w.a}% absent` : '100% présent'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', height: 8, borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ flex: w.p, background: '#059669', borderRadius: w.a > 0 ? '8px 0 0 8px' : 8 }} />
                      {w.a > 0 && <div style={{ flex: w.a, background: '#dc2626', borderRadius: '0 8px 8px 0' }} />}
                    </div>
                  </div>
                ))}
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
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
