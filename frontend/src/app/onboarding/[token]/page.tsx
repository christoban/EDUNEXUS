'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import PasswordStrengthBar, { getPasswordStrength } from '@/components/PasswordStrengthBar'

// ── Types ──────────────────────────────────────────────────────────────────

type LoadState = 'loading' | 'valid' | 'invalid' | 'expired' | 'used'
type Step = 1 | 2 | 3 | 4 | 5

interface InviteData {
  schoolName: string
  email: string
  plan: string
  notes: string | null
}

interface DetectedTemplate {
  code: string
  name: string
  hasPremierCycle: boolean
  hasDeuxiemeCycle: boolean
  isTechnique: boolean
  isPrimaire: boolean
  isComplexe?: boolean
}

const TEMPLATE_META: Record<string, DetectedTemplate> = {
  GHS_EN:            { code: 'GHS_EN', name: 'Government High School', hasPremierCycle: false, hasDeuxiemeCycle: true, isTechnique: false, isPrimaire: false },
  GSS_EN:            { code: 'GSS_EN', name: 'Government Secondary School', hasPremierCycle: false, hasDeuxiemeCycle: true, isTechnique: false, isPrimaire: false },
  PRIVE_EN:          { code: 'PRIVE_EN', name: 'Private School (Anglophone)', hasPremierCycle: false, hasDeuxiemeCycle: true, isTechnique: false, isPrimaire: false },
  PRIMARY_EN:        { code: 'PRIMARY_EN', name: 'Primary School (Anglophone)', hasPremierCycle: false, hasDeuxiemeCycle: false, isTechnique: false, isPrimaire: true },
  NURSERY_EN:        { code: 'NURSERY_EN', name: 'Nursery School', hasPremierCycle: false, hasDeuxiemeCycle: false, isTechnique: false, isPrimaire: true },
  LYCEE_BILINGUE:    { code: 'LYCEE_BILINGUE', name: 'Lycée Bilingue', hasPremierCycle: true, hasDeuxiemeCycle: true, isTechnique: false, isPrimaire: false },
  PRIMARY_BILINGUAL: { code: 'PRIMARY_BILINGUAL', name: 'Primary School Bilingue', hasPremierCycle: false, hasDeuxiemeCycle: false, isTechnique: false, isPrimaire: true },
  LYCEE_TECHNIQUE_FR: { code: 'LYCEE_TECHNIQUE_FR', name: 'Lycée Technique Francophone', hasPremierCycle: true, hasDeuxiemeCycle: true, isTechnique: true, isPrimaire: false },
  CETIC:             { code: 'CETIC', name: "Collège d'Enseignement Technique", hasPremierCycle: true, hasDeuxiemeCycle: false, isTechnique: true, isPrimaire: false },
  SAR_SM:            { code: 'SAR_SM', name: 'SAR / Section Ménagère', hasPremierCycle: false, hasDeuxiemeCycle: false, isTechnique: true, isPrimaire: false },
  CFM:               { code: 'CFM', name: 'Centre de Formation aux Métiers', hasPremierCycle: false, hasDeuxiemeCycle: false, isTechnique: true, isPrimaire: false },
  PRIMAIRE_FR:       { code: 'PRIMAIRE_FR', name: 'École Primaire Francophone', hasPremierCycle: false, hasDeuxiemeCycle: false, isTechnique: false, isPrimaire: true },
  MATERNELLE_FR:     { code: 'MATERNELLE_FR', name: 'École Maternelle', hasPremierCycle: false, hasDeuxiemeCycle: false, isTechnique: false, isPrimaire: true },
  LYCEE_FR:          { code: 'LYCEE_FR', name: 'Lycée Général Francophone', hasPremierCycle: true, hasDeuxiemeCycle: true, isTechnique: false, isPrimaire: false },
  CES_FR:            { code: 'CES_FR', name: "Collège d'Enseignement Secondaire", hasPremierCycle: true, hasDeuxiemeCycle: true, isTechnique: false, isPrimaire: false },
  PRIVE_FR:          { code: 'PRIVE_FR', name: 'Établissement Privé Francophone', hasPremierCycle: true, hasDeuxiemeCycle: true, isTechnique: false, isPrimaire: false },
  COMPLEXE_SCOLAIRE: { code: 'COMPLEXE_SCOLAIRE', name: 'Complexe Scolaire', hasPremierCycle: true, hasDeuxiemeCycle: true, isTechnique: false, isPrimaire: false, isComplexe: true },
}

interface PreviewData {
  classes: { name: string; level: string; section: string }[]
  totalClasses: number
  subjects: string[]
}

interface FormData {
  // Step 1 — École
  nom: string
  subdomain: string
  subsystem: string
  educationType: string
  ownership: string
  ville: string
  region: string
  telephone: string
  adresse: string
  logoBase64: string
  // Step 2 — Admin
  adminPrenom: string
  adminNom: string
  adminEmail: string
  password: string
  confirmPassword: string
  // Step 3 — Configuration étendue
  niveaux1erCycle: string[]
  classesParNiveau: Record<string, number>
  conventionNommage: string
  lv2Debut: string
  lv2Disponibles: string[]
  niveaux2eCycle: string[]
  filieres: string[]
  a4Languages: string[]
  classesParFiliere: string
  filieresTechniques: string[]
  niveauxPrimaire: string[]
  classesParNiveauPrimaire: Record<string, number>
}

// ── Constants ──────────────────────────────────────────────────────────────

const REGIONS = ['Adamaoua','Centre','Est','Extrême-Nord','Littoral','Nord','Nord-Ouest','Ouest','Sud','Sud-Ouest']

const PLAN_LABEL: Record<string, string> = {
  DISCOVERY: 'Découverte', STANDARD: 'Standard', PREMIUM: 'Premium',
}
const PLAN_COLOR: Record<string, string> = {
  DISCOVERY: '#059669', STANDARD: '#2563eb', PREMIUM: '#9333ea',
}

const SUBSYSTEM_OPTIONS = [
  { value: 'FRANCOPHONE', label: 'Francophone', icon: '🇫🇷' },
  { value: 'ANGLOPHONE',  label: 'Anglophone',  icon: '🇬🇧' },
  { value: 'BILINGUAL',   label: 'Bilingue',    icon: '🌍' },
]
const EDUCATION_OPTIONS = [
  { value: 'GENERAL',      label: 'Enseignement général',      icon: '📚' },
  { value: 'TECHNICAL',    label: 'Enseignement technique',    icon: '⚙️' },
  { value: 'PROFESSIONAL', label: 'Enseignement professionnel', icon: '🔧' },
  { value: 'MIXED',        label: 'Mixte',                     icon: '🎓' },
]
const OWNERSHIP_OPTIONS = [
  { value: 'PUBLIC',          label: 'Public',              icon: '🏛️' },
  { value: 'PRIVATE_SECULAR', label: 'Privé laïc',         icon: '🏫' },
  { value: 'PRIVATE_FAITH',   label: 'Privé confessionnel', icon: '⛪' },
]

const TCODES_PEBS_FR = ['LYCEE_FR','CES_FR','PRIVE_FR','LYCEE_BILINGUE']
const TCODES_PEBS_EN = ['GHS_EN','GSS_EN','PRIVE_EN','LYCEE_BILINGUE']
const TCODES_AVEC_1ER_CYCLE = ['LYCEE_FR','CES_FR','PRIVE_FR','LYCEE_TECHNIQUE_FR','CETIC','LYCEE_BILINGUE','COMPLEXE_SCOLAIRE']
const TCODES_AVEC_2E_CYCLE = ['LYCEE_FR','PRIVE_FR','LYCEE_BILINGUE','GHS_EN','GSS_EN','PRIVE_EN','COMPLEXE_SCOLAIRE']
const TCODES_TECHNIQUE = ['LYCEE_TECHNIQUE_FR','CETIC']
const TCODES_PRIMAIRE = ['PRIMAIRE_FR','PRIMARY_EN','PRIMARY_BILINGUAL']

const NIVEAUX_1ER_CYCLE_FR = ['6e','5e','4e','3e']
const NIVEAUX_1ER_CYCLE_CAP = ['CAP1','CAP2','CAP3','CAP4']
const NIVEAUX_1ER_CYCLE_EN = ['Form 1','Form 2','Form 3','Form 4','Form 5']
const NIVEAUX_2E_CYCLE_FR = ['2nde','1ère','Tle']
const NIVEAUX_2E_CYCLE_EN = ['Lower Sixth','Upper Sixth']

const FILIERES_LITT = [
  'A4 — Langues Vivantes',
  'A1 — Littéraire LV1 renforcée',
  'A2 — Littéraire LV2 renforcée',
  'A3 — Littéraire LV3 renforcée',
  'A5 — Philosophie renforcée',
  'SH — Sciences Humaines',
  'AC — Arts et Cinématographiques (rare)',
]
const FILIERES_SCIENT = ['C — Mathématiques-Physique','D — Mathématiques-SVT','TI — Technologies de l\'Information','E — (rare)']
const FILIERES_TECH = ['F · G · H (technique)']
const FILIERES_EN = ['Arts (A1 · A2 · A3 · A4)','Sciences (S1 · S2 · S3 · S4)']

const FILIERES_EN_ARTS = ['A1 — Literature','A2 — History','A3 — Geography','A4 — Languages']
const FILIERES_EN_SCIENCES = ['S1 — Maths','S2 — Physics','S3 — Biology','S4 — Chemistry']

const NIVEAUX_EN_FULL = ['Form 1','Form 2','Form 3','Form 4','Form 5','Lower Sixth','Upper Sixth']

const FILIERES_TECHNIQUES_OFF = ['F1','F2','F3','G1','G2','G3','INFOR','HOTEL','COUTURE','AGRIC']
const FILIERES_TECHNIQUES_TER = ['MAEL','TMI','ECS','ESF','IH']

const NIVEAUX_PRIMAIRE_FR = ['SIL','CP','CE1','CE2','CM1','CM2']
const NIVEAUX_PRIMAIRE_EN = ['Class 1','Class 2','Class 3','Class 4','Class 5','Class 6']
const NIVEAUX_MATERNELLE = ['Petite section','Moyenne section','Grande section']

const LV2_OPTIONS = ['Espagnol','Allemand','Chinois','Arabe','Latin','Italien']

const CONVENTION_OPTIONS = [
  { value: 'LETTRES',  label: 'Lettres',  desc: '6e A, 6e B, 6e C…' },
  { value: 'CHIFFRES', label: 'Chiffres', desc: '6e 1, 6e 2, 6e 3…' },
  { value: 'MIXTE',    label: 'Mixte',    desc: '6e A1, 6e A2…' },
]

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const MAX_STEPPER = 6

// ── Helpers ────────────────────────────────────────────────────────────────

function toSlug(v: string) {
  return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function labelOf(opts: { value: string; label: string }[], val: string) {
  return opts.find(o => o.value === val)?.label ?? val
}

function toggleInArray(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]
}

function detectTemplate(form: FormData): DetectedTemplate | null {
  const { subsystem, educationType, ownership, nom } = form
  const n = nom.toLowerCase()

  if (subsystem === 'FRANCOPHONE' && educationType === 'GENERAL') {
    if (ownership === 'PUBLIC') {
      if (n.includes('maternelle'))
        return { code: 'MATERNELLE_FR', name: 'École Maternelle', hasPremierCycle: false, hasDeuxiemeCycle: false, isTechnique: false, isPrimaire: true }
      if (n.includes('primaire') || n.includes('école') && !n.includes('lycée') && !n.includes('collège'))
        return { code: 'PRIMAIRE_FR', name: 'École Primaire Francophone', hasPremierCycle: false, hasDeuxiemeCycle: false, isTechnique: false, isPrimaire: true }
      const isLycee = n.includes('lycée') || n.includes('lycee')
      const isCollege = n.includes('collège') || n.includes('college') || n.includes('ces')
      if (isCollege && !isLycee) return { code: 'CES_FR', name: 'Collège d\'Enseignement Secondaire', hasPremierCycle: true, hasDeuxiemeCycle: true, isTechnique: false, isPrimaire: false }
      return { code: 'LYCEE_FR', name: 'Lycée Général Francophone', hasPremierCycle: true, hasDeuxiemeCycle: true, isTechnique: false, isPrimaire: false }
    }
    return { code: 'PRIVE_FR', name: 'Établissement Privé Francophone', hasPremierCycle: true, hasDeuxiemeCycle: true, isTechnique: false, isPrimaire: false }
  }

  if (subsystem === 'FRANCOPHONE' && educationType === 'TECHNICAL') {
    const isCetic = n.includes('cetic') || n.includes('college') || n.includes('cet')
    if (isCetic) return { code: 'CETIC', name: 'Collège d\'Enseignement Technique', hasPremierCycle: true, hasDeuxiemeCycle: false, isTechnique: true, isPrimaire: false }
    return { code: 'LYCEE_TECHNIQUE_FR', name: 'Lycée Technique Francophone', hasPremierCycle: true, hasDeuxiemeCycle: true, isTechnique: true, isPrimaire: false }
  }

  if (subsystem === 'FRANCOPHONE' && educationType === 'PROFESSIONAL') {
    if (n.includes('cfm') || n.includes('centre de forma'))
      return { code: 'CFM', name: 'Centre de Formation aux Métiers', hasPremierCycle: false, hasDeuxiemeCycle: false, isTechnique: true, isPrimaire: false }
    return { code: 'SAR_SM', name: 'SAR / Section Ménagère', hasPremierCycle: false, hasDeuxiemeCycle: false, isTechnique: true, isPrimaire: false }
  }

  if (subsystem === 'ANGLOPHONE' && educationType === 'GENERAL') {
    if (n.includes('nursery') || n.includes('preschool'))
      return { code: 'NURSERY_EN', name: 'Nursery School', hasPremierCycle: false, hasDeuxiemeCycle: false, isTechnique: false, isPrimaire: true }
    if (n.includes('primary') || n.includes('nurs') || n.includes('infant') || n.includes('junior') && !n.includes('secondary') && !n.includes('high') && !n.includes('grammar'))
      return { code: 'PRIMARY_EN', name: 'Primary School (Anglophone)', hasPremierCycle: false, hasDeuxiemeCycle: false, isTechnique: false, isPrimaire: true }
    if (ownership === 'PRIVATE_SECULAR' || ownership === 'PRIVATE_FAITH')
      return { code: 'PRIVE_EN', name: 'Private School (Anglophone)', hasPremierCycle: false, hasDeuxiemeCycle: true, isTechnique: false, isPrimaire: false }
    const isHigh = n.includes('high') || n.includes('grammar')
    return { code: isHigh ? 'GHS_EN' : 'GSS_EN', name: isHigh ? 'Government High School' : 'Government Secondary School', hasPremierCycle: false, hasDeuxiemeCycle: true, isTechnique: false, isPrimaire: false }
  }

  if (subsystem === 'BILINGUAL' && educationType === 'GENERAL') {
    if (n.includes('primaire') || n.includes('primary') || n.includes('nursery'))
      return { code: 'PRIMARY_BILINGUAL', name: 'Primary School Bilingue', hasPremierCycle: false, hasDeuxiemeCycle: false, isTechnique: false, isPrimaire: true }
    return { code: 'LYCEE_BILINGUE', name: 'Lycée Bilingue', hasPremierCycle: true, hasDeuxiemeCycle: true, isTechnique: false, isPrimaire: false }
  }

  if (subsystem === 'BILINGUAL' && educationType === 'MIXED') {
    return { code: 'COMPLEXE_SCOLAIRE', name: 'Complexe Scolaire', hasPremierCycle: true, hasDeuxiemeCycle: true, isTechnique: false, isPrimaire: false, isComplexe: true }
  }

  return null
}

function previewClassNames(level: string, count: number, convention: string): string[] {
  if (convention === 'LETTRES') {
    return Array.from({ length: Math.min(count, 26) }, (_, i) => `${level} ${LETTERS[i]}`)
  }
  if (convention === 'CHIFFRES') {
    return Array.from({ length: Math.min(count, 99) }, (_, i) => `${level} ${i + 1}`)
  }
  if (convention === 'MIXTE') {
    return Array.from({ length: Math.min(count, 26) }, (_, i) => `${level} ${LETTERS[i]}1`)
  }
  return []
}

// ── Sub-components ─────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%', padding: '11px 14px', background: 'white',
  border: '1.5px solid #d4c8b8', borderRadius: 10, color: '#1a1209',
  fontSize: 17, fontFamily: 'inherit', fontWeight: 600, outline: 'none',
  boxSizing: 'border-box', transition: 'all 0.2s',
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 13, fontWeight: 700, color: '#6b5c45', marginBottom: 6, display: 'block', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
        {label}{required && <span style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function Alert({ msg, type }: { msg: string; type: 'error' | 'success' | 'info' }) {
  const styles = {
    error:   { bg: '#fef2f2', border: 'rgba(220,38,38,0.25)',  color: '#991b1b', icon: '⚠️' },
    success: { bg: '#f0fdf4', border: 'rgba(5,150,105,0.25)',  color: '#065f46', icon: '✅' },
    info:    { bg: '#eff6ff', border: 'rgba(37,99,235,0.25)',  color: '#1e40af', icon: 'ℹ️' },
  }[type]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: styles.bg, border: `1.5px solid ${styles.border}`, borderRadius: 10, marginBottom: 14, fontSize: 14, fontWeight: 700, color: styles.color }}>
      <span>{styles.icon}</span><span>{msg}</span>
    </div>
  )
}

function RadioCards({ options, value, onChange }: {
  options: { value: string; label: string; icon: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length <= 3 ? options.length : 2}, 1fr)`, gap: 8 }}>
      {options.map(o => {
        const active = value === o.value
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            style={{
              padding: '10px 8px', border: `2px solid ${active ? '#059669' : '#d4c8b8'}`,
              borderRadius: 10, background: active ? 'rgba(5,150,105,0.07)' : 'white',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
            <span style={{ fontSize: 22 }}>{o.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: active ? '#047857' : '#6b5c45', textAlign: 'center', lineHeight: 1.2 }}>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function SubmitBtn({ loading, disabled, onClick, children }: { loading?: boolean; disabled?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={loading || disabled}
      style={{
        width: '100%', padding: '14px', background: loading || disabled ? '#a8d5c2' : 'linear-gradient(135deg,#059669,#047857)',
        color: 'white', fontSize: 18, fontWeight: 800, border: 'none', borderRadius: 10,
        cursor: loading || disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        boxShadow: loading || disabled ? 'none' : '0 4px 16px rgba(5,150,105,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, transition: 'all 0.2s',
      }}>
      {loading
        ? <><div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} /> Traitement en cours…</>
        : children}
    </button>
  )
}

function CheckboxGroup({ options, values, onChange, note }: {
  options: { value: string; label: string }[]
  values: string[]
  onChange: (v: string[]) => void
  note?: string
}) {
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map(o => {
          const checked = values.includes(o.value)
          return (
            <label key={o.value} onClick={() => onChange(checked ? values.filter(v => v !== o.value) : [...values, o.value])}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                border: `2px solid ${checked ? '#059669' : '#d4c8b8'}`,
                borderRadius: 8, background: checked ? 'rgba(5,150,105,0.07)' : 'white',
                cursor: 'pointer', fontSize: 14, fontWeight: 700, color: checked ? '#047857' : '#6b5c45',
                transition: 'all 0.15s', userSelect: 'none',
              }}>
              <span style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${checked ? '#059669' : '#c4b8a8'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: checked ? '#059669' : 'transparent', flexShrink: 0 }}>
                {checked && <span style={{ color: 'white', fontSize: 12 }}>✓</span>}
              </span>
              {o.label}
            </label>
          )
        })}
      </div>
      {note && <div style={{ fontSize: 12, color: '#a89478', marginTop: 6, fontWeight: 600, lineHeight: 1.5 }}>{note}</div>}
    </div>
  )
}

function StepperBtns({ value, onChange, max = MAX_STEPPER }: { value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {Array.from({ length: max }, (_, i) => i + 1).map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          style={{
            width: 32, height: 32, borderRadius: 8, border: `2px solid ${value === n ? '#059669' : '#d4c8b8'}`,
            background: value === n ? '#059669' : 'white', color: value === n ? 'white' : '#6b5c45',
            fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.12s',
          }}>{n}</button>
      ))}
    </div>
  )
}

function ClassPreview({ levels, convention }: { levels: { level: string; count: number }[]; convention: string }) {
  const lines = levels
    .filter(l => l.count > 0)
    .map(l => `${l.level} : ${previewClassNames(l.level, l.count, convention).join(' · ')}`)

  if (lines.length === 0) {
    return <div style={{ fontSize: 13, color: '#a89478', fontStyle: 'italic' }}>Aucune classe configurée</div>
  }

  return (
    <div style={{ fontSize: 13, color: '#6b5c45', lineHeight: 1.7, fontWeight: 600 }}>
      {lines.map((line, i) => <div key={i}>{line}</div>)}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const params = useParams()
  const token = params?.token as string

  const [loadState, setLoadState]   = useState<LoadState>('loading')
  const [inviteData, setInviteData] = useState<InviteData | null>(null)
  const [errorMsg, setErrorMsg]     = useState('')
  const [step, setStep]             = useState<Step>(1)
  const [done, setDone]             = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError]     = useState('')
  const [stepError, setStepError]         = useState('')
  const [showPwd, setShowPwd]             = useState(false)
  const [showConfirm, setShowConfirm]     = useState(false)
  const [previewData, setPreviewData]     = useState<PreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [customLv2, setCustomLv2]         = useState('')
  const [customA4, setCustomA4]           = useState('')
  const [customFiliere, setCustomFiliere] = useState('')
  const [customTech, setCustomTech]       = useState('')
  const [sousTypeTechnique, setSousTypeTechnique] = useState<'IND'|'STT'|'MIXTE'|''>('')
  const [cetifMode, setCetifMode]               = useState(false)
  const [sarMetiers, setSarMetiers]             = useState<string[]>([])
  const [cfmFilieres, setCfmFilieres]           = useState<string[]>([])
  const [maternelleSections, setMaternelleSections] = useState<string[]>(['Petite section','Moyenne section','Grande section'])
  const [nurseryLevels, setNurseryLevels]       = useState<string[]>(['PreNursery','Nursery 1','Nursery 2'])
  const [customSarMetier, setCustomSarMetier]   = useState('')
  const [customCfmFiliere, setCustomCfmFiliere] = useState('')
  const [enGradingSystem, setEnGradingSystem]   = useState<'OVER_20'|'OVER_100'|''>('')
  const [bulletinFrequency, setBulletinFrequency] = useState<'MONTHLY'|'TRIMESTRIAL'>('MONTHLY')
  const [evalSystemPrimaire, setEvalSystemPrimaire] = useState<'APC_300'|'NOTES_20'|''>('')
  const [appelFrequency, setAppelFrequency]     = useState<'TWICE'|'ONCE'|''>('')
  const [hasPEBSFrancophone, setHasPEBSFrancophone] = useState(false)
  const [hasPEBSAnglophone, setHasPEBSAnglophone]   = useState(false)
  const [enStreamStartLevel, setEnStreamStartLevel] = useState<'FORM4'|'FORM5'|'SIXTH'|''>('')
  const [bilingualEnLevels, setBilingualEnLevels]   = useState<string[]>([])
  const [bilingualEnFilieres, setBilingualEnFilieres] = useState<string[]>([])
  const [forcedTemplateCode, setForcedTemplateCode] = useState<string | null>(null)

  const [form, setForm] = useState<FormData>({
    nom: '', subdomain: '', subsystem: 'FRANCOPHONE', educationType: 'GENERAL',
    ownership: 'PRIVATE_SECULAR', ville: '', region: '', telephone: '', adresse: '',
    logoBase64: '',
    adminPrenom: '', adminNom: '', adminEmail: '', password: '', confirmPassword: '',
    niveaux1erCycle: [],
    classesParNiveau: {},
    conventionNommage: 'LETTRES',
    lv2Debut: 'NON_APPLICABLE',
    lv2Disponibles: [],
    niveaux2eCycle: [],
    filieres: [],
    a4Languages: [],
    classesParFiliere: '1',
    filieresTechniques: [],
    niveauxPrimaire: [],
    classesParNiveauPrimaire: {},
  })

  const template = forcedTemplateCode ? (TEMPLATE_META[forcedTemplateCode] ?? detectTemplate(form)) : detectTemplate(form)

  function setWithTemplateReset(k: 'subsystem' | 'educationType' | 'ownership') {
    return (v: string) => {
      setForcedTemplateCode(null)
      setForm(f => ({ ...f, [k]: v }))
    }
  }

  const set = (k: keyof FormData) => (v: string) => setForm(f => ({ ...f, [k]: v }))
  const slRef = useRef(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const previewTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1.5 * 1024 * 1024) { setStepError('Logo trop volumineux (max 1.5 MB).'); return }
    const reader = new FileReader()
    reader.onload = () => set('logoBase64')(reader.result as string)
    reader.readAsDataURL(file)
  }

  // Auto-generate subdomain from school name
  useEffect(() => {
    if (!slRef.current && form.nom) {
      setForm(f => ({ ...f, subdomain: toSlug(f.nom) }))
    }
  }, [form.nom])

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      const t = setTimeout(() => {
        setLoadState('invalid')
        setErrorMsg('Lien d\'invitation invalide ou incomplet.')
      }, 1000)
      return () => clearTimeout(t)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)

    fetch(`/api/v2/onboarding/invite/${token}`, {
      signal: controller.signal,
      headers: { 'ngrok-skip-browser-warning': '1' },
    })
      .then(r => {
        if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (data.success) {
          setInviteData(data.data)
          setForm(f => ({ ...f, nom: data.data.schoolName, adminEmail: data.data.email }))
          setLoadState('valid')
        } else {
          const msg: string = data.message ?? 'Invitation invalide.'
          if (msg.includes('expiré')) setLoadState('expired')
          else if (msg.includes('utilisée')) setLoadState('used')
          else setLoadState('invalid')
          setErrorMsg(msg)
        }
      })
      .catch((err) => {
        if (err?.name === 'AbortError') {
          setLoadState('invalid')
          setErrorMsg('La vérification a pris trop de temps. Vérifiez votre connexion et réessayez.')
        } else {
          setLoadState('invalid')
          setErrorMsg('Impossible de vérifier l\'invitation. Vérifiez votre connexion.')
        }
      })
      .finally(() => clearTimeout(timeout))
  }, [token])

  // Auto-ajouter/retirer ABI des filières quand PEBS Francophone change
  useEffect(() => {
    setForm(f => {
      const abiEntry = 'ABI — A Bilingue (Intensive English)';
      const hasABI = f.filieres.includes(abiEntry);
      if (hasPEBSFrancophone && !hasABI) {
        return { ...f, filieres: [...f.filieres, abiEntry] };
      }
      if (!hasPEBSFrancophone && hasABI) {
        return { ...f, filieres: f.filieres.filter(x => x !== abiEntry) };
      }
      return f;
    });
  }, [hasPEBSFrancophone])

  // Debounced preview fetch when configuration changes
  useEffect(() => {
    if (step !== 3) return
    clearTimeout(previewTimerRef.current)
    if (
      form.niveaux1erCycle.length === 0 && form.niveaux2eCycle.length === 0 &&
      form.niveauxPrimaire.length === 0
    ) {
      setPreviewData(null)
      return
    }
    previewTimerRef.current = setTimeout(() => {
      setPreviewLoading(true)
      const controller = new AbortController()
      fetch('/api/v2/onboarding/preview-structure', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1',
        },
        body: JSON.stringify({
          templateCode: template?.code,
          niveaux1erCycle: form.niveaux1erCycle,
          classesParNiveau: form.classesParNiveau,
          conventionNommage: form.conventionNommage,
          niveaux2eCycle: form.niveaux2eCycle,
          filieres: form.filieres,
          a4Languages: form.a4Languages,
          classesParFiliere: form.classesParFiliere,
          lv2Disponibles: form.lv2Disponibles,
          niveauxPrimaire: form.niveauxPrimaire,
          classesParNiveauPrimaire: form.classesParNiveauPrimaire,
        }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.success) setPreviewData(data.data)
        })
        .catch(() => {})
        .finally(() => setPreviewLoading(false))
    }, 600)
    return () => clearTimeout(previewTimerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    step, form.niveaux1erCycle, form.classesParNiveau, form.conventionNommage,
    form.niveaux2eCycle, form.filieres, form.a4Languages, form.classesParFiliere,
    form.lv2Disponibles, form.niveauxPrimaire, form.classesParNiveauPrimaire,
    template?.code,
  ])

  // Validate step 1
  function validateStep1(): string {
    if (!form.nom.trim())       return 'Le nom de l\'établissement est requis.'
    if (!form.subdomain.trim()) return 'Le sous-domaine est requis.'
    if (!/^[a-z0-9-]+$/.test(form.subdomain)) return 'Le sous-domaine ne peut contenir que des lettres minuscules, chiffres et tirets.'
    if (form.subdomain.length < 3) return 'Le sous-domaine doit faire au moins 3 caractères.'
    return ''
  }

  // Validate step 2
  function validateStep2(): string {
    if (!form.adminPrenom.trim()) return 'Le prénom est requis.'
    if (!form.adminNom.trim())    return 'Le nom de famille est requis.'
    if (!form.adminEmail.trim() || !form.adminEmail.includes('@')) return 'Adresse email invalide.'
    if (getPasswordStrength(form.password) < 5) return 'Le mot de passe ne respecte pas toutes les règles de sécurité (12 car., majuscule, minuscule, chiffre, caractère spécial).'
    if (form.password !== form.confirmPassword) return 'Les mots de passe ne correspondent pas.'
    return ''
  }

  // Validate step 3
  function validateStep3(): string {
    if (!template) return 'Impossible de détecter le type d\'établissement.'
    if (template.isComplexe) return 'Complexe Scolaire n\'est pas encore disponible. Revenez à l\'étape 1 et choisissez un autre type d\'enseignement.'
    if (template.hasPremierCycle && form.niveaux1erCycle.length === 0) return 'Veuillez sélectionner au moins un niveau du 1er cycle.'
    if (template.hasPremierCycle && Object.keys(form.classesParNiveau).length < form.niveaux1erCycle.length) return 'Veuillez indiquer le nombre de classes pour chaque niveau.'
    if (template.hasDeuxiemeCycle && form.niveaux2eCycle.length === 0) return 'Veuillez sélectionner au moins un niveau du 2e cycle.'
    if (template.hasDeuxiemeCycle && form.filieres.length === 0) return 'Veuillez sélectionner au moins une filière.'
    return ''
  }

  function goNext() {
    setStepError('')
    if (step === 1) {
      const err = validateStep1()
      if (err) { setStepError(err); return }
      setStep(2)
    } else if (step === 2) {
      const err = validateStep2()
      if (err) { setStepError(err); return }
      setStep(3)
    } else if (step === 3) {
      const err = validateStep3()
      if (err) { setStepError(err); return }
      setStep(4)
    }
  }

  async function handleSubmit() {
    setSubmitError('')
    setSubmitLoading(true)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      const url = `/api/v2/onboarding/invite/${token}/complete`
      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1',
        },
        body: JSON.stringify({
          nom: form.nom,
          subdomain: form.subdomain,
          adresse: form.adresse,
          ville: form.ville,
          region: form.region,
          telephone: form.telephone,
          logoBase64: form.logoBase64 || undefined,
          subsystem: form.subsystem,
          educationType: form.educationType,
          ownership: form.ownership,
          adminPrenom: form.adminPrenom,
          adminNom: form.adminNom,
          adminEmail: form.adminEmail,
          password: form.password,
          onboardingConfig: {
            templateCode: template?.code,
            niveaux1erCycle: form.niveaux1erCycle,
            classesParNiveau: form.classesParNiveau,
            conventionNommage: form.conventionNommage,
            lv2Debut: form.lv2Debut,
            lv2Disponibles: form.lv2Disponibles,
            niveaux2eCycle: form.niveaux2eCycle,
            filieres: form.filieres,
            a4Languages: form.a4Languages,
            classesParFiliere: form.classesParFiliere,
            filieresTechniques: form.filieresTechniques,
            niveauxPrimaire: form.niveauxPrimaire,
            classesParNiveauPrimaire: form.classesParNiveauPrimaire,
            sousTypeTechnique: sousTypeTechnique || undefined,
            cetifMode,
            sarMetiers: sarMetiers.length ? sarMetiers : undefined,
            enGradingSystem: enGradingSystem || undefined,
            bulletinFrequency,
            evalSystemPrimaire: evalSystemPrimaire || undefined,
            appelFrequency: appelFrequency || undefined,
            hasPEBSFrancophone,
            hasPEBSAnglophone,
            enStreamStartLevel: enStreamStartLevel || undefined,
            bilingualEnLevels: bilingualEnLevels.length ? bilingualEnLevels : undefined,
            bilingualEnFilieres: bilingualEnFilieres.length ? bilingualEnFilieres : undefined,
          },
        }),
      })
      clearTimeout(timeout)
      const text = await res.text()
      let data: any
      try { data = JSON.parse(text) } catch { throw new Error(`Réponse non-JSON (HTTP ${res.status}): ${text.slice(0, 100)}`) }
      if (!data.success) throw new Error(data.message || 'Erreur lors de la soumission.')
      setDone(true)
    } catch (e: any) {
      clearTimeout(timeout)
      const msg = e?.name === 'AbortError'
        ? 'La requête a pris trop de temps (>30s). Vérifiez votre connexion et réessayez.'
        : (e?.message || 'Erreur réseau. Vérifiez votre connexion et réessayez.')
      setSubmitError(msg)
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
    } finally {
      setSubmitLoading(false)
    }
  }

  function setNiveauCount(niveau: string, count: number) {
    setForm(f => ({ ...f, classesParNiveau: { ...f.classesParNiveau, [niveau]: count } }))
  }

  function setNiveauPrimaireCount(niveau: string, count: number) {
    setForm(f => ({ ...f, classesParNiveauPrimaire: { ...f.classesParNiveauPrimaire, [niveau]: count } }))
  }

  // ── Left panel (constant) ──────────────────────────────────────────────

  const LeftPanel = (
    <div style={{ width: '42vw', minWidth: 0, background: '#1a2e1e', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', flexShrink: 0 }} className="edu-left-panel">
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, zIndex: 2, background: 'repeating-linear-gradient(90deg,#f59e0b 0,#f59e0b 16px,#22c55e 16px,#22c55e 32px,#ef4444 32px,#ef4444 48px,#60a5fa 48px,#60a5fa 64px,#d4a843 64px,#d4a843 80px)' }} />
      <div style={{ position: 'absolute', bottom: -100, right: -100, width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle,rgba(34,197,94,0.06) 0%,transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ padding: '36px 32px', display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', zIndex: 1 }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 44, animation: 'edu-fadeDown 0.6s ease both' }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: 'linear-gradient(135deg,#f59e0b,#22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: '0 4px 16px rgba(34,197,94,0.3)', flexShrink: 0 }}>🎓</div>
          <div>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'white' }}>EduNexus</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Plateforme scolaire · Cameroun</div>
          </div>
        </div>

        {/* Heading */}
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 38, fontWeight: 700, lineHeight: 1.15, color: 'white', marginBottom: 12, animation: 'edu-fadeDown 0.6s 0.1s ease both' }}>
          {step <= 2 ? <>Bienvenue sur<br /><span style={{ color: '#4ade80' }}>EduNexus</span></>
            : step === 3 ? <>Configurez votre<br /><span style={{ color: '#4ade80' }}>structure scolaire</span></>
            : step === 4 ? <>Vérification<br /><span style={{ color: '#4ade80' }}>finale</span></>
            : <>Demande<br /><span style={{ color: '#4ade80' }}>soumise !</span></>}
        </div>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, fontWeight: 500, marginBottom: 36, animation: 'edu-fadeDown 0.6s 0.2s ease both' }}>
          {step === 1 ? 'Configurez votre espace scolaire en quelques minutes. Votre établissement sera opérationnel dès validation.'
            : step === 2 ? 'Créez votre compte administrateur pour accéder au tableau de bord.'
            : step === 3 ? 'Indiquez les détails de votre structure. Un récapitulatif sera généré automatiquement.'
            : step === 4 ? 'Vérifiez l\'ensemble des informations avant de soumettre votre dossier.'
            : 'Votre demande a été transmise à l\'équipe EduNexus.'}
        </p>

        {/* Plan badge */}
        {inviteData && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, marginBottom: 28, animation: 'edu-fadeDown 0.6s 0.25s ease both', alignSelf: 'flex-start' }}>
            <span style={{ fontSize: 18 }}>⭐</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: PLAN_COLOR[inviteData.plan] ?? '#059669' }}>Plan {PLAN_LABEL[inviteData.plan] ?? inviteData.plan}</span>
          </div>
        )}

        {/* Features */}
        {step <= 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'edu-fadeDown 0.6s 0.3s ease both' }}>
            {[
              { bg: 'rgba(34,197,94,0.1)',   icon: '🏫', title: 'Gestion multi-niveaux',      desc: 'Classes, sections, matières' },
              { bg: 'rgba(96,165,250,0.1)',   icon: '📊', title: 'Notes & bulletins',          desc: 'Calcul automatique, export PDF' },
              { bg: 'rgba(245,158,11,0.1)',   icon: '💳', title: 'Gestion financière',         desc: 'Frais, paiements, CampPay' },
              { bg: 'rgba(212,168,67,0.1)',   icon: '📅', title: 'Emplois du temps IA',        desc: 'Génération automatique' },
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{f.icon}</div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
                  <strong style={{ color: 'white', fontWeight: 700 }}>{f.title}</strong> — {f.desc}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: 16, fontSize: 13, color: 'rgba(255,255,255,0.2)', fontWeight: 500 }}>
          © 2026 EduNexus · Tous droits réservés
        </div>
      </div>
    </div>
  )

  // ── Stepper ────────────────────────────────────────────────────────────

  const STEPPER_LABELS: { n: Step; label: string }[] = [
    { n: 1, label: 'Établissement' },
    { n: 2, label: 'Administrateur' },
    { n: 3, label: 'Configuration' },
    { n: 4, label: 'Confirmation' },
  ]

  const Stepper = (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#6b5c45' }}>
          Étape {step} / {STEPPER_LABELS.length}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#a89478' }}>
          {STEPPER_LABELS.find(s => s.n === step)?.label ?? ''}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: '#e8e0d4', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(step / STEPPER_LABELS.length) * 100}%`, background: 'linear-gradient(90deg,#059669,#047857)', borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )

  // ── Right panel content ────────────────────────────────────────────────

  let content: React.ReactNode

  if (loadState === 'loading') {
    content = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '60px 0', animation: 'edu-fadeUp 0.4s ease both' }}>
        <div style={{ width: 52, height: 52, border: '4px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.8s linear infinite' }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: '#6b5c45' }}>Vérification de l&apos;invitation…</div>
      </div>
    )
  } else if (loadState === 'invalid' || loadState === 'expired' || loadState === 'used') {
    const info = {
      invalid:  { icon: '🔒', title: 'Lien invalide',          color: '#dc2626', bg: '#fef2f2', border: 'rgba(220,38,38,0.2)' },
      expired:  { icon: '⏰', title: 'Invitation expirée',     color: '#d97706', bg: '#fef3c7', border: 'rgba(217,119,6,0.2)' },
      used:     { icon: '✅', title: 'Invitation déjà utilisée', color: '#059669', bg: '#f0fdf4', border: 'rgba(5,150,105,0.2)' },
    }[loadState]
    content = (
      <div style={{ animation: 'edu-fadeUp 0.4s ease both', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>{info.icon}</div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209', marginBottom: 12 }}>{info.title}</div>
        <div style={{ padding: '16px 20px', background: info.bg, border: `1.5px solid ${info.border}`, borderRadius: 12, marginBottom: 24, fontSize: 15, fontWeight: 600, color: info.color, lineHeight: 1.6 }}>
          {errorMsg}
        </div>
        <p style={{ fontSize: 15, color: '#6b5c45', lineHeight: 1.7 }}>
          Pour obtenir de l&apos;aide, contactez votre administrateur EduNexus à <strong>support@edunexus.cm</strong>
        </p>
      </div>
    )
  } else if (done) {
    content = (
      <div style={{ animation: 'edu-fadeUp 0.4s ease both', textAlign: 'center' }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>🎉</div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 30, fontWeight: 700, color: '#1a1209', marginBottom: 10 }}>
          Demande soumise !
        </div>
        <div style={{ padding: '16px 20px', background: '#f0fdf4', border: '1.5px solid rgba(5,150,105,0.2)', borderRadius: 12, marginBottom: 24, fontSize: 15, fontWeight: 600, color: '#065f46', lineHeight: 1.8 }}>
          ✅ <strong>{form.nom}</strong> est en attente de validation par l&apos;équipe EduNexus.<br />
          Vous recevrez un email à <strong>{form.adminEmail}</strong> sous 24 à 48 heures.
        </div>
        <p style={{ fontSize: 15, color: '#6b5c45', lineHeight: 1.7 }}>
          Dès approbation, vous pourrez vous connecter avec votre email et mot de passe pour accéder à votre espace d&apos;administration.
        </p>
      </div>
    )
  } else {
    content = (
      <div style={{ animation: 'edu-fadeUp 0.35s ease both' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 26, fontWeight: 700, color: '#1a1209', marginBottom: 4 }}>
            {step === 1 ? 'Votre établissement' : step === 2 ? 'Votre compte administrateur' : step === 3 ? 'Configuration de votre structure' : 'Vérification finale'}
          </div>
          <div style={{ fontSize: 15, color: '#6b5c45', fontWeight: 500 }}>
            {step === 1 ? 'Renseignez les informations de votre école.' : step === 2 ? 'Créez votre compte pour accéder au dashboard.' : step === 3 ? 'Détaillez votre structure scolaire.' : 'Relisez avant de soumettre votre dossier.'}
          </div>
        </div>

        {step <= 4 && Stepper}

        {stepError && <Alert msg={stepError} type="error" />}

        {/* ── STEP 1 ──────────────────────────────── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <Field label="Nom de l'établissement" required>
              <input className="edu-field" value={form.nom} style={INPUT}
                onChange={e => set('nom')(e.target.value)} placeholder="Lycée de la Réussite" />
            </Field>

            <Field label="Sous-domaine (URL)" required>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 700, color: '#a89478' }}>edunexus.cm/</span>
                <input className="edu-field" value={form.subdomain} style={{ ...INPUT, paddingLeft: 106 }}
                  onChange={e => { slRef.current = true; set('subdomain')(toSlug(e.target.value)) }}
                  placeholder="lycee-reussite" />
              </div>
              <div style={{ fontSize: 12, color: '#a89478', marginTop: 4, fontWeight: 600 }}>
                Lettres minuscules, chiffres et tirets uniquement.
              </div>
            </Field>

            <Field label="Sous-système" required>
              <RadioCards options={SUBSYSTEM_OPTIONS} value={form.subsystem} onChange={setWithTemplateReset('subsystem')} />
            </Field>

            <Field label="Type d'enseignement" required>
              <RadioCards options={EDUCATION_OPTIONS} value={form.educationType} onChange={setWithTemplateReset('educationType')} />
            </Field>

            <Field label="Statut juridique" required>
              <RadioCards options={OWNERSHIP_OPTIONS} value={form.ownership} onChange={setWithTemplateReset('ownership')} />
            </Field>

            {/* Template détecté */}
            {template && (
              <div style={{
                padding: '12px 14px', background: 'rgba(5,150,105,0.06)',
                border: '1.5px solid rgba(5,150,105,0.2)', borderRadius: 12, marginBottom: 12,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#6b5c45', marginBottom: 4 }}>
                  🏫 Template d'établissement détecté
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#047857' }}>
                  {template.name}
                </div>

                {/* Discriminating question: CES_FR vs LYCEE_FR */}
                {form.subsystem === 'FRANCOPHONE' && form.educationType === 'GENERAL' && form.ownership === 'PUBLIC' && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(5,150,105,0.15)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#6b5c45', marginBottom: 6 }}>
                      🤔 Votre établissement est-il un CES (Collège) ou un Lycée ?
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[
                        { code: 'LYCEE_FR', label: '🏫 Lycée', desc: 'Avec 2nd cycle (2nde→Tle)' },
                        { code: 'CES_FR', label: '📖 CES (Collège)', desc: 'Sans 2nd cycle (6e→3e)' },
                      ].map(opt => {
                        const active = (forcedTemplateCode ?? template?.code) === opt.code
                        return (
                          <button key={opt.code} type="button" onClick={() => setForcedTemplateCode(opt.code)}
                            style={{
                              flex: 1, padding: '8px 10px', border: `2px solid ${active ? '#059669' : '#d4c8b8'}`,
                              borderRadius: 10, background: active ? 'rgba(5,150,105,0.07)' : 'white',
                              cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                              color: active ? '#047857' : '#6b5c45',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                            }}>
                            <span>{opt.label}</span>
                            <span style={{ fontSize: 11, color: '#a89478', fontWeight: 600 }}>{opt.desc}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Discriminating question: GHS_EN vs GSS_EN */}
                {form.subsystem === 'ANGLOPHONE' && form.educationType === 'GENERAL' && form.ownership === 'PUBLIC' && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(5,150,105,0.15)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#6b5c45', marginBottom: 6 }}>
                      🤔 Is your school a Government High School (GHS) or Government Secondary School (GSS)?
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[
                        { code: 'GHS_EN', label: 'GHS', desc: 'High School (Form 1→Upper Sixth)' },
                        { code: 'GSS_EN', label: 'GSS', desc: 'Secondary School (Form 1→Form 5)' },
                      ].map(opt => {
                        const active = (forcedTemplateCode ?? template?.code) === opt.code
                        return (
                          <button key={opt.code} type="button" onClick={() => setForcedTemplateCode(opt.code)}
                            style={{
                              flex: 1, padding: '8px 10px', border: `2px solid ${active ? '#059669' : '#d4c8b8'}`,
                              borderRadius: 10, background: active ? 'rgba(5,150,105,0.07)' : 'white',
                              cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                              color: active ? '#047857' : '#6b5c45',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                            }}>
                            <span>{opt.label}</span>
                            <span style={{ fontSize: 11, color: '#a89478', fontWeight: 600 }}>{opt.desc}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Ville">
                <input className="edu-field" value={form.ville} style={INPUT}
                  onChange={e => set('ville')(e.target.value)} placeholder="Yaoundé" />
              </Field>
              <Field label="Région">
                <select className="edu-field" value={form.region} style={{ ...INPUT, appearance: 'none', backgroundImage: 'none' }}
                  onChange={e => set('region')(e.target.value)}>
                  <option value="">— Sélectionner —</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Téléphone de l'établissement">
              <input className="edu-field" value={form.telephone} style={INPUT}
                onChange={e => set('telephone')(e.target.value)} placeholder="+237 6XX XXX XXX" />
            </Field>

            {/* Logo upload */}
            <Field label="Logo de l'établissement (facultatif)">
              <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Preview or placeholder */}
                <div onClick={() => logoInputRef.current?.click()}
                  style={{ width: 72, height: 72, borderRadius: 14, border: `2px dashed ${form.logoBase64 ? '#059669' : '#d4c8b8'}`, background: form.logoBase64 ? 'transparent' : '#f9f6f1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0, transition: 'all 0.15s' }}>
                  {form.logoBase64
                    ? <img src={form.logoBase64} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 28 }}>🏫</span>}
                </div>
                <div>
                  <button type="button" onClick={() => logoInputRef.current?.click()}
                    style={{ padding: '9px 16px', border: '1.5px solid #d4c8b8', borderRadius: 9, background: 'white', fontSize: 14, fontWeight: 700, color: '#6b5c45', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 6 }}>
                    {form.logoBase64 ? '🔄 Changer le logo' : '📤 Téléverser un logo'}
                  </button>
                  <div style={{ fontSize: 12, color: '#a89478', fontWeight: 600 }}>PNG, JPG, SVG · max 1.5 MB</div>
                  {form.logoBase64 && (
                    <button type="button" onClick={() => set('logoBase64')('')}
                      style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                      ✕ Supprimer
                    </button>
                  )}
                </div>
              </div>
            </Field>

            <SubmitBtn onClick={goNext}>Continuer → Compte administrateur</SubmitBtn>
          </div>
        )}

        {/* ── STEP 2 ──────────────────────────────── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <button type="button" onClick={() => { setStep(1); setStepError('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: '#a89478', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', marginBottom: 16, padding: 0 }}>
              ← Retour
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Prénom" required>
                <input className="edu-field" value={form.adminPrenom} style={INPUT}
                  onChange={e => set('adminPrenom')(e.target.value)} placeholder="Jean" />
              </Field>
              <Field label="Nom" required>
                <input className="edu-field" value={form.adminNom} style={INPUT}
                  onChange={e => set('adminNom')(e.target.value)} placeholder="Ngono" />
              </Field>
            </div>

            <Field label="Email administrateur" required>
              <input className="edu-field" type="email" value={form.adminEmail} style={INPUT}
                onChange={e => set('adminEmail')(e.target.value)} placeholder="admin@ecole.cm" />
              <div style={{ fontSize: 12, color: '#a89478', marginTop: 4, fontWeight: 600 }}>
                Cet email sera votre identifiant de connexion.
              </div>
            </Field>

            <Field label="Mot de passe" required>
              <div style={{ position: 'relative' }}>
                <input className="edu-field" type={showPwd ? 'text' : 'password'} value={form.password}
                  style={{ ...INPUT, paddingRight: 44 }}
                  onChange={e => set('password')(e.target.value)} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#a89478' }}>
                  {showPwd ? '🙈' : '👁'}
                </button>
              </div>
              {form.password && <PasswordStrengthBar password={form.password} />}
            </Field>

            <Field label="Confirmer le mot de passe" required>
              <div style={{ position: 'relative' }}>
                <input className="edu-field" type={showConfirm ? 'text' : 'password'} value={form.confirmPassword}
                  style={{ ...INPUT, paddingRight: 44, borderColor: form.confirmPassword && form.confirmPassword !== form.password ? '#dc2626' : '#d4c8b8' }}
                  onChange={e => set('confirmPassword')(e.target.value)} placeholder="••••••••" />
                <button type="button" onClick={() => setShowConfirm(s => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#a89478' }}>
                  {showConfirm ? '🙈' : '👁'}
                </button>
              </div>
              {form.confirmPassword && form.confirmPassword !== form.password && (
                <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4, fontWeight: 700 }}>⚠️ Les mots de passe ne correspondent pas.</div>
              )}
            </Field>

            <SubmitBtn onClick={goNext}>Continuer → Configuration</SubmitBtn>
          </div>
        )}

        {/* ── STEP 3 — Configuration ─────────────── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <button type="button" onClick={() => { setStep(2); setStepError('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: '#a89478', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', marginBottom: 14, padding: 0 }}>
              ← Retour
            </button>

            {/* Q4 — Template détecté */}
            {template && !template.isComplexe && (
              <div style={{
                padding: '14px 16px', background: 'rgba(5,150,105,0.06)',
                border: '1.5px solid rgba(5,150,105,0.2)', borderRadius: 12, marginBottom: 16,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#6b5c45', marginBottom: 4 }}>
                  🏫 Template détecté
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#047857' }}>
                  {template.name}
                </div>
                <div style={{ fontSize: 12, color: '#a89478', marginTop: 4 }}>
                  Détecté automatiquement d&apos;après vos choix (sous-système, enseignement, statut).
                  Vous pourrez modifier la configuration après activation depuis le tableau de bord.
                </div>
              </div>
            )}

            {template?.isComplexe && (
              <div style={{
                padding: '16px 18px', background: '#fef3c7',
                border: '1.5px solid rgba(217,119,6,0.25)', borderRadius: 12, marginBottom: 16,
              }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#92400e', marginBottom: 6 }}>
                  ⏳ Complexe Scolaire — Bientôt disponible
                </div>
                <div style={{ fontSize: 14, color: '#92400e', fontWeight: 600, lineHeight: 1.6 }}>
                  Ce type d&apos;établissement sera bientôt disponible.
                </div>
                <div style={{ fontSize: 13, color: '#a89478', marginTop: 8, fontWeight: 600 }}>
                  Pour continuer, veuillez sélectionner un autre type d&apos;enseignement à l&apos;étape 1
                  (Enseignement général au lieu de Mixte).
                </div>
              </div>
            )}

            {!template && (
              <Alert msg="Impossible de détecter le type d'établissement. Revenez à l'étape 1 et vérifiez vos choix." type="error" />
            )}

            {/* ── GROUPE A — 1er cycle (caché si COMPLEXE) ── */}
            {template && !template.isComplexe && template.hasPremierCycle && (
              <div style={{ marginTop: 4, marginBottom: 8 }}>
                <div style={{
                  fontSize: 15, fontWeight: 800, color: '#1a1209',
                  padding: '8px 0', borderBottom: '2px solid #059669', marginBottom: 14,
                }}>
                  📖 1er cycle — Secondaire
                </div>

                {/* Q5 — Niveaux */}
                <Field label="Q5 — Quels niveaux de 1er cycle avez-vous ?">
                  <CheckboxGroup
                    options={
                      form.educationType === 'TECHNICAL'
                        ? NIVEAUX_1ER_CYCLE_CAP.map(v => ({ value: v, label: v }))
                        : form.subsystem === 'ANGLOPHONE'
                          ? NIVEAUX_1ER_CYCLE_EN.map(v => ({ value: v, label: v }))
                          : NIVEAUX_1ER_CYCLE_FR.map(v => ({ value: v, label: v }))
                    }
                    values={form.niveaux1erCycle}
                    onChange={v => setForm(f => ({
                      ...f,
                      niveaux1erCycle: v,
                      classesParNiveau: v.reduce((acc, lvl) => ({
                        ...acc,
                        [lvl]: f.classesParNiveau[lvl] ?? 2,
                      }), {} as Record<string, number>),
                    }))}
                  />
                </Field>

                {/* Q6 — Nombre de classes par niveau */}
                {form.niveaux1erCycle.length > 0 && (
                  <Field label="Q6 — Combien de classes par niveau ?">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {form.niveaux1erCycle.map(niveau => (
                        <div key={niveau} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 50, fontSize: 14, fontWeight: 800, color: '#1a1209' }}>{niveau}</div>
                          <StepperBtns
                            value={form.classesParNiveau[niveau] ?? 2}
                            onChange={v => setNiveauCount(niveau, v)}
                          />
                        </div>
                      ))}
                    </div>
                  </Field>
                )}

                {/* Q7 — Convention de nommage */}
                <Field label="Q7 — Comment nommez-vous vos classes ?">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {CONVENTION_OPTIONS.map(opt => {
                      const active = form.conventionNommage === opt.value
                      return (
                        <label key={opt.value}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                            border: `2px solid ${active ? '#059669' : '#d4c8b8'}`,
                            borderRadius: 10, background: active ? 'rgba(5,150,105,0.07)' : 'white',
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}>
                          <input type="radio" name="convention" value={opt.value}
                            checked={active} onChange={() => set('conventionNommage')(opt.value)}
                            style={{ accentColor: '#059669' }} />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: active ? '#047857' : '#1a1209' }}>
                              {opt.label}
                            </div>
                            <div style={{ fontSize: 12, color: '#a89478', fontWeight: 600 }}>{opt.desc}</div>
                          </div>
                        </label>
                      )
                    })}
                  </div>

                  {/* Aperçu temps réel */}
                  {form.niveaux1erCycle.length > 0 && (
                    <div style={{
                      marginTop: 10, padding: '10px 14px', background: '#f9f6f1',
                      border: '1.5px solid #e8e0d4', borderRadius: 10,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#a89478', marginBottom: 4 }}>Aperçu de vos classes</div>
                      <ClassPreview
                        levels={form.niveaux1erCycle.map(l => ({ level: l, count: form.classesParNiveau[l] ?? 2 }))}
                        convention={form.conventionNommage}
                      />
                    </div>
                  )}
                </Field>

                {/* Q8 — LV2 début (si 4e ou 3e présent) */}
                {(form.niveaux1erCycle.includes('4e') || form.niveaux1erCycle.includes('3e')) && (
                  <Field label="Q8 — La LV2 commence à partir de ?">
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['4e', '3e', 'NON_APPLICABLE'].map(opt => (
                        <button key={opt} type="button" onClick={() => set('lv2Debut')(opt)}
                          style={{
                            flex: 1, padding: '10px 8px', border: `2px solid ${form.lv2Debut === opt ? '#059669' : '#d4c8b8'}`,
                            borderRadius: 10, background: form.lv2Debut === opt ? 'rgba(5,150,105,0.07)' : 'white',
                            cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                            color: form.lv2Debut === opt ? '#047857' : '#6b5c45',
                          }}>
                          {opt === 'NON_APPLICABLE' ? 'Non applicable' : `À partir de la ${opt}`}
                        </button>
                      ))}
                    </div>
                  </Field>
                )}

                {/* Q9 — LV2 disponibles (si Q8 ≠ NON_APPLICABLE) */}
                {form.lv2Debut !== 'NON_APPLICABLE' && form.lv2Debut !== '' && (
                  <Field label="Q9 — Quelles langues vivantes 2 proposez-vous ?">
                    <CheckboxGroup
                      options={LV2_OPTIONS.map(v => ({ value: v, label: v }))}
                      values={form.lv2Disponibles}
                      onChange={v => setForm(f => ({ ...f, lv2Disponibles: v }))}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#6b5c45' }}>Autre :</span>
                      <input className="edu-field" value={customLv2}
                        style={{ ...INPUT, padding: '7px 12px', fontSize: 14, maxWidth: 180 }}
                        onChange={e => setCustomLv2(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && customLv2.trim() && !form.lv2Disponibles.includes(customLv2.trim())) {
                            setForm(f => ({ ...f, lv2Disponibles: [...f.lv2Disponibles, customLv2.trim()] }))
                            setCustomLv2('')
                          }
                        }}
                        placeholder="Tapez et Entrée" />
                      <button type="button" onClick={() => {
                        if (customLv2.trim() && !form.lv2Disponibles.includes(customLv2.trim())) {
                          setForm(f => ({ ...f, lv2Disponibles: [...f.lv2Disponibles, customLv2.trim()] }))
                          setCustomLv2('')
                        }
                      }}
                        style={{
                          padding: '7px 12px', background: '#059669', color: 'white', border: 'none',
                          borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                        + Ajouter
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: '#a89478', marginTop: 6, fontWeight: 600, lineHeight: 1.5 }}>
                      💡 Si des élèves de LV2 différentes sont dans la même classe, ne cochez que les langues disponibles. Vous pourrez configurer les sous-groupes depuis votre tableau de bord.
                    </div>
                  </Field>
                )}
              </div>
            )}

            {/* ── GROUPE B — 2e cycle ── */}
            {template && !template.isComplexe && template.code === 'CES_FR' && (
              <div style={{ marginTop: 8, marginBottom: 8 }}>
                <Alert msg="ℹ️ Le CES n'a que le 1er cycle (6e→3e). Les filières du 2e cycle ne s'appliquent pas." type="info" />
              </div>
            )}
            {template && !template.isComplexe && template.hasDeuxiemeCycle && template.code !== 'CES_FR' && (
              <div style={{ marginTop: 8, marginBottom: 8 }}>
                <div style={{
                  fontSize: 15, fontWeight: 800, color: '#1a1209',
                  padding: '8px 0', borderBottom: '2px solid #2563eb', marginBottom: 14,
                }}>
                  {['GHS_EN','GSS_EN','PRIVE_EN'].includes(template.code ?? '') ? '🎓 Upper Secondary' : '🎓 2e cycle — Lycée'}
                </div>

                {/* GSS_EN — O-Level only notice */}
                {template.code === 'GSS_EN' && (
                  <Alert msg="ℹ️ GSS_EN stops at Form 5 — GCE O-Level only. Lower Sixth and Upper Sixth are not applicable." type="info" />
                )}

                {/* Q10 — Niveaux 2e cycle */}
                {['GHS_EN','GSS_EN','PRIVE_EN'].includes(template.code ?? '') ? (
                  <Field label="Q10 — Which levels do you have?">
                    <CheckboxGroup
                      options={(
                        template.code === 'GSS_EN'
                          ? ['Form 4','Form 5']
                          : ['Form 4','Form 5','Lower Sixth','Upper Sixth']
                      ).map(v => ({ value: v, label: v }))}
                      values={form.niveaux2eCycle}
                      onChange={v => setForm(f => ({ ...f, niveaux2eCycle: v }))}
                    />
                  </Field>
                ) : (
                  <Field label="Q10 — Quels niveaux de 2e cycle avez-vous ?">
                    <CheckboxGroup
                      options={
                        form.subsystem === 'ANGLOPHONE'
                          ? NIVEAUX_2E_CYCLE_EN.map(v => ({ value: v, label: v }))
                          : NIVEAUX_2E_CYCLE_FR.map(v => ({ value: v, label: v }))
                      }
                      values={form.niveaux2eCycle}
                      onChange={v => setForm(f => ({ ...f, niveaux2eCycle: v }))}
                    />
                  </Field>
                )}

                {/* Q11 — Filières (FR) ou Streams (EN) */}
                {form.niveaux2eCycle.length > 0 && (
                  ['GHS_EN','GSS_EN','PRIVE_EN'].includes(template.code ?? '') ? (
                    <div>
                      <Field label="Q11 — Which streams do you offer?">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#6b5c45', marginBottom: 4 }}>Arts</div>
                            <CheckboxGroup
                              options={FILIERES_EN_ARTS.map(v => ({ value: v, label: v }))}
                              values={form.filieres}
                              onChange={v => setForm(f => ({ ...f, filieres: v }))}
                            />
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#6b5c45', marginBottom: 4 }}>Sciences</div>
                            <CheckboxGroup
                              options={FILIERES_EN_SCIENCES.map(v => ({ value: v, label: v }))}
                              values={form.filieres}
                              onChange={v => setForm(f => ({ ...f, filieres: v }))}
                            />
                          </div>
                        </div>
                      </Field>
                      {template.code !== 'GSS_EN' && (
                        <Field label="From which level do streams start?">
                          <div style={{ display: 'flex', gap: 8 }}>
                            {([
                              { value: 'FORM4', label: 'Form 4' },
                              { value: 'FORM5', label: 'Form 5' },
                              { value: 'SIXTH', label: 'Lower Sixth only' },
                            ] as const).map(opt => (
                              <button key={opt.value} type="button" onClick={() => setEnStreamStartLevel(opt.value)}
                                style={{
                                  flex: 1, padding: '10px 8px', border: `2px solid ${enStreamStartLevel === opt.value ? '#059669' : '#d4c8b8'}`,
                                  borderRadius: 10, background: enStreamStartLevel === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                                  color: enStreamStartLevel === opt.value ? '#047857' : '#6b5c45',
                                }}>
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </Field>
                      )}
                      <Field label="Grading system:">
                        <div style={{ display: 'flex', gap: 8 }}>
                          {([
                            { value: 'OVER_20',  label: 'Marks out of 20' },
                            { value: 'OVER_100', label: 'Marks out of 100' },
                          ] as const).map(opt => (
                            <button key={opt.value} type="button" onClick={() => setEnGradingSystem(opt.value)}
                              style={{
                                flex: 1, padding: '10px 8px', border: `2px solid ${enGradingSystem === opt.value ? '#059669' : '#d4c8b8'}`,
                                borderRadius: 10, background: enGradingSystem === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                                cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                                color: enGradingSystem === opt.value ? '#047857' : '#6b5c45',
                              }}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </Field>
                    </div>
                  ) : (
                    <Field label="Q11 — Quelles filières proposez-vous ?">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b5c45', marginBottom: 4 }}>Section Littéraire</div>
                          <CheckboxGroup
                            options={FILIERES_LITT.map(v => ({ value: v, label: v }))}
                            values={form.filieres}
                            onChange={v => setForm(f => ({ ...f, filieres: v }))}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b5c45', marginBottom: 4 }}>Section Scientifique</div>
                          <CheckboxGroup
                            options={FILIERES_SCIENT.map(v => ({ value: v, label: v }))}
                            values={form.filieres}
                            onChange={v => setForm(f => ({ ...f, filieres: v }))}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b5c45', marginBottom: 4 }}>Section Technique</div>
                          <CheckboxGroup
                            options={FILIERES_TECH.map(v => ({ value: v, label: v }))}
                            values={form.filieres}
                            onChange={v => setForm(f => ({ ...f, filieres: v }))}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b5c45', marginBottom: 4 }}>Autre filière</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input className="edu-field" value={customFiliere}
                              style={{ ...INPUT, padding: '7px 12px', fontSize: 14, maxWidth: 250 }}
                              onChange={e => setCustomFiliere(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && customFiliere.trim() && !form.filieres.includes(customFiliere.trim())) {
                                  setForm(f => ({ ...f, filieres: [...f.filieres, customFiliere.trim()] }))
                                  setCustomFiliere('')
                                }
                              }}
                              placeholder="Tapez et Entrée" />
                            <button type="button" onClick={() => {
                              if (customFiliere.trim() && !form.filieres.includes(customFiliere.trim())) {
                                setForm(f => ({ ...f, filieres: [...f.filieres, customFiliere.trim()] }))
                                setCustomFiliere('')
                              }
                            }}
                              style={{ padding: '7px 12px', background: '#059669', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                              + Ajouter
                            </button>
                          </div>
                        </div>
                      </div>
                    </Field>
                  )
                )}

                {/* Q12 — Langues A4 (si A4 coché, FR uniquement) */}
                {!['GHS_EN','GSS_EN','PRIVE_EN'].includes(template.code ?? '') && form.filieres.some(f => f.startsWith('A4') || f.includes('A4')) && (
                  <Field label="Q12 — Quelles langues pour la série A4 ?">
                    <CheckboxGroup
                      options={LV2_OPTIONS.map(v => ({ value: v, label: v }))}
                      values={form.a4Languages}
                      onChange={v => setForm(f => ({ ...f, a4Languages: v }))}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#6b5c45' }}>Autre :</span>
                      <input className="edu-field" value={customA4}
                        style={{ ...INPUT, padding: '7px 12px', fontSize: 14, maxWidth: 180 }}
                        onChange={e => setCustomA4(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && customA4.trim() && !form.a4Languages.includes(customA4.trim())) {
                            setForm(f => ({ ...f, a4Languages: [...f.a4Languages, customA4.trim()] }))
                            setCustomA4('')
                          }
                        }}
                        placeholder="Tapez et Entrée" />
                      <button type="button" onClick={() => {
                        if (customA4.trim() && !form.a4Languages.includes(customA4.trim())) {
                          setForm(f => ({ ...f, a4Languages: [...f.a4Languages, customA4.trim()] }))
                          setCustomA4('')
                        }
                      }}
                        style={{ padding: '7px 12px', background: '#059669', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        + Ajouter
                      </button>
                    </div>
                  </Field>
                )}

                {/* Q13 — Classes par filière (FR uniquement) */}
                {!['GHS_EN','GSS_EN','PRIVE_EN'].includes(template.code ?? '') && form.filieres.length > 0 && (
                  <Field label="Q13 — En général, combien de classes par filière ?">
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[
                        { value: '1', label: '1 classe' },
                        { value: '2', label: '2 classes' },
                        { value: '3+', label: '3 classes+' },
                      ].map(opt => (
                        <button key={opt.value} type="button" onClick={() => set('classesParFiliere')(opt.value)}
                          style={{
                            flex: 1, padding: '10px 8px', border: `2px solid ${form.classesParFiliere === opt.value ? '#059669' : '#d4c8b8'}`,
                            borderRadius: 10, background: form.classesParFiliere === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                            cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                            color: form.classesParFiliere === opt.value ? '#047857' : '#6b5c45',
                          }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {form.a4Languages.length > 0 && (
                      <div style={{ fontSize: 12, color: '#a89478', marginTop: 6, fontWeight: 600 }}>
                        Pour les filières A4, une classe sera créée par langue sélectionnée en Q12.
                      </div>
                    )}
                  </Field>
                )}

                {/* PEBS — Programme d'Éducation Bilingue Spécial */}
                {template.code && TCODES_PEBS_FR.includes(template.code) && (
                  <Field label="Programme d'Éducation Bilingue Spécial (PEBS) — Francophone">
                    <div style={{ display: 'flex', gap: 8 }}>
                      {([{ v: true, l: 'Oui' }, { v: false, l: 'Non' }]).map(opt => (
                        <button key={String(opt.v)} type="button" onClick={() => setHasPEBSFrancophone(opt.v)}
                          style={{
                            flex: 1, padding: '10px 8px', border: `2px solid ${hasPEBSFrancophone === opt.v ? '#059669' : '#d4c8b8'}`,
                            borderRadius: 10, background: hasPEBSFrancophone === opt.v ? 'rgba(5,150,105,0.07)' : 'white',
                            cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                            color: hasPEBSFrancophone === opt.v ? '#047857' : '#6b5c45',
                          }}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                    {hasPEBSFrancophone && (
                      <div style={{ fontSize: 12, color: '#a89478', marginTop: 6, fontWeight: 600 }}>
                        La série ABI sera automatiquement activée au second cycle (continuation du PEBS).
                      </div>
                    )}
                  </Field>
                )}
                {template.code && TCODES_PEBS_EN.includes(template.code) && (
                  <Field label="Programme d'Éducation Bilingue Spécial (PEBS) — Anglophone">
                    <div style={{ display: 'flex', gap: 8 }}>
                      {([{ v: true, l: 'Yes' }, { v: false, l: 'No' }]).map(opt => (
                        <button key={String(opt.v)} type="button" onClick={() => setHasPEBSAnglophone(opt.v)}
                          style={{
                            flex: 1, padding: '10px 8px', border: `2px solid ${hasPEBSAnglophone === opt.v ? '#059669' : '#d4c8b8'}`,
                            borderRadius: 10, background: hasPEBSAnglophone === opt.v ? 'rgba(5,150,105,0.07)' : 'white',
                            cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                            color: hasPEBSAnglophone === opt.v ? '#047857' : '#6b5c45',
                          }}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </Field>
            )}

              </div>
            )}

            {/* ── LYCEE_BILINGUE — Section Anglophone ── */}
            {template && template.code === 'LYCEE_BILINGUE' && (
              <div style={{ marginTop: 8, marginBottom: 8 }}>
                <div style={{
                  fontSize: 15, fontWeight: 800, color: '#1a1209',
                  padding: '8px 0', borderBottom: '2px solid #2563eb', marginBottom: 14,
                }}>
                  🏴󠁧󠁢󠁥󠁮󠁧󠁿 Configuration Section Anglophone
                </div>
                <Field label="Levels (Anglophone):">
                  <CheckboxGroup
                    options={NIVEAUX_EN_FULL.map(v => ({ value: v, label: v }))}
                    values={bilingualEnLevels}
                    onChange={setBilingualEnLevels}
                  />
                </Field>
                {bilingualEnLevels.length > 0 && (
                  <Field label="Streams (Anglophone):">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#6b5c45', marginBottom: 4 }}>Arts</div>
                        <CheckboxGroup
                          options={FILIERES_EN_ARTS.map(v => ({ value: v, label: v }))}
                          values={bilingualEnFilieres}
                          onChange={setBilingualEnFilieres}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#6b5c45', marginBottom: 4 }}>Sciences</div>
                        <CheckboxGroup
                          options={FILIERES_EN_SCIENCES.map(v => ({ value: v, label: v }))}
                          values={bilingualEnFilieres}
                          onChange={setBilingualEnFilieres}
                        />
                      </div>
                    </div>
                  </Field>
                )}
                <Field label="Grading system (Anglophone):">
                  <div style={{ display: 'flex', gap: 8 }}>
                    {([
                      { value: 'OVER_20',  label: 'Marks out of 20' },
                      { value: 'OVER_100', label: 'Marks out of 100' },
                    ] as const).map(opt => (
                      <button key={opt.value} type="button" onClick={() => setEnGradingSystem(opt.value)}
                        style={{
                          flex: 1, padding: '10px 8px', border: `2px solid ${enGradingSystem === opt.value ? '#059669' : '#d4c8b8'}`,
                          borderRadius: 10, background: enGradingSystem === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                          cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                          color: enGradingSystem === opt.value ? '#047857' : '#6b5c45',
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            )}

            {/* ── GROUPE C — Technique (caché si COMPLEXE) ── */}
            {template && !template.isComplexe && template.isTechnique && (
              <div style={{ marginTop: 8, marginBottom: 8 }}>
                <div style={{
                  fontSize: 15, fontWeight: 800, color: '#1a1209',
                  padding: '8px 0', borderBottom: '2px solid #d97706', marginBottom: 14,
                }}>
                  ⚙️ Filières techniques
                </div>

                {/* SAR_SM — formulaire minimal métiers */}
                {template.code === 'SAR_SM' && (
                  <div>
                    <div style={{ padding: '10px 14px', background: '#fef3c7', border: '1.5px solid #fcd34d', borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                      🏛️ SAR/SM sous tutelle MINEFOP
                    </div>
                    <Field label="Métiers pratiqués :">
                      <CheckboxGroup
                        options={['Maçonnerie','Menuiserie','Couture','Cuisine','Agriculture','Mécanique'].map(v => ({ value: v, label: v }))}
                        values={sarMetiers}
                        onChange={setSarMetiers}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#6b5c45' }}>Autre :</span>
                        <input className="edu-field" value={customSarMetier}
                          style={{ ...INPUT, padding: '7px 12px', fontSize: 14, maxWidth: 220 }}
                          onChange={e => setCustomSarMetier(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && customSarMetier.trim() && !sarMetiers.includes(customSarMetier.trim())) {
                              setSarMetiers(m => [...m, customSarMetier.trim()]); setCustomSarMetier('')
                            }
                          }}
                          placeholder="Tapez et Entrée" />
                        <button type="button" onClick={() => {
                          if (customSarMetier.trim() && !sarMetiers.includes(customSarMetier.trim())) {
                            setSarMetiers(m => [...m, customSarMetier.trim()]); setCustomSarMetier('')
                          }
                        }}
                          style={{ padding: '7px 12px', background: '#059669', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          + Ajouter
                        </button>
                      </div>
                    </Field>
                    <div style={{ fontSize: 13, color: '#a89478', fontWeight: 600, marginTop: 4 }}>
                      ℹ️ Année 1 et Année 2 créées automatiquement
                    </div>
                  </div>
                )}

                {/* CFM — formulaire minimal filières */}
                {template.code === 'CFM' && (
                  <div>
                    <Field label="Filières de formation :">
                      <CheckboxGroup
                        options={['Agro-alimentaire','Artisanat','BTP','Numérique'].map(v => ({ value: v, label: v }))}
                        values={cfmFilieres}
                        onChange={setCfmFilieres}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#6b5c45' }}>Autre :</span>
                        <input className="edu-field" value={customCfmFiliere}
                          style={{ ...INPUT, padding: '7px 12px', fontSize: 14, maxWidth: 220 }}
                          onChange={e => setCustomCfmFiliere(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && customCfmFiliere.trim() && !cfmFilieres.includes(customCfmFiliere.trim())) {
                              setCfmFilieres(m => [...m, customCfmFiliere.trim()]); setCustomCfmFiliere('')
                            }
                          }}
                          placeholder="Tapez et Entrée" />
                        <button type="button" onClick={() => {
                          if (customCfmFiliere.trim() && !cfmFilieres.includes(customCfmFiliere.trim())) {
                            setCfmFilieres(m => [...m, customCfmFiliere.trim()]); setCustomCfmFiliere('')
                          }
                        }}
                          style={{ padding: '7px 12px', background: '#059669', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          + Ajouter
                        </button>
                      </div>
                    </Field>
                    <div style={{ fontSize: 13, color: '#a89478', fontWeight: 600, marginTop: 4 }}>
                      ℹ️ Niveaux 1, 2 et 3 créés automatiquement
                    </div>
                  </div>
                )}

                {/* LYCEE_TECHNIQUE_FR — Q_TECH + Q14 filtré */}
                {template.code === 'LYCEE_TECHNIQUE_FR' && (
                  <div>
                    <Field label="Type de lycée technique :">
                      <div style={{ display: 'flex', gap: 8 }}>
                        {([
                          { value: 'IND',   label: 'Industriel (IND)',  desc: 'Filières F' },
                          { value: 'STT',   label: 'Tertiaire (STT)',   desc: 'Filières G' },
                          { value: 'MIXTE', label: 'Mixte IND + STT',   desc: 'Toutes filières' },
                        ] as const).map(opt => (
                          <button key={opt.value} type="button" onClick={() => setSousTypeTechnique(opt.value)}
                            style={{
                              flex: 1, padding: '10px 6px', border: `2px solid ${sousTypeTechnique === opt.value ? '#059669' : '#d4c8b8'}`,
                              borderRadius: 10, background: sousTypeTechnique === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                              cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                              color: sousTypeTechnique === opt.value ? '#047857' : '#6b5c45',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                            }}>
                            <span>{opt.label}</span>
                            <span style={{ fontSize: 11, color: '#a89478', fontWeight: 600 }}>{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </Field>
                    {sousTypeTechnique && (
                      <Field label="Q14 — Filières disponibles :">
                        <CheckboxGroup
                          options={(
                            sousTypeTechnique === 'IND' ? FILIERES_TECHNIQUES_OFF.filter(f => f.startsWith('F'))
                            : sousTypeTechnique === 'STT' ? FILIERES_TECHNIQUES_OFF.filter(f => f.startsWith('G'))
                            : FILIERES_TECHNIQUES_OFF
                          ).map(v => ({ value: v, label: v }))}
                          values={form.filieresTechniques}
                          onChange={v => setForm(f => ({ ...f, filieresTechniques: v }))}
                        />
                      </Field>
                    )}
                  </div>
                )}

                {/* CETIC — toggle CETIF + filières spécifiques */}
                {template.code === 'CETIC' && (
                  <div>
                    <Field label="Type :">
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[
                          { val: false, label: 'Général',            desc: 'CETIC standard' },
                          { val: true,  label: 'Pour Filles (CETIF)', desc: 'ESF, Couture…' },
                        ].map((opt, i) => (
                          <button key={i} type="button" onClick={() => setCetifMode(opt.val)}
                            style={{
                              flex: 1, padding: '10px 6px', border: `2px solid ${cetifMode === opt.val ? '#059669' : '#d4c8b8'}`,
                              borderRadius: 10, background: cetifMode === opt.val ? 'rgba(5,150,105,0.07)' : 'white',
                              cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                              color: cetifMode === opt.val ? '#047857' : '#6b5c45',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                            }}>
                            <span>{opt.label}</span>
                            <span style={{ fontSize: 11, color: '#a89478', fontWeight: 600 }}>{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </Field>
                    {cetifMode ? (
                      <Field label="Filières CETIF :">
                        <CheckboxGroup
                          options={['ESF','Couture','Hôtellerie','Cuisine'].map(v => ({ value: v, label: v }))}
                          values={form.filieresTechniques}
                          onChange={v => setForm(f => ({ ...f, filieresTechniques: v }))}
                        />
                      </Field>
                    ) : (
                      <Field label="Q14 — Filières techniques :">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#6b5c45', marginBottom: 4 }}>
                              Options officielles MINESEC
                      </div>
                      <CheckboxGroup
                        options={FILIERES_TECHNIQUES_OFF.map(v => ({ value: v, label: v }))}
                        values={form.filieresTechniques}
                        onChange={v => setForm(f => ({ ...f, filieresTechniques: v }))}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#6b5c45', marginBottom: 4 }}>
                        Options terrain confirmées
                      </div>
                      <CheckboxGroup
                        options={FILIERES_TECHNIQUES_TER.map(v => ({ value: v, label: v }))}
                        values={form.filieresTechniques}
                        onChange={v => setForm(f => ({ ...f, filieresTechniques: v }))}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#6b5c45', marginBottom: 4 }}>Autre</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input className="edu-field" value={customTech}
                          style={{ ...INPUT, padding: '7px 12px', fontSize: 14, maxWidth: 250 }}
                          onChange={e => setCustomTech(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && customTech.trim() && !form.filieresTechniques.includes(customTech.trim())) {
                              setForm(f => ({ ...f, filieresTechniques: [...f.filieresTechniques, customTech.trim()] }))
                              setCustomTech('')
                            }
                          }}
                          placeholder="Tapez et Entrée" />
                        <button type="button" onClick={() => {
                          if (customTech.trim() && !form.filieresTechniques.includes(customTech.trim())) {
                            setForm(f => ({ ...f, filieresTechniques: [...f.filieresTechniques, customTech.trim()] }))
                            setCustomTech('')
                          }
                        }}
                          style={{
                            padding: '7px 12px', background: '#059669', color: 'white', border: 'none',
                            borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                          }}>
                          + Ajouter
                        </button>
                      </div>
                    </div>
                  </div>
                      </Field>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── GROUPE D — Primaire (caché si COMPLEXE) ── */}
            {template && !template.isComplexe && template.isPrimaire && (
              <div style={{ marginTop: 8, marginBottom: 8 }}>
                <div style={{
                  fontSize: 15, fontWeight: 800, color: '#1a1209',
                  padding: '8px 0', borderBottom: '2px solid #d4a843', marginBottom: 14,
                }}>
                  🏫 Primaire & Maternelle
                </div>

                {/* MATERNELLE_FR — formulaire simplifié */}
                {template.code === 'MATERNELLE_FR' && (
                  <div>
                    <Field label="Sections présentes :">
                      <CheckboxGroup
                        options={['Petite section','Moyenne section','Grande section'].map(v => ({ value: v, label: v }))}
                        values={maternelleSections}
                        onChange={setMaternelleSections}
                      />
                    </Field>
                    <div style={{ fontSize: 13, color: '#a89478', fontWeight: 600, marginTop: 4 }}>
                      ℹ️ Évaluation par observations — pas de notes numériques
                    </div>
                  </div>
                )}

                {/* NURSERY_EN — formulaire simplifié */}
                {template.code === 'NURSERY_EN' && (
                  <div>
                    <Field label="Levels present:">
                      <CheckboxGroup
                        options={['PreNursery','Nursery 1','Nursery 2'].map(v => ({ value: v, label: v }))}
                        values={nurseryLevels}
                        onChange={setNurseryLevels}
                      />
                    </Field>
                    <div style={{ fontSize: 13, color: '#a89478', fontWeight: 600, marginTop: 4 }}>
                      ℹ️ Assessment by observations — no numeric grades
                    </div>
                  </div>
                )}

                {/* PRIMARY_BILINGUAL — double bloc FR + EN */}
                {template.code === 'PRIMARY_BILINGUAL' && (
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#1a1209', marginBottom: 10 }}>🇫🇷 Section Francophone</div>
                    <Field label="Niveaux (Francophone) :">
                      <CheckboxGroup
                        options={NIVEAUX_PRIMAIRE_FR.map(v => ({ value: v, label: v }))}
                        values={form.niveauxPrimaire}
                        onChange={v => setForm(f => ({
                          ...f,
                          niveauxPrimaire: v,
                          classesParNiveauPrimaire: v.reduce((acc, lvl) => ({
                            ...acc,
                            [lvl]: f.classesParNiveauPrimaire[lvl] ?? 2,
                          }), {} as Record<string, number>),
                        }))}
                      />
                    </Field>
                    <Field label="Système d'évaluation (FR) :">
                      <div style={{ display: 'flex', gap: 8 }}>
                        {([
                          { value: 'APC_300', label: 'APC 300 points' },
                          { value: 'NOTES_20', label: 'Notes /20' },
                        ] as const).map(opt => (
                          <button key={opt.value} type="button" onClick={() => setEvalSystemPrimaire(opt.value)}
                            style={{
                              flex: 1, padding: '10px 8px', border: `2px solid ${evalSystemPrimaire === opt.value ? '#059669' : '#d4c8b8'}`,
                              borderRadius: 10, background: evalSystemPrimaire === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                              cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                              color: evalSystemPrimaire === opt.value ? '#047857' : '#6b5c45',
                            }}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Fréquence de l'appel (FR) :">
                      <div style={{ display: 'flex', gap: 8 }}>
                        {([
                          { value: 'TWICE', label: '2 fois/jour (matin + après-midi)' },
                          { value: 'ONCE', label: '1 fois/jour' },
                        ] as const).map(opt => (
                          <button key={opt.value} type="button" onClick={() => setAppelFrequency(opt.value)}
                            style={{
                              flex: 1, padding: '10px 8px', border: `2px solid ${appelFrequency === opt.value ? '#059669' : '#d4c8b8'}`,
                              borderRadius: 10, background: appelFrequency === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                              cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                              color: appelFrequency === opt.value ? '#047857' : '#6b5c45',
                            }}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </Field>

                    <div style={{ borderTop: '1.5px solid #e8e0d4', margin: '14px 0' }} />
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#1a1209', marginBottom: 10 }}>🏴󠁧󠁢󠁥󠁮󠁧󠁿 Section Anglophone</div>
                    <Field label="Levels (Anglophone):">
                      <CheckboxGroup
                        options={NIVEAUX_PRIMAIRE_EN.map(v => ({ value: v, label: v }))}
                        values={bilingualEnLevels}
                        onChange={setBilingualEnLevels}
                      />
                    </Field>
                    <Field label="Report card frequency:">
                      <div style={{ display: 'flex', gap: 8 }}>
                        {([
                          { value: 'MONTHLY', label: 'Monthly (standard)' },
                          { value: 'TRIMESTRIAL', label: 'Per term' },
                        ] as const).map(opt => (
                          <button key={opt.value} type="button" onClick={() => setBulletinFrequency(opt.value)}
                            style={{
                              flex: 1, padding: '10px 8px', border: `2px solid ${bulletinFrequency === opt.value ? '#059669' : '#d4c8b8'}`,
                              borderRadius: 10, background: bulletinFrequency === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                              cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                              color: bulletinFrequency === opt.value ? '#047857' : '#6b5c45',
                            }}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </Field>
                  </div>
                )}

                {/* Q15/Q16 — formulaire standard primaire (PRIMAIRE_FR, PRIMARY_EN) */}
                {template.code !== 'MATERNELLE_FR' && template.code !== 'NURSERY_EN' && template.code !== 'PRIMARY_BILINGUAL' && (
                  <div>
                    {/* PRIMAIRE_FR — évaluation + appel */}
                    {template.code === 'PRIMAIRE_FR' && (
                      <div style={{ marginBottom: 8 }}>
                        <Field label="Système d'évaluation :">
                          <div style={{ display: 'flex', gap: 8 }}>
                            {([
                              { value: 'APC_300', label: 'APC 300 points', desc: 'standard public' },
                              { value: 'NOTES_20', label: 'Notes /20', desc: 'certains privés' },
                            ] as const).map(opt => (
                              <button key={opt.value} type="button" onClick={() => setEvalSystemPrimaire(opt.value)}
                                style={{
                                  flex: 1, padding: '10px 8px', border: `2px solid ${evalSystemPrimaire === opt.value ? '#059669' : '#d4c8b8'}`,
                                  borderRadius: 10, background: evalSystemPrimaire === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                                  color: evalSystemPrimaire === opt.value ? '#047857' : '#6b5c45',
                                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                                }}>
                                <span>{opt.label}</span>
                                <span style={{ fontSize: 11, color: '#a89478', fontWeight: 600 }}>{opt.desc}</span>
                              </button>
                            ))}
                          </div>
                        </Field>
                        <Field label="Fréquence de l'appel :">
                          <div style={{ display: 'flex', gap: 8 }}>
                            {([
                              { value: 'TWICE', label: '2 fois/jour', desc: 'matin + après-midi (recommandé)' },
                              { value: 'ONCE', label: '1 fois/jour', desc: '' },
                            ] as const).map(opt => (
                              <button key={opt.value} type="button" onClick={() => setAppelFrequency(opt.value)}
                                style={{
                                  flex: 1, padding: '10px 8px', border: `2px solid ${appelFrequency === opt.value ? '#059669' : '#d4c8b8'}`,
                                  borderRadius: 10, background: appelFrequency === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                                  color: appelFrequency === opt.value ? '#047857' : '#6b5c45',
                                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                                }}>
                                <span>{opt.label}</span>
                                {opt.desc && <span style={{ fontSize: 11, color: '#a89478', fontWeight: 600 }}>{opt.desc}</span>}
                              </button>
                            ))}
                          </div>
                        </Field>
                      </div>
                    )}

                    {/* PRIMARY_EN — bulletin frequency */}
                    {template.code === 'PRIMARY_EN' && (
                      <Field label="Report card frequency:">
                        <div style={{ display: 'flex', gap: 8 }}>
                          {([
                            { value: 'MONTHLY', label: 'Monthly (standard)' },
                            { value: 'TRIMESTRIAL', label: 'Per term' },
                          ] as const).map(opt => (
                            <button key={opt.value} type="button" onClick={() => setBulletinFrequency(opt.value)}
                              style={{
                                flex: 1, padding: '10px 8px', border: `2px solid ${bulletinFrequency === opt.value ? '#059669' : '#d4c8b8'}`,
                                borderRadius: 10, background: bulletinFrequency === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                                cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                                color: bulletinFrequency === opt.value ? '#047857' : '#6b5c45',
                              }}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </Field>
                    )}

                    {/* Q15 — Niveaux primaire */}
                    <Field label="Q15 — Quels niveaux avez-vous ?">
                      <CheckboxGroup
                        options={
                          form.subsystem === 'ANGLOPHONE'
                            ? NIVEAUX_PRIMAIRE_EN.map(v => ({ value: v, label: v }))
                            : NIVEAUX_PRIMAIRE_FR.map(v => ({ value: v, label: v }))
                        }
                        values={form.niveauxPrimaire}
                        onChange={v => setForm(f => ({
                          ...f,
                          niveauxPrimaire: v,
                          classesParNiveauPrimaire: v.reduce((acc, lvl) => ({
                            ...acc,
                            [lvl]: f.classesParNiveauPrimaire[lvl] ?? 2,
                          }), {} as Record<string, number>),
                        }))}
                      />
                    </Field>

                    {/* Q16 — Classes par niveau primaire */}
                    {form.niveauxPrimaire.length > 0 && (
                      <Field label="Q16 — Combien de classes par niveau ?">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {form.niveauxPrimaire.map(niveau => (
                            <div key={niveau} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 60, fontSize: 14, fontWeight: 800, color: '#1a1209' }}>{niveau}</div>
                              <StepperBtns
                                value={form.classesParNiveauPrimaire[niveau] ?? 1}
                                onChange={v => setNiveauPrimaireCount(niveau, v)}
                                max={4}
                              />
                            </div>
                          ))}
                        </div>
                      </Field>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── APERÇU EN TEMPS RÉEL (caché si COMPLEXE) ── */}
            {template && !template.isComplexe && (
              <div style={{ marginTop: 16, marginBottom: 12 }}>
                <div style={{
                  fontSize: 15, fontWeight: 800, color: '#1a1209',
                  padding: '8px 0', borderBottom: '2px solid #d4c8b8', marginBottom: 14,
                }}>
                  📋 Récapitulatif — ce qui sera créé
                </div>

                <div style={{
                  background: '#f9f6f1', border: '1.5px solid #e8e0d4',
                  borderRadius: 12, padding: '14px 16px',
                }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1209', marginBottom: 10 }}>
                    🏫 {template.name}
                  </div>

                  {previewLoading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#a89478', fontStyle: 'italic' }}>
                      <div style={{ width: 14, height: 14, border: '2px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
                      Calcul de la structure…
                    </div>
                  )}

                  {!previewLoading && previewData && (
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#047857', marginBottom: 8 }}>
                        {previewData.totalClasses} classes au total
                      </div>

                      {/* Group classes by cycle */}
                      {['6e','5e','4e','3e','CAP1','CAP2','CAP3','CAP4','Form 1','Form 2','Form 3','Form 4','Form 5'].filter(lvl =>
                        previewData.classes.some(c => c.level === lvl)
                      ).length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b5c45', marginBottom: 4 }}>
                            1er cycle — {previewData.classes.filter(c => ['6e','5e','4e','3e','CAP1','CAP2','CAP3','CAP4','Form 1','Form 2','Form 3','Form 4','Form 5'].includes(c.level)).length} classes :
                          </div>
                          <div style={{ fontSize: 12, color: '#6b5c45', lineHeight: 1.6, fontWeight: 600 }}>
                            {(() => {
                              const levels = ['6e','5e','4e','3e','CAP1','CAP2','CAP3','CAP4','Form 1','Form 2','Form 3','Form 4','Form 5']
                              return levels.filter(lvl => previewData.classes.some(c => c.level === lvl))
                                .map(lvl => ({
                                  lvl,
                                  names: previewData.classes.filter(c => c.level === lvl).map(c => c.name),
                                }))
                                .map(g => `${g.lvl} ${g.names.map(n => n.replace(g.lvl + ' ', '')).join(' · ')}`)
                                .join('\n')
                            })()}
                          </div>
                        </div>
                      )}

                      {['2nde','1ère','Tle','Lower Sixth','Upper Sixth'].filter(lvl =>
                        previewData.classes.some(c => c.level === lvl)
                      ).length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b5c45', marginBottom: 4 }}>
                            2e cycle — {previewData.classes.filter(c => ['2nde','1ère','Tle','Lower Sixth','Upper Sixth'].includes(c.level)).length} classes :
                          </div>
                          <div style={{ fontSize: 12, color: '#6b5c45', lineHeight: 1.6, fontWeight: 600 }}>
                            {(() => {
                              const levels = ['2nde','1ère','Tle','Lower Sixth','Upper Sixth']
                              return levels.filter(lvl => previewData.classes.some(c => c.level === lvl))
                                .map(lvl => ({
                                  lvl,
                                  names: previewData.classes.filter(c => c.level === lvl).map(c => c.name),
                                }))
                                .map(g => `${g.lvl} ${g.names.map(n => n.replace(g.lvl + ' ', '')).join(' · ')}`)
                                .join('\n')
                            })()}
                          </div>
                        </div>
                      )}

                      {previewData.subjects.length > 0 && (
                        <div style={{ fontSize: 12, color: '#6b5c45', fontWeight: 600 }}>
                          📚 Matières : {previewData.subjects.length} (avec coefficients BAC)
                        </div>
                      )}
                    </div>
                  )}

                  {!previewLoading && !previewData && (
                    <div style={{ fontSize: 13, color: '#a89478', fontStyle: 'italic' }}>
                      Configurez les niveaux ci-dessus pour voir un aperçu.
                    </div>
                  )}

                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e8e0d4' }}>
                    <div style={{ fontSize: 12, color: '#6b5c45', fontWeight: 600 }}>
                      📅 Année scolaire configurée automatiquement
                    </div>
                    <div style={{ fontSize: 12, color: '#6b5c45', fontWeight: 600 }}>
                      ⚙️ Configuration MINESEC par défaut
                    </div>
                    <div style={{ fontSize: 12, color: '#a89478', marginTop: 4 }}>
                      ⚠️ Tout pourra être modifié depuis votre tableau de bord après activation.
                    </div>
                  </div>
                </div>
              </div>
            )}

            <SubmitBtn onClick={goNext} disabled={!template || template.isComplexe}>
              {template?.isComplexe ? '⏳ Bientôt disponible' : 'Continuer → Confirmation'}
            </SubmitBtn>
          </div>
        )}

        {/* ── STEP 4 — Confirmation ──────────────── */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <button type="button" onClick={() => { setStep(3); setSubmitError('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: '#a89478', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', marginBottom: 14, padding: 0 }}>
              ← Retour
            </button>

            {/* Établissement summary */}
            <div style={{ background: 'white', border: '1.5px solid #e8e0d4', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a89478', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>🏫 Établissement</div>
              {form.logoBase64 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '8px 0', borderBottom: '1px solid #f0ebe3' }}>
                  <img src={form.logoBase64} alt="Logo" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', border: '1.5px solid #e8e0d4' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>Logo téléversé ✓</span>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
                {[
                  ['Nom', form.nom],
                  ['Sous-domaine', `edunexus.cm/${form.subdomain}`],
                  ['Template', template?.name ?? '—'],
                  ['Sous-système', labelOf(SUBSYSTEM_OPTIONS, form.subsystem)],
                  ['Enseignement', labelOf(EDUCATION_OPTIONS, form.educationType)],
                  ['Statut', labelOf(OWNERSHIP_OPTIONS, form.ownership)],
                  ['Ville', form.ville || '—'],
                  ['Région', form.region || '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 11, color: '#a89478', fontWeight: 700, textTransform: 'uppercase' }}>{k}</div>
                    <div style={{ fontSize: 14, color: '#1a1209', fontWeight: 700, wordBreak: 'break-all' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Admin summary */}
            <div style={{ background: 'white', border: '1.5px solid #e8e0d4', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a89478', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>👤 Administrateur</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
                {[
                  ['Prénom', form.adminPrenom],
                  ['Nom', form.adminNom],
                  ['Email', form.adminEmail],
                  ['Mot de passe', '••••••••'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 11, color: '#a89478', fontWeight: 700, textTransform: 'uppercase' }}>{k}</div>
                    <div style={{ fontSize: 14, color: '#1a1209', fontWeight: 700, wordBreak: 'break-all' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Structure summary */}
            {template && (
              <div style={{ background: 'white', border: '1.5px solid #e8e0d4', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#a89478', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                  📋 Configuration
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#a89478', fontWeight: 700, textTransform: 'uppercase' }}>Template</div>
                    <div style={{ fontSize: 14, color: '#1a1209', fontWeight: 700 }}>{template.name}</div>
                  </div>
                  {template.hasPremierCycle && (
                    <>
                      <div>
                        <div style={{ fontSize: 11, color: '#a89478', fontWeight: 700, textTransform: 'uppercase' }}>1er cycle</div>
                        <div style={{ fontSize: 14, color: '#1a1209', fontWeight: 700 }}>
                          {form.niveaux1erCycle.join(' · ')} ({Object.values(form.classesParNiveau).reduce((a, b) => a + b, 0) || 0} classes)
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#a89478', fontWeight: 700, textTransform: 'uppercase' }}>Convention</div>
                        <div style={{ fontSize: 14, color: '#1a1209', fontWeight: 700 }}>
                          {CONVENTION_OPTIONS.find(o => o.value === form.conventionNommage)?.label ?? form.conventionNommage}
                        </div>
                      </div>
                      {form.lv2Debut !== 'NON_APPLICABLE' && form.lv2Disponibles.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: '#a89478', fontWeight: 700, textTransform: 'uppercase' }}>LV2</div>
                          <div style={{ fontSize: 14, color: '#1a1209', fontWeight: 700 }}>
                            {form.lv2Disponibles.join(' · ')} (dès la {form.lv2Debut})
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {template.hasDeuxiemeCycle && (
                    <>
                      <div>
                        <div style={{ fontSize: 11, color: '#a89478', fontWeight: 700, textTransform: 'uppercase' }}>2e cycle</div>
                        <div style={{ fontSize: 14, color: '#1a1209', fontWeight: 700 }}>
                          {form.niveaux2eCycle.join(' · ')}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#a89478', fontWeight: 700, textTransform: 'uppercase' }}>Filières</div>
                        <div style={{ fontSize: 14, color: '#1a1209', fontWeight: 700 }}>
                          {form.filieres.length > 0 ? form.filieres.join(' · ') : '—'}
                        </div>
                      </div>
                      {form.a4Languages.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: '#a89478', fontWeight: 700, textTransform: 'uppercase' }}>Langues A4</div>
                          <div style={{ fontSize: 14, color: '#1a1209', fontWeight: 700 }}>{form.a4Languages.join(' · ')}</div>
                        </div>
                      )}
                    </>
                  )}
                  {template.isTechnique && form.filieresTechniques.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: '#a89478', fontWeight: 700, textTransform: 'uppercase' }}>Filières techniques</div>
                      <div style={{ fontSize: 14, color: '#1a1209', fontWeight: 700 }}>{form.filieresTechniques.join(' · ')}</div>
                    </div>
                  )}
                  {previewData && (
                    <div>
                      <div style={{ fontSize: 11, color: '#a89478', fontWeight: 700, textTransform: 'uppercase' }}>Total classes</div>
                      <div style={{ fontSize: 14, color: '#1a1209', fontWeight: 700 }}>{previewData.totalClasses}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Alert msg="Une fois soumis, votre dossier sera examiné sous 24-48h. Vous recevrez un email de confirmation." type="info" />

            {submitError && (
              <div ref={errorRef}>
                <Alert msg={submitError} type="error" />
              </div>
            )}

            <SubmitBtn loading={submitLoading} onClick={handleSubmit}>
              🚀 Soumettre ma demande d&apos;inscription
            </SubmitBtn>
          </div>
        )}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .edu-step:not(:last-child)::after {
          content: '';
          position: absolute; top: 13px; left: calc(50% + 12px);
          width: calc(100% - 24px); height: 2px;
          background: #d4c8b8; transition: background 0.4s;
        }
        .edu-step.s-done:not(:last-child)::after,
        .edu-step.s-active:not(:last-child)::after { background: #047857; }
        .edu-field:focus { border-color: #059669 !important; background: #f0ece6 !important; box-shadow: 0 0 0 3px rgba(5,150,105,0.08); }
        @keyframes edu-spin { to { transform: rotate(360deg); } }
        @keyframes edu-fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes edu-fadeDown { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }
        @media (max-width: 768px) {
          .edu-left-panel { display: none !important; }
          .edu-right-panel { width: 100vw !important; max-width: 100vw !important; }
        }
      `}</style>

      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-nunito),Nunito,sans-serif' }}>

        {LeftPanel}

        {/* ── Right panel ── */}
        <div className="edu-right-panel" style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: '#f7f3ee', overflowY: 'auto', position: 'relative', padding: '32px 24px' }}>
          <div style={{ position: 'absolute', top: -100, right: -100, width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle,rgba(34,197,94,0.05) 0%,transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ width: '100%', maxWidth: 520, position: 'relative', zIndex: 1 }}>
            {content}
          </div>
        </div>
      </div>
    </>
  )
}
