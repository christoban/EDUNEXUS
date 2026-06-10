'use client'

export default function SectionParentSettings() {
  return (
    <div style={{ padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: 52, textAlign: 'center', maxWidth: 520 }}>
        <div style={{ fontSize: 60, marginBottom: 20 }}>⚙️</div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 26, fontWeight: 700, color: '#1a1209', marginBottom: 12 }}>
          Paramètres
        </div>
        <div style={{ fontSize: 17, color: '#a89478', fontWeight: 500, lineHeight: 1.7 }}>
          Cette section est en cours de développement.<br />Revenez bientôt.
        </div>
      </div>
    </div>
  )
}
