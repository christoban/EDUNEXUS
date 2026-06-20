'use client'

interface Props {
  message?: string
}

export default function OfflineEmptyState({ message }: Props) {
  return (
    <div style={{ padding: '28px 32px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: 48, textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📶</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>
          {message ?? 'Cette donnée n\'est pas disponible hors-ligne.'}
        </div>
        <div style={{ fontSize: 14, color: '#a89478', lineHeight: 1.6 }}>
          Connectez-vous une fois en ligne pour la consulter ensuite sans connexion.
        </div>
      </div>
    </div>
  )
}
