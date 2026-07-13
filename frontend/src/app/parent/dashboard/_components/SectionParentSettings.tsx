'use client'
import { Settings } from 'lucide-react'
import { useT } from '@/lib/i18n'

export default function SectionParentSettings() {
  const t = useT('parent')
  return (
    <div style={{ padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: 52, textAlign: 'center', maxWidth: 520 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}><Settings size={60} strokeWidth={2} /></div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
          {t('settings.title')}
        </div>
        <div style={{ fontSize: 17, color: 'var(--text3)', fontWeight: 500, lineHeight: 1.7 }}>
          {t('settings.development')}<br />{t('settings.comeBack')}
        </div>
      </div>
    </div>
  )
}
