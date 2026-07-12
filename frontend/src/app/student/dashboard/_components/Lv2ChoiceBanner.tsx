'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

interface Subject { id: string; name: string }
interface WindowData {
  window: { id: string; level: string; openDate: string; closeDate: string }
  currentChoice: { subjectId: string; subjectName?: string } | null
  availableSubjects: Subject[]
}

export default function Lv2ChoiceBanner({ onToast }: Props) {
  const t = useT('student')
  const [data, setData] = useState<WindowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetchApi('/api/v2/students/me/lv2-choice-window', { credentials: 'include' })
      const json = await res.json()
      if (json.success) setData(json.data)
    } catch { /* silencieux — pas de fenêtre active par défaut */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSubmit = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      const res = await fetchApi('/api/v2/students/me/lv2-choice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ chosenSubjectId: selected }),
      })
      const json = await res.json()
      if (json.success) {
        onToast(t('lv2Choice.toast_submitted'), 'success')
        await load()
      } else {
        onToast(json.message || t('lv2Choice.toast_error'), 'error')
      }
    } catch {
      onToast(t('lv2Choice.toast_error'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !data?.window) return null

  const closeDate = new Date(data.window.closeDate).toLocaleDateString()

  return (
    <div style={{ background: 'var(--blue-light)', border: '1.5px solid var(--blue)', borderRadius: 16, padding: '20px 24px', marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 22 }}>🗣️</span>
        <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{t('lv2Choice.banner_title')}</span>
      </div>

      {data.currentChoice ? (
        <div style={{ fontSize: 15, color: 'var(--text2)', fontWeight: 600 }}>
          {t('lv2Choice.already_submitted').replace('{subject}', data.currentChoice.subjectName || '')}
        </div>
      ) : (
        <>
          <div style={{ fontSize: 15, color: 'var(--text2)', fontWeight: 600, marginBottom: 14 }}>
            {t('lv2Choice.banner_subtitle').replace('{date}', closeDate)}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={selected} onChange={e => setSelected(e.target.value)}
              style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontWeight: 600, minWidth: 220 }}>
              <option value="">{t('lv2Choice.select_placeholder')}</option>
              {data.availableSubjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button onClick={handleSubmit} disabled={!selected || submitting}
              style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--blue)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: selected && !submitting ? 'pointer' : 'not-allowed', opacity: selected && !submitting ? 1 : 0.6 }}>
              {submitting ? t('lv2Choice.submitting') : t('lv2Choice.submit_btn')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
