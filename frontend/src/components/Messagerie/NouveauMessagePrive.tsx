'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Search, Send } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import type { ContactUser } from './types'

interface Props {
  onCreated: (conversationId: string) => void
  onCancel: () => void
}

export default function NouveauMessagePrive({ onCreated, onCancel }: Props) {
  const t = useT('common')
  const [contacts, setContacts] = useState<ContactUser[]>([])
  const [loading, setLoading] = useState(true)
  const [recherche, setRecherche] = useState('')
  const [destinataire, setDestinataire] = useState<ContactUser | null>(null)
  const [contenu, setContenu] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    let monte = true
    fetchApi('/api/v2/messagerie/contacts')
      .then((r) => r.json())
      .then((d) => { if (monte && d.success) setContacts(d.data ?? []) })
      .catch(() => {})
      .finally(() => { if (monte) setLoading(false) })
    return () => { monte = false }
  }, [])

  const filtres = contacts.filter((c) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(recherche.toLowerCase()))

  const handleEnvoyer = async () => {
    if (!destinataire || !contenu.trim() || envoi) return
    setEnvoi(true)
    setErreur(null)
    try {
      const response = await fetchApi('/api/v2/messagerie/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinataireId: destinataire.id, content: contenu.trim(), clientMessageId: crypto.randomUUID() }),
      })
      const payload = await response.json()
      if (payload.success) {
        onCreated(payload.data.conversationId)
      } else {
        setErreur(payload.message ?? (t('messagerie.generic_error') ?? 'Une erreur est survenue.'))
      }
    } catch {
      setErreur(t('messagerie.generic_error') ?? 'Une erreur est survenue.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={onCancel} style={{ border: 'none', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', display: 'inline-flex' }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ fontWeight: 800, color: 'var(--text)' }}>{t('messagerie.new_message') ?? 'Nouveau message'}</div>
      </div>

      {!destinataire ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
            <input
              value={recherche}
              onChange={(event) => setRecherche(event.target.value)}
              placeholder={t('messagerie.search_contact') ?? 'Rechercher un contact...'}
              style={{ width: '100%', padding: '10px 14px 10px 34px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
            />
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 20 }}>{t('messagerie.loading') ?? 'Chargement...'}</div>
          ) : filtres.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 20 }}>{t('messagerie.no_contact') ?? 'Aucun contact disponible.'}</div>
          ) : filtres.map((contact) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => setDestinataire(contact)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', marginBottom: 2 }}
            >
              <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{contact.firstName} {contact.lastName}</span>
              <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{t(`messagerie.role_options.${contact.role.toLowerCase()}`) ?? contact.role}</span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16 }}>
          <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{destinataire.firstName} {destinataire.lastName}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{t(`messagerie.role_options.${destinataire.role.toLowerCase()}`) ?? destinataire.role}</div>
            </div>
            <button type="button" onClick={() => setDestinataire(null)} style={{ border: 'none', background: 'transparent', color: 'var(--text3)', fontWeight: 700, cursor: 'pointer' }}>
              {t('messagerie.change_contact') ?? 'Changer'}
            </button>
          </div>

          {erreur && (
            <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.35)', color: 'var(--text3)', fontSize: 12.5 }}>
              {erreur}
            </div>
          )}

          <textarea
            value={contenu}
            onChange={(event) => setContenu(event.target.value)}
            placeholder={t('messagerie.write_message') ?? 'Écrire un message...'}
            rows={5}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', resize: 'vertical', marginBottom: 12 }}
          />

          <button
            type="button"
            onClick={handleEnvoyer}
            disabled={!contenu.trim() || envoi}
            style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: 'none', background: 'var(--green)', color: 'white', fontWeight: 800, cursor: 'pointer', opacity: !contenu.trim() || envoi ? 0.6 : 1 }}
          >
            <Send size={15} /> {envoi ? (t('messagerie.sending') ?? 'Envoi...') : (t('messagerie.send') ?? 'Envoyer')}
          </button>
        </div>
      )}
    </div>
  )
}
