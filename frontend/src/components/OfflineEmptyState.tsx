'use client'

import { useT } from '@/lib/i18n'

interface Props {
  message?: string
}

export default function OfflineEmptyState({ message }: Props) {
  const t = useT('common')
  return (
    <div style={{ padding: '28px 32px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: 48, textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📶</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          {message ?? t('offline.notAvailable')}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6 }}>
          {t('offline.connectHint')}
        </div>
      </div>
    </div>
  )
}
