'use client'

import { GraduationCap, Users, User, Plus } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { ConversationSummary, CurrentUser } from './types'

interface Props {
  conversations: ConversationSummary[]
  loading: boolean
  selectedId: string | null
  currentUser: CurrentUser
  onSelect: (id: string) => void
  onNewMessage: () => void
}

function nomAffiche(conversation: ConversationSummary, currentUserId: string): string {
  if (conversation.name) return conversation.name
  if (conversation.type === 'PRIVATE') {
    const autre = conversation.participants.find((p) => p.id !== currentUserId)
    return autre ? `${autre.firstName} ${autre.lastName}` : 'Conversation'
  }
  return 'Conversation'
}

function IconeType({ type }: { type: ConversationSummary['type'] }) {
  if (type === 'CLASS_CHANNEL') return <GraduationCap size={16} />
  if (type === 'PARENT_CHANNEL') return <Users size={16} />
  return <User size={16} />
}

export default function ListeConversations({ conversations, loading, selectedId, currentUser, onSelect, onNewMessage }: Props) {
  const t = useT('common')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1.5px solid var(--border)' }}>
      <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
          {t('messagerie.title') ?? 'Messagerie'}
        </div>
        <button
          type="button"
          onClick={onNewMessage}
          title={t('messagerie.new_message') ?? 'Nouveau message'}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 10, border: 'none', background: 'var(--green)', color: 'white', cursor: 'pointer' }}
        >
          <Plus size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            {t('messagerie.loading') ?? 'Chargement...'}
          </div>
        ) : conversations.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            {t('messagerie.empty_list') ?? 'Aucune conversation pour le moment.'}
          </div>
        ) : conversations.map((conversation) => {
          const active = conversation.id === selectedId
          return (
            <button
              key={conversation.id}
              type="button"
              onClick={() => onSelect(conversation.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                padding: '10px 10px', borderRadius: 12, border: 'none', cursor: 'pointer', marginBottom: 4,
                background: active ? 'var(--amber-light)' : 'transparent',
              }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', flexShrink: 0 }}>
                <IconeType type={conversation.type} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {nomAffiche(conversation, currentUser.id)}
                  </span>
                  {conversation.unreadCount > 0 && (
                    <span style={{ minWidth: 18, height: 18, borderRadius: 999, background: 'var(--red)', color: 'white', fontSize: 10.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                  {conversation.lastMessage?.content ?? (t('messagerie.no_message_yet') ?? 'Aucun message')}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
