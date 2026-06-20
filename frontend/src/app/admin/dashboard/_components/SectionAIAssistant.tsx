'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface AiAction {
  description: string
  method: string
  endpoint: string
  body?: Record<string, unknown>
}

type MessageStatus = 'pending' | 'done' | 'error'

interface ChatMessage {
  id: number
  role: 'user' | 'assistant' | 'status'
  content: string
  status?: MessageStatus
}

let msgId = 0

const SUGGESTIONS = [
  'Affecter les enseignants aux classes',
  'Générer tous les EDT',
  'Remplir les présences (30 jours)',
  'Générer les notes séquence 1',
  'Tout générer en une fois',
  'Réinitialiser les données de démo',
]

export default function SectionAIAssistant({ onToast }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: ++msgId,
      role: 'assistant',
      content: '👋 Bonjour ! Je suis ton assistant de développement EduNexus.\n\nDonne-moi une instruction en langage naturel et je générerai des données de test réalistes pour toi.\n\nExemples : "Génère tout en une fois", "Remplis les présences des 15 derniers jours", "Efface tout".',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [pendingConfirmation, setPendingConfirmation] = useState<AiAction[] | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchApi('/api/v2/school/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d?.data?.id) setSchoolId(d.data.id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMsg = useCallback((msg: Omit<ChatMessage, 'id'>): number => {
    const id = ++msgId
    setMessages(prev => [...prev, { ...msg, id }])
    return id
  }, [])

  const updateMsg = useCallback((id: number, patch: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m))
  }, [])

  const executeActions = useCallback(async (actions: AiAction[]) => {
    const results: { ok: boolean; msg: string }[] = []

    for (const action of actions) {
      const statusId = addMsg({ role: 'status', content: `⏳ ${action.description}…`, status: 'pending' })

      const body = { ...action.body, schoolId }

      try {
        const res = await fetch('/api/dev-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ method: action.method, endpoint: action.endpoint, body }),
        })
        const data = await res.json() as { success?: boolean; data?: { message?: string; count?: number }; message?: string }

        if (res.ok && data.success !== false) {
          const detail = data.data?.message ?? data.message ?? 'Terminé'
          updateMsg(statusId, { content: `✅ ${detail}`, status: 'done' })
          results.push({ ok: true, msg: detail })
        } else {
          const errMsg = data.message ?? `Erreur ${res.status}`
          updateMsg(statusId, { content: `❌ ${action.description} — ${errMsg}`, status: 'error' })
          results.push({ ok: false, msg: errMsg })
        }
      } catch (err) {
        const errMsg = String(err)
        updateMsg(statusId, { content: `❌ ${action.description} — ${errMsg}`, status: 'error' })
        results.push({ ok: false, msg: errMsg })
      }
    }

    // Récapitulatif
    const ok = results.filter(r => r.ok)
    const ko = results.filter(r => !r.ok)
    if (ok.length > 0) {
      const summary = ok.length === results.length
        ? `✅ Tout est terminé !\n${ok.map(r => `• ${r.msg}`).join('\n')}`
        : `✅ ${ok.length}/${results.length} actions réussies.\n${ok.map(r => `• ${r.msg}`).join('\n')}${ko.length > 0 ? `\n\n❌ Erreurs :\n${ko.map(r => `• ${r.msg}`).join('\n')}` : ''}`
      addMsg({ role: 'assistant', content: summary })
    }

    if (ok.length > 0) onToast(`${ok.length} action${ok.length > 1 ? 's' : ''} exécutée${ok.length > 1 ? 's' : ''}`, 'success')
    if (ko.length > 0) onToast(`${ko.length} erreur${ko.length > 1 ? 's' : ''}`, 'error')
  }, [addMsg, updateMsg, schoolId, onToast])

  const processMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    if (!schoolId) {
      addMsg({ role: 'assistant', content: '⚠️ Impossible de récupérer l\'ID de l\'école. Rechargez la page.' })
      return
    }

    addMsg({ role: 'user', content: text })
    setLoading(true)
    setPendingConfirmation(null)

    const thinkId = addMsg({ role: 'status', content: '🤖 Analyse en cours…', status: 'pending' })

    try {
      const res = await fetch('/api/dev-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, schoolId }),
      })

      const aiReply = await res.json() as {
        message?: string
        actions?: AiAction[]
        requiresConfirmation?: boolean
        confirmActions?: AiAction[]
        error?: string
      }

      updateMsg(thinkId, { content: '', status: 'done' })

      const aiMessage = aiReply.message ?? aiReply.error ?? 'Impossible de traiter cette demande.'
      addMsg({ role: 'assistant', content: aiMessage })

      if (aiReply.requiresConfirmation && aiReply.confirmActions && aiReply.confirmActions.length > 0) {
        setPendingConfirmation(aiReply.confirmActions)
      } else if (aiReply.actions && aiReply.actions.length > 0) {
        await executeActions(aiReply.actions)
      }
    } catch (err) {
      updateMsg(thinkId, { content: `❌ Erreur IA : ${String(err)}`, status: 'error' })
    } finally {
      setLoading(false)
    }
  }, [loading, schoolId, addMsg, updateMsg, executeActions])

  const send = useCallback(() => {
    const text = input.trim()
    if (!text) return
    setInput('')
    void processMessage(text)
  }, [input, processMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const confirmReset = async () => {
    if (!pendingConfirmation) return
    const actions = pendingConfirmation
    setPendingConfirmation(null)
    addMsg({ role: 'user', content: '✅ Oui, je confirme la réinitialisation.' })
    setLoading(true)
    await executeActions(actions)
    setLoading(false)
  }

  const cancelReset = () => {
    setPendingConfirmation(null)
    addMsg({ role: 'assistant', content: '❌ Réinitialisation annulée. Tes données sont intactes.' })
  }

  return (
    <div style={{ padding: '28px 32px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* En-tête */}
      <div style={{ marginBottom: 20, flexShrink: 0 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fef3c7', border: '1.5px dashed #f59e0b', borderRadius: 10, padding: '6px 14px', marginBottom: 10 }}>
          <span style={{ fontSize: 18 }}>🤖</span>
          <span style={{ fontSize: 13, fontWeight: 900, color: '#92400e', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            Assistant IA — MODE DÉVELOPPEMENT
          </span>
        </div>
        <div style={{ fontSize: 15, color: '#a89478' }}>
          Donnez des instructions en langage naturel. L&apos;IA exécutera les actions sur votre EduNexus local.
          {!schoolId && <span style={{ color: '#ef4444', marginLeft: 8 }}>⚠️ Connexion en cours…</span>}
        </div>
      </div>

      {/* Zone de conversation */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        background: '#fafaf9',
        border: '1.5px solid #e8e0d4',
        borderRadius: 14,
        padding: '16px',
        marginBottom: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {/* Boutons de confirmation reset */}
        {pendingConfirmation && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', padding: '8px 0' }}>
            <button onClick={confirmReset}
              style={{ padding: '10px 20px', borderRadius: 10, fontWeight: 800, fontSize: 15, background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              ✅ Oui je confirme
            </button>
            <button onClick={cancelReset}
              style={{ padding: '10px 20px', borderRadius: 10, fontWeight: 800, fontSize: 15, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }}>
              ❌ Annuler
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestions rapides */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, flexShrink: 0 }}>
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => { if (!loading) void processMessage(s) }}
            style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700,
              background: loading ? '#f0ebe3' : '#fef3c7',
              color: loading ? '#a89478' : '#92400e',
              border: '1px solid #f59e0b',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
              opacity: loading ? 0.6 : 1,
            }}>
            {s}
          </button>
        ))}
      </div>

      {/* Zone de saisie */}
      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder={loading ? 'Traitement en cours…' : 'Donnez une instruction (ex: "Génère les présences des 7 derniers jours")'}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: 'white',
            border: '1.5px solid #d4c8b8',
            borderRadius: 12,
            fontSize: 15,
            fontFamily: 'inherit',
            color: '#1a1209',
            outline: 'none',
            opacity: loading ? 0.7 : 1,
          }}
        />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{
            padding: '12px 20px',
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 800,
            background: loading || !input.trim() ? '#d4c8b8' : 'linear-gradient(135deg,#059669,#047857)',
            color: 'white',
            border: 'none',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            minWidth: 110,
          }}>
          {loading ? '…' : 'Envoyer ▶'}
        </button>
      </div>
    </div>
  )
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === 'status') {
    if (!msg.content) return null
    return (
      <div style={{
        padding: '8px 14px',
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 600,
        color: msg.status === 'error' ? '#dc2626' : msg.status === 'done' ? '#059669' : '#6b5c45',
        background: msg.status === 'error' ? '#fee2e2' : msg.status === 'done' ? '#d1fae5' : '#f0ebe3',
        alignSelf: 'stretch',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        {msg.status === 'pending' && <Spinner />}
        {msg.content}
      </div>
    )
  }

  const isUser = msg.role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '80%',
        padding: '12px 16px',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: isUser ? 'linear-gradient(135deg,#059669,#047857)' : 'white',
        color: isUser ? 'white' : '#1a1209',
        fontSize: 15,
        fontWeight: 500,
        lineHeight: 1.6,
        border: isUser ? 'none' : '1px solid #e8e0d4',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {msg.content}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: 14,
      height: 14,
      border: '2px solid #d4c8b8',
      borderTopColor: '#059669',
      borderRadius: '50%',
      animation: 'dev-spin 0.7s linear infinite',
      flexShrink: 0,
    }}>
      <style>{`@keyframes dev-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  )
}
