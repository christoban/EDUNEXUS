import { Hexagon } from 'lucide-react'

const footerLinks = {
  Produit: ['Fonctionnalités', 'Tarifs', 'Changelog'],
  Légal: ['Conditions', 'Confidentialité', 'Conformité MINESEC'],
  Contact: ['contact@edunexus.cm', 'support@edunexus.cm', 'Yaoundé, Cameroun'],
}

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#0A0F1E] py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563EB]">
                <Hexagon className="h-5 w-5 text-white" fill="white" />
              </div>
              <span className="text-lg font-extrabold tracking-tight text-white">
                Edu<span className="text-[#2563EB]">Nexus</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed text-gray-500">
              La plateforme de gestion scolaire du Cameroun.
            </p>
            <div className="mt-4 flex gap-3 text-sm text-gray-600">
              <span className="cursor-pointer transition-colors hover:text-gray-400">Français 🇫🇷</span>
              <span className="cursor-pointer transition-colors hover:text-gray-400">English 🇬🇧</span>
            </div>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="mb-3 text-sm font-bold text-gray-400">{title}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <span className="cursor-pointer text-sm text-gray-600 transition-colors hover:text-gray-400">
                      {link}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-white/[0.06] pt-8 text-center text-xs text-gray-600">
          © 2026 EduNexus. Tous droits réservés.
        </div>
      </div>
    </footer>
  )
}
