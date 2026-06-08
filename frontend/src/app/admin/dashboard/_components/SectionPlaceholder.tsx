interface Props {
  title: string
  icon: string
  description: string
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function SectionPlaceholder({ title, icon, description, onToast }: Props) {
  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 26 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }}>{title}</div>
        <div style={{ fontSize: 17, color: '#a89478', marginTop: 3 }}>{description}</div>
      </div>
      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: 52, textAlign: 'center', maxWidth: 620 }}>
        <div style={{ fontSize: 60, marginBottom: 22 }}>{icon}</div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 26, fontWeight: 700, color: '#1a1209', marginBottom: 14 }}>
          {title}
        </div>
        <div style={{ fontSize: 17, color: '#a89478', fontWeight: 500, marginBottom: 32, lineHeight: 1.7 }}>
          Cette section est en cours de développement.<br />Revenez bientôt.
        </div>
        <button
          onClick={() => onToast(`Section ${title} bientôt disponible`, 'info')}
          style={{ padding: '10px 24px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Accéder à {title} →
        </button>
      </div>
    </div>
  )
}
