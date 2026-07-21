'use client'
import { useState, useEffect, useCallback } from 'react'
import { Smartphone, Mail, PenLine, ClipboardList, Eye, Upload, AlertTriangle, Paperclip, Inbox } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface ClassItem { id: string; name: string; level: string }

interface BroadcastTarget {
  role?: string
  classId?: string
  level?: string
  paymentStatus?: string
}

interface BroadcastLog {
  id: string
  channel: string
  target: BroadcastTarget
  message: string
  recipientCount: number
  sentCount: number
  failedCount: number
  status: string
  createdAt: string
}

interface PreviewData { total: number; withPhone: number; withEmail: number }

const CANAL_LABEL: Record<string, string> = {
  SMS:   'SMS',
  EMAIL: 'Email',
  BOTH:  'SMS & Email',
}
const CANAL_ICON: Record<string, LucideIcon> = { SMS: Smartphone, EMAIL: Mail, BOTH: Smartphone }

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  completed: { color: 'var(--green)', bg: 'var(--green-light)', label: 'Envoyé' },
  partial:   { color: 'var(--amber)', bg: 'var(--amber-light)', label: 'Partiel' },
  failed:    { color: 'var(--red)', bg: 'var(--red-light)', label: 'Échoué' },
}

// Options de <select> natif — pas d'icône possible dans un <option>, texte seul.
const ROLE_OPTIONS = [
  { value: '',        label: '— Choisir un rôle —' },
  { value: 'PARENT',  label: 'Parents d\'élèves' },
  { value: 'STUDENT', label: 'Élèves' },
  { value: 'TEACHER', label: 'Enseignants' },
  { value: 'STAFF',   label: 'Personnel administratif' },
]

const PAYMENT_OPTIONS = [
  { value: '',        label: '— Tout statut —' },
  { value: 'OVERDUE', label: 'En retard' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'PARTIAL', label: 'Partiel' },
  { value: 'PAID',    label: 'À jour' },
]

const VARIABLES = ['{nom_eleve}', '{classe}', '{solde}']

function targetSummary(t: BroadcastTarget): string {
  const parts: string[] = []
  if (t.role)          parts.push({ PARENT: 'Parents', STUDENT: 'Élèves', TEACHER: 'Enseignants', STAFF: 'Personnel' }[t.role] ?? t.role)
  if (t.classId)       parts.push('Classe ciblée')
  if (t.level)         parts.push(`Niveau ${t.level}`)
  if (t.paymentStatus) parts.push({ OVERDUE: 'En retard', PENDING: 'En attente', PARTIAL: 'Partiel', PAID: 'À jour' }[t.paymentStatus] ?? t.paymentStatus)
  return parts.join(' · ') || '—'
}

export default function SectionCommunications({ onToast }: Props) {
  const t = useT('admin')
  const [classes, setClasses]           = useState<ClassItem[]>([])
  const [logs, setLogs]                 = useState<BroadcastLog[]>([])
  const [totalLogs, setTotalLogs]       = useState(0)
  const [loading, setLoading]           = useState(true)
  const [sending, setSending]           = useState(false)
  const [previewing, setPreviewing]     = useState(false)
  const [preview, setPreview]           = useState<PreviewData | null>(null)
  const [tab, setTab]                   = useState<'compose' | 'history'>('compose')

  // Form state
  const [channel, setChannel]       = useState<'SMS' | 'EMAIL' | 'BOTH'>('SMS')
  const [role, setRole]             = useState('')
  const [classId, setClassId]       = useState('')
  const [level, setLevel]           = useState('')
  const [paymentStatus, setPayment] = useState('')
  const [message, setMessage]       = useState('')

  const levels = [...new Set(classes.map((c) => c.level).filter(Boolean))].sort()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [clsRes, logsRes] = await Promise.all([
        fetchApi('/api/v2/classes?limit=200').then((r) => r.json()),
        fetchApi('/api/v2/communications/broadcasts?limit=20').then((r) => r.json()),
      ])
      if (clsRes.success)  setClasses(clsRes.data ?? [])
      if (logsRes.success) {
        setLogs(logsRes.data?.logs ?? [])
        setTotalLogs(logsRes.data?.total ?? 0)
      }
    } catch {
      onToast('Erreur de chargement', 'error')
    } finally {
      setLoading(false)
    }
  }, [onToast])

  useEffect(() => { loadData() }, [loadData])

  // Rafraîchissement temps réel quand l'assistant IA diffuse un message.
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'broadcastLog') loadData()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [loadData])

  const buildTarget = (): BroadcastTarget => ({
    ...(role          ? { role }          : {}),
    ...(classId       ? { classId }       : {}),
    ...(level         ? { level }         : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
  })

  const handlePreview = async () => {
    const target = buildTarget()
    if (!role && !classId && !level && !paymentStatus) {
      onToast('Sélectionnez au moins un filtre de ciblage.', 'error'); return
    }
    setPreviewing(true)
    setPreview(null)
    try {
      const params = new URLSearchParams()
      if (target.role)          params.set('role', target.role)
      if (target.classId)       params.set('classId', target.classId)
      if (target.level)         params.set('level', target.level)
      if (target.paymentStatus) params.set('paymentStatus', target.paymentStatus)
      const r = await fetchApi(`/api/v2/communications/broadcasts/preview?${params.toString()}`)
      const d = await r.json()
      if (d.success) setPreview(d.data)
      else onToast(d.error ?? 'Erreur lors de la prévisualisation', 'error')
    } catch {
      onToast('Erreur réseau', 'error')
    } finally {
      setPreviewing(false)
    }
  }

  const handleSend = async () => {
    const target = buildTarget()
    if (!message.trim())                                     { onToast('Le message est vide.', 'error'); return }
    if (!role && !classId && !level && !paymentStatus)       { onToast('Sélectionnez au moins un filtre.', 'error'); return }
    if (!window.confirm(`Envoyer ce message via ${channel} à ${preview?.total ?? '?'} destinataire(s) ?`)) return

    setSending(true)
    try {
      const r = await fetchApi('/api/v2/communications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, channel, message }),
      })
      const d = await r.json()
      if (d.success) {
        const { sent, failed, total } = d.data
        onToast(`Envoyé à ${sent}/${total} destinataire(s)${failed > 0 ? ` (${failed} échoué(s))` : ''}.`, failed > 0 ? 'info' : 'success')
        setMessage('')
        setPreview(null)
        loadData()
        setTab('history')
      } else {
        onToast(d.error ?? 'Erreur lors de l\'envoi', 'error')
      }
    } catch {
      onToast('Erreur réseau', 'error')
    } finally {
      setSending(false)
    }
  }

  const insertVariable = (v: string) => {
    setMessage((prev) => prev + v)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text3)' }}>
      Chargement…
    </div>
  )

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '32px 36px', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{t('communications.title')}</h2>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text3)' }}>
          Envoyez un message groupé par SMS ou email à votre communauté scolaire.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--border)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {(['compose', 'history'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '7px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
              background: tab === t ? 'white' : 'transparent',
              color: tab === t ? 'var(--text)' : 'var(--text3)',
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            {t === 'compose' ? <><PenLine size={14} /> Composer</> : <><ClipboardList size={14} /> Historique{totalLogs > 0 ? ` (${totalLogs})` : ''}</>}
          </button>
        ))}
      </div>

      {/* ── COMPOSE TAB ──────────────────────────────────────────────────── */}
      {tab === 'compose' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
          {/* Left — form */}
          <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: 'var(--text2)' }}>1. Canal d'envoi</h3>
            <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
              {(['SMS', 'EMAIL', 'BOTH'] as const).map((c) => {
                const Icon = CANAL_ICON[c]
                return (
                <button key={c} onClick={() => setChannel(c)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 9, border: channel === c ? '2px solid var(--blue)' : '2px solid var(--border)',
                    background: channel === c ? 'var(--blue-light)' : 'white', color: channel === c ? 'var(--blue)' : 'var(--text3)',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                  <Icon size={14} /> {CANAL_LABEL[c]}
                </button>
                )
              })}
            </div>

            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--text2)' }}>2. Cibler les destinataires</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 28 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Rôle</label>
                <select value={role} onChange={(e) => { setRole(e.target.value); setPreview(null) }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--surface)' }}>
                  {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Classe</label>
                <select value={classId} onChange={(e) => { setClassId(e.target.value); setLevel(''); setPreview(null) }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--surface)' }}>
                  <option value="">— Toutes les classes —</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Niveau</label>
                <select value={level} onChange={(e) => { setLevel(e.target.value); setClassId(''); setPreview(null) }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--surface)' }}>
                  <option value="">— Tous les niveaux —</option>
                  {levels.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Statut paiement</label>
                <select value={paymentStatus} onChange={(e) => { setPayment(e.target.value); setPreview(null) }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--surface)' }}>
                  {PAYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text2)' }}>3. Rédiger le message</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                {VARIABLES.map((v) => (
                  <button key={v} onClick={() => insertVariable(v)}
                    style={{
                      padding: '3px 10px', borderRadius: 6, border: '1px solid var(--purple-light)', background: 'var(--purple-light)',
                      color: 'var(--purple)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex : Cher parent de {nom_eleve}, nous vous informons que les cours de la classe de {classe} reprennent lundi. Solde dû : {solde}."
              rows={6}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid var(--border)',
                fontSize: 13, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>
              {message.length} caractère(s)
              {message.length > 160 && channel !== 'EMAIL' && (
                <span style={{ color: 'var(--amber)', marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={12} /> {Math.ceil(message.length / 160)} SMS par destinataire
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={handlePreview} disabled={previewing}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 10, border: '2px solid var(--blue)',
                  background: 'var(--surface)', color: 'var(--blue)', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  opacity: previewing ? 0.6 : 1,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                {previewing ? 'Calcul…' : <><Eye size={15} /> Prévisualiser</>}
              </button>
              <button onClick={handleSend} disabled={sending || !preview}
                style={{
                  flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
                  background: !preview || sending ? 'var(--text3)' : 'var(--blue)',
                  color: 'white', fontWeight: 700, fontSize: 14, cursor: !preview || sending ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                {sending ? 'Envoi en cours…' : <><Upload size={15} /> Envoyer via {channel}</>}
              </button>
            </div>
          </div>

          {/* Right — preview card */}
          <div>
            {/* Aperçu destinataires */}
            <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: 'var(--text2)' }}>Aperçu des destinataires</h4>
              {!preview ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text3)', fontSize: 13 }}>
                  Cliquez sur « Prévisualiser »<br />pour estimer les destinataires.
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: 'Total destinataires', value: preview.total, color: 'var(--text)' },
                      { label: 'Avec numéro SMS',     value: preview.withPhone, color: 'var(--blue)' },
                      { label: 'Avec adresse email',  value: preview.withEmail, color: 'var(--green)' },
                    ].map((item) => (
                      <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--text3)' }}>{item.label}</span>
                        <span style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                  {preview.total === 0 && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--amber-light)', borderRadius: 8, fontSize: 12, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={13} /> Aucun destinataire trouvé avec ces filtres.
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Aide variables */}
            <div style={{ background: 'var(--blue-light)', borderRadius: 14, padding: 18, border: '1px solid var(--blue-light)' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 6 }}><Paperclip size={14} /> Variables disponibles</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { var: '{nom_eleve}', desc: 'Nom complet de l\'élève' },
                  { var: '{classe}',    desc: 'Nom de la classe' },
                  { var: '{solde}',     desc: 'Solde dû en XAF' },
                ].map((v) => (
                  <div key={v.var} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <code style={{ fontSize: 11, background: 'var(--blue-light)', padding: '2px 6px', borderRadius: 4, color: 'var(--blue)', whiteSpace: 'nowrap' }}>{v.var}</code>
                    <span style={{ fontSize: 12, color: 'var(--blue)', paddingTop: 1 }}>{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ──────────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div style={{ background: 'var(--surface)', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {logs.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Inbox size={40} /></div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Aucun envoi pour l'instant</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Les campagnes envoyées apparaîtront ici.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)' }}>
                    {['Date', 'Canal', 'Ciblage', 'Message', 'Résultat', 'Statut'].map((h) => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => {
                    const s = STATUS_STYLE[log.status] ?? STATUS_STYLE['partial']
                    return (
                      <tr key={log.id} style={{ borderTop: '1px solid var(--bg2)', background: i % 2 === 0 ? 'white' : 'var(--bg)' }}>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                          {new Date(log.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          <br />
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                            {new Date(log.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)' }}>{CANAL_LABEL[log.channel] ?? log.channel}</span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text3)' }}>
                          {targetSummary(log.target)}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text2)', maxWidth: 260 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.message}>
                            {log.message}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12 }}>
                          <span style={{ color: 'var(--green)', fontWeight: 700 }}>{log.sentCount} envoyés</span>
                          {log.failedCount > 0 && (
                            <span style={{ color: 'var(--red)', marginLeft: 6 }}>· {log.failedCount} échoués</span>
                          )}
                          <br />
                          <span style={{ color: 'var(--text3)' }}>{log.recipientCount} destinataire(s)</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '3px 10px', borderRadius: 6, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700 }}>
                            {s.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
