'use client'

import { useEffect, useState } from 'react'
import { Megaphone, Pin, CalendarClock, School, Users, GraduationCap, User, UserCircle2, Send, Trash2 } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import type { ReactNode } from 'react'
import { useT } from '@/lib/i18n'

interface AnnouncementAuthor {
  id: string
  firstName: string
  lastName: string
  role: string
}

interface AnnouncementItem {
  id: string
  title: string
  content: string
  targetRoles: string[]
  isPinned: boolean
  expiresAt: string | null
  createdAt: string
  author?: AnnouncementAuthor | null
}

interface Props {
  role?: string
  title?: string
  subtitle?: string
}

const ROLE_OPTIONS = ['ADMIN', 'STAFF', 'TEACHER', 'PARENT', 'STUDENT'] as const

const ROLE_ICON: Record<string, ReactNode> = {
  ADMIN: <School size={12} />,
  STAFF: <Users size={12} />,
  TEACHER: <GraduationCap size={12} />,
  PARENT: <User size={12} />,
  STUDENT: <UserCircle2 size={12} />,
}

export default function Babillard({ role = 'ADMIN', title = 'Babillard numérique', subtitle = 'Communiqués, résultats et annonces officielles' }: Props) {
  const t = useT('common')
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [noticeVisible, setNoticeVisible] = useState(false)
  const [errorNotice, setErrorNotice] = useState<string | null>(null)
  const [errorVisible, setErrorVisible] = useState(false)
  const [publishTitle, setPublishTitle] = useState('')
  const [publishContent, setPublishContent] = useState('')
  const [publishRoles, setPublishRoles] = useState<string[]>([role])
  const [publishPinned, setPublishPinned] = useState(false)
  const [publishExpiryMode, setPublishExpiryMode] = useState<'none' | 'days'>('none')
  const [publishExpiryDays, setPublishExpiryDays] = useState('1')
  const [publishing, setPublishing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const canPublish = role === 'ADMIN' || role === 'STAFF'
  const editingAnnouncement = editingId ? announcements.find((item) => item.id === editingId) ?? null : null

  useEffect(() => {
    let mounted = true
    fetchApi('/api/v2/announcements')
      .then(r => r.json())
      .then(d => {
        if (!mounted) return
        if (d.success) setAnnouncements(d.data ?? [])
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })

    return () => { mounted = false }
  }, [])

  const toggleRole = (value: string) => {
    setPublishRoles((current) => (
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    ))
  }

  const resetForm = () => {
    setEditingId(null)
    setPublishTitle('')
    setPublishContent('')
    setPublishRoles([role])
    setPublishPinned(false)
    setPublishExpiryMode('none')
    setPublishExpiryDays('1')
  }

  const handlePublish = async () => {
    const title = publishTitle.trim()
    const content = publishContent.trim()
    if (!title || !content || publishRoles.length === 0) return

    setPublishing(true)
    setErrorNotice(null)
    try {
      const expiresAt = publishExpiryMode === 'days'
        ? new Date(Date.now() + Math.max(1, Number(publishExpiryDays || '1')) * 24 * 60 * 60 * 1000).toISOString()
        : null

      const response = await fetchApi(editingId ? `/api/v2/announcements/${editingId}` : '/api/v2/announcements', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          targetRoles: publishRoles,
          isPinned: publishPinned,
          expiresAt,
        }),
      })

      const payload = await response.json()
      if (payload.success) {
        setAnnouncements((current) => {
          const next = current.filter((item) => item.id !== payload.data.id)
          return [payload.data, ...next]
        })
        setNotice(editingId ? (t('babillard.update_success') ?? 'Communiqué modifié avec succès.') : (t('babillard.create_success') ?? 'Communiqué publié avec succès.'))
        setNoticeVisible(true)
        resetForm()
      } else {
        setErrorNotice(payload.message ?? (t('babillard.generic_error') ?? 'Une erreur est survenue.'))
        setErrorVisible(true)
      }
    } catch {
      setErrorNotice(t('babillard.generic_error') ?? 'Une erreur est survenue.')
      setErrorVisible(true)
    } finally {
      setPublishing(false)
    }
  }

  const handleEdit = (item: AnnouncementItem) => {
    setEditingId(item.id)
    setPublishTitle(item.title)
    setPublishContent(item.content)
    setPublishRoles(item.targetRoles.length > 0 ? item.targetRoles : [role])
    setPublishPinned(item.isPinned)
    if (item.expiresAt) {
      setPublishExpiryMode('days')
      const remainingDays = Math.max(1, Math.ceil((new Date(item.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      setPublishExpiryDays(String(remainingDays))
    } else {
      setPublishExpiryMode('none')
      setPublishExpiryDays('1')
    }
  }

  const handleDelete = async (id: string) => {
    if (!canPublish || deletingId) return
    const confirmed = typeof window === 'undefined' ? true : window.confirm('Supprimer ce communiqué ?')
    if (!confirmed) return

    setDeletingId(id)
    setErrorNotice(null)
    try {
      const response = await fetchApi(`/api/v2/announcements/${id}`, {
        method: 'DELETE',
      })
      const payload = await response.json()
      if (payload.success) {
        setAnnouncements((current) => current.filter((item) => item.id !== id))
      } else {
        setErrorNotice(payload.message ?? (t('babillard.generic_error') ?? 'Une erreur est survenue.'))
        setErrorVisible(true)
      }
    } catch {
      setErrorNotice(t('babillard.generic_error') ?? 'Une erreur est survenue.')
      setErrorVisible(true)
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => {
    if (!notice) return
    const hideTimer = window.setTimeout(() => setNoticeVisible(false), 3000)
    const clearTimer = window.setTimeout(() => setNotice(null), 3300)
    return () => {
      window.clearTimeout(hideTimer)
      window.clearTimeout(clearTimer)
    }
  }, [notice])

  useEffect(() => {
    if (!errorNotice) return
    const hideTimer = window.setTimeout(() => setErrorVisible(false), 4200)
    const clearTimer = window.setTimeout(() => setErrorNotice(null), 4500)
    return () => {
      window.clearTimeout(hideTimer)
      window.clearTimeout(clearTimer)
    }
  }, [errorNotice])

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '28px 32px' }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--amber-light)', border: '1px solid var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber)' }}>
            <Megaphone size={20} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
            <div style={{ color: 'var(--text3)', fontSize: 14, fontWeight: 500, marginTop: 2 }}>{subtitle}</div>
          </div>
        </div>
      </div>

      {notice && (
        <div
          aria-live="polite"
          style={{
            marginBottom: 14,
            padding: '10px 12px',
            borderRadius: 12,
            background: 'rgba(34, 197, 94, 0.10)',
            border: '1px solid rgba(34, 197, 94, 0.35)',
            color: 'var(--text3)',
            fontWeight: 700,
            fontSize: 13,
            lineHeight: 1.45,
            maxWidth: 520,
            opacity: noticeVisible ? 1 : 0,
            transform: noticeVisible ? 'translateY(0)' : 'translateY(-6px)',
            transition: 'opacity 220ms ease, transform 220ms ease',
          }}
        >
          {notice}
        </div>
      )}

      {errorNotice && (
        <div
          aria-live="assertive"
          style={{
            marginBottom: 14,
            padding: '10px 12px',
            borderRadius: 12,
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: 'var(--text3)',
            fontWeight: 700,
            fontSize: 13,
            lineHeight: 1.45,
            maxWidth: 620,
            opacity: errorVisible ? 1 : 0,
            transform: errorVisible ? 'translateY(0)' : 'translateY(-6px)',
            transition: 'opacity 220ms ease, transform 220ms ease',
          }}
        >
          {errorNotice}
        </div>
      )}

      {canPublish && (
        <section style={{ background: 'var(--surface)', borderRadius: 18, border: editingId ? '1.5px solid var(--amber)' : '1.5px solid var(--border)', padding: 18, marginBottom: 18, boxShadow: editingId ? '0 10px 30px rgba(245, 158, 11, 0.10)' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontWeight: 800, color: 'var(--text)' }}>
            <Megaphone size={16} /> {editingId ? (t('babillard.edit_title') ?? 'Modifier le communiqué') : (t('babillard.publish_title') ?? 'Publier un communiqué')}
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {editingId && (
              <div style={{ display: 'grid', gap: 10, padding: '12px 14px', borderRadius: 14, background: 'linear-gradient(180deg, rgba(245,158,11,0.12), rgba(245,158,11,0.06))', border: '1px solid rgba(245,158,11,0.35)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 800, color: 'var(--text)' }}>{t('babillard.editing_mode') ?? 'Mode édition actif'}</span>
                  <button
                    type="button"
                    onClick={resetForm}
                    style={{ border: 'none', background: 'transparent', color: 'var(--text3)', fontWeight: 800, cursor: 'pointer' }}
                  >
                    {t('babillard.cancel') ?? 'Annuler'}
                  </button>
                </div>
                <div style={{ color: 'var(--text3)', fontSize: 13, lineHeight: 1.5 }}>
                  {editingAnnouncement ? `${editingAnnouncement.title} · ${editingAnnouncement.targetRoles.join(', ') || 'Tous'}` : (t('babillard.editing_mode_hint') ?? 'Les changements s’appliqueront au communiqué sélectionné.')}
                </div>
              </div>
            )}
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, border: '1px solid rgba(245, 158, 11, 0.35)', background: 'rgba(245, 158, 11, 0.08)', color: 'var(--text)', fontWeight: 800, cursor: 'pointer' }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--amber)' }} />
                {t('babillard.cancel_edit') ?? 'Fermer l’édition'}
              </button>
            )}
            <input
              value={publishTitle}
              onChange={(event) => setPublishTitle(event.target.value)}
              placeholder={t('babillard.title_placeholder') ?? 'Titre'}
              aria-label={editingId ? (t('babillard.edit_title') ?? 'Modifier le communiqué') : (t('babillard.title_placeholder') ?? 'Titre')}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
            />
            <textarea
              value={publishContent}
              onChange={(event) => setPublishContent(event.target.value)}
              placeholder={t('babillard.content_placeholder') ?? 'Contenu'}
              rows={5}
              aria-label={t('babillard.content_placeholder') ?? 'Contenu'}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', resize: 'vertical' }}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ROLE_OPTIONS.map((item) => {
                const selected = publishRoles.includes(item)
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleRole(item)}
                    style={{
                      border: selected ? '1.5px solid var(--amber)' : '1.5px solid var(--border)',
                      background: selected ? 'var(--amber-light)' : 'var(--bg)',
                      color: 'var(--text)',
                      borderRadius: 999,
                      padding: '6px 12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {t(`babillard.role_options.${item.toLowerCase()}`) ?? item}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text3)', fontWeight: 700 }}>
                <input type="checkbox" checked={publishPinned} onChange={(event) => setPublishPinned(event.target.checked)} />
                {t('babillard.pin') ?? 'Épingler'}
              </label>
              <select
                value={publishExpiryMode}
                onChange={(event) => setPublishExpiryMode(event.target.value as 'none' | 'days')}
                style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              >
                <option value="none">{t('babillard.no_expiration') ?? 'Sans expiration'}</option>
                <option value="days">{t('babillard.expire_in_days') ?? 'Expirer dans N jours'}</option>
              </select>
              {publishExpiryMode === 'days' && (
                <input
                  type="number"
                  min={1}
                  value={publishExpiryDays}
                  onChange={(event) => setPublishExpiryDays(event.target.value)}
                  style={{ width: 120, padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                />
              )}
            </div>

            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || !publishTitle.trim() || !publishContent.trim() || publishRoles.length === 0}
              style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: 'none', background: 'var(--green)', color: 'white', fontWeight: 800, cursor: 'pointer', opacity: publishing ? 0.7 : 1 }}
            >
              <Send size={15} /> {publishing ? (t('babillard.sending') ?? 'Publication...') : (editingId ? (t('babillard.save') ?? 'Enregistrer') : (t('babillard.publish') ?? 'Publier'))}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text3)', fontWeight: 800, cursor: 'pointer' }}
              >
                {t('babillard.cancel_edit') ?? 'Fermer l’édition'}
              </button>
            )}
          </div>
        </section>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        {loading ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--text3)', background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)' }}>
            Chargement...
          </div>
        ) : announcements.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--text3)', background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)' }}>
            {t('babillard.empty') ?? 'Aucun communiqué pour le moment.'}
          </div>
        ) : announcements.map((item) => {
          const expiresAt = item.expiresAt ? new Date(item.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : (t('babillard.no_expiration') ?? 'Sans expiration')
          return (
            <article key={item.id} style={{ background: 'var(--surface)', borderRadius: 18, border: '1.5px solid var(--border)', padding: 20, boxShadow: item.isPinned ? '0 8px 28px rgba(0,0,0,0.08)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{item.title}</h3>
                    {item.isPinned && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 999, background: 'var(--amber-light)', color: 'var(--amber)', fontSize: 11, fontWeight: 800 }}><Pin size={12} /> Épinglé</span>}
                  </div>
                  <div style={{ marginTop: 8, color: 'var(--text2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{item.content}</div>
                </div>
                {canPublish && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text3)', borderRadius: 10, padding: '8px 10px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {t('babillard.edit') ?? 'Modifier'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text3)', borderRadius: 10, padding: '8px 10px', fontWeight: 700, cursor: deletingId === item.id ? 'wait' : 'pointer', flexShrink: 0 }}
                    >
                      <Trash2 size={14} /> {deletingId === item.id ? (t('babillard.deleting') ?? 'Suppression...') : (t('babillard.delete') ?? 'Supprimer')}
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14, color: 'var(--text3)', fontSize: 12, fontWeight: 700 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CalendarClock size={14} /> Expire: {expiresAt}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{ROLE_ICON[(item.targetRoles?.[0] ?? role).toUpperCase()] ?? <Users size={12} />} {item.targetRoles?.length ? item.targetRoles.join(', ') : 'Tous'}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{item.author ? `${item.author.firstName} ${item.author.lastName}` : 'Administration'} · {item.author?.role ?? role}</span>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}