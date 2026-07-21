'use client'
import { Menu } from 'lucide-react'

/** Bouton hamburger — visible uniquement sous le seuil `md` (768px), ouvre le tiroir de
 * navigation mobile. Utilisé dans chaque topbar/header de tableau de bord. */
export default function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Menu" className="md:hidden"
      style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg2)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
      <Menu size={20} color="var(--text)" />
    </button>
  )
}
