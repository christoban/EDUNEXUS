'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, Check, X as IconX } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface MessageEnAttente {
  id: string
  content: string
  createdAt: string
  sender: { id: string; firstName: string; lastName: string; role: string }
  conversation: { id: string; type: string; name: string | null; classId: string | null }
}

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function SectionModerationMessagerie({ onToast }: Props) {
  const t = useT('common')
  const [messages, setMessages] = useState<MessageEnAttente[]>([])
  const [loading, setLoading] = useState(true)
  const [motifParMessage, setMotifParMessage] = useState<Record<string, string>>({})
  const [messageEnRejet, setMessageEnRejet] = useState<string | null>(null)
  const [traitementId, setTraitementId] = useState<string | null>(null)

  const charger = async () => {
    setLoading(true)
    try {
      const res = await fetchApi('/api/v2/messagerie/moderation')
      const payload = await res.json()
      if (payload.success) setMessages(payload.data ?? [])
    } catch { /* silencieux */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { charger() }, [])

  const moderer = async (messageId: string, decision: 'APPROVED' | 'REJECTED') => {
    setTraitementId(messageId)
    try {
      const response = await fetchApi(`/api/v2/messagerie/messages/${messageId}/moderation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, motif: motifParMessage[messageId]?.trim() || undefined }),
      })
      const payload = await response.json()
      if (payload.success) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId))
        setMessageEnRejet(null)
        onToast(
          decision === 'APPROVED'
            ? (t('messagerie.moderation_approved') ?? 'Message approuvé.')
            : (t('messagerie.moderation_rejected') ?? 'Message refusé.'),
          'success',
        )
      } else {
        onToast(payload.message ?? (t('messagerie.generic_error') ?? 'Une erreur est survenue.'), 'error')
      }
    } catch {
      onToast(t('messagerie.generic_error') ?? 'Une erreur est survenue.', 'error')
    } finally {
      setTraitementId(null)
    }
  }

  const nomCanal = (conversation: MessageEnAttente['conversation']) => {
    if (conversation.name) return conversation.name
    return conversation.type === 'CLASS_CHANNEL'
      ? (t('messagerie.class_channel') ?? 'Canal de classe')
      : (t('messagerie.parent_channel') ?? 'Canal parents')
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '28px 32px' }}>
      <div style={{ marginBottom: 22, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--amber-light)', border: '1px solid var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber)' }}>
          <ShieldCheck size={20} />
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
            {t('messagerie.moderation_title') ?? 'Modération des messages'}
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 14, fontWeight: 500, marginTop: 2 }}>
            {t('messagerie.moderation_subtitle') ?? 'Messages des canaux de classe et parents en attente de validation'}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 28, textAlign: 'center', color: 'var(--text3)', background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)' }}>
          {t('messagerie.loading') ?? 'Chargement...'}
        </div>
      ) : messages.length === 0 ? (
        <div style={{ padding: 28, textAlign: 'center', color: 'var(--text3)', background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)' }}>
          {t('messagerie.moderation_empty') ?? 'Aucun message en attente de modération.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {messages.map((message) => (
            <article key={message.id} style={{ background: 'var(--surface)', borderRadius: 18, border: '1.5px solid var(--border)', padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--text)' }}>{message.sender.firstName} {message.sender.lastName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{nomCanal(message.conversation)} · {new Date(message.createdAt).toLocaleString('fr-FR')}</div>
                </div>
              </div>

              <div style={{ color: 'var(--text2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 14 }}>{message.content}</div>

              {messageEnRejet === message.id && (
                <input
                  value={motifParMessage[message.id] ?? ''}
                  onChange={(event) => setMotifParMessage((prev) => ({ ...prev, [message.id]: event.target.value }))}
                  placeholder={t('messagerie.rejection_reason_placeholder') ?? 'Motif du refus (optionnel)'}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', marginBottom: 12 }}
                />
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => moderer(message.id, 'APPROVED')}
                  disabled={traitementId === message.id}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: 'var(--green)', color: 'white', fontWeight: 800, cursor: 'pointer', opacity: traitementId === message.id ? 0.6 : 1 }}
                >
                  <Check size={14} /> {t('messagerie.approve') ?? 'Approuver'}
                </button>
                {messageEnRejet === message.id ? (
                  <button
                    type="button"
                    onClick={() => moderer(message.id, 'REJECTED')}
                    disabled={traitementId === message.id}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1.5px solid var(--red)', background: 'transparent', color: 'var(--red)', fontWeight: 800, cursor: 'pointer', opacity: traitementId === message.id ? 0.6 : 1 }}
                  >
                    <IconX size={14} /> {t('messagerie.confirm_reject') ?? 'Confirmer le refus'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMessageEnRejet(message.id)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text3)', fontWeight: 800, cursor: 'pointer' }}
                  >
                    <IconX size={14} /> {t('messagerie.reject') ?? 'Refuser'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
