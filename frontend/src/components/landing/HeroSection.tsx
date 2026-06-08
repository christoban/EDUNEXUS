'use client'

import { motion } from 'framer-motion'

const grades = [
  { subject: 'Mathématiques', coeff: 4, ds: '14.5', compo: '15.5', mention: 'Assez Bien' },
  { subject: 'Français', coeff: 4, ds: '16', compo: '17', mention: 'Bien' },
  { subject: 'Anglais', coeff: 3, ds: '13', compo: '15', mention: 'Assez Bien' },
  { subject: 'Physique', coeff: 3, ds: '12', compo: '13', mention: 'Passable' },
  { subject: 'SVT', coeff: 2, ds: '15', compo: '16.5', mention: 'Bien' },
]

export default function HeroSection() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#0A0F1E] pt-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2563EB] opacity-[0.08] blur-[120px]" />
        <div className="absolute right-0 top-1/2 h-[400px] w-[400px] rounded-full bg-[#10B981] opacity-[0.05] blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-[#2563EB]/30 bg-[#2563EB]/10 px-4 py-1.5 text-sm font-semibold text-[#60a5fa]"
        >
          <span className="h-2 w-2 rounded-full bg-[#2563EB] animate-pulse" />
          Conforme MINESEC · Décret 2001/041
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mx-auto max-w-4xl text-center text-5xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl"
        >
          La plateforme de gestion scolaire<br />
          conçue pour le{' '}
          <span className="bg-gradient-to-r from-[#2563EB] to-[#10B981] bg-clip-text text-transparent">
            Cameroun
          </span>
          .
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mx-auto mt-6 max-w-2xl text-center text-lg leading-relaxed text-gray-400 sm:text-xl"
        >
          EduNexus centralise notes, bulletins, finances, présences et communication
          pour les 17 types d&apos;établissements MINESEC — francophones, anglophones et bilingues.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
        >
          <button
            onClick={() => document.querySelector('#cta')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-2 rounded-xl bg-[#2563EB] px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-[#2563EB]/30 transition-all hover:bg-[#1d4ed8] hover:shadow-[#2563EB]/40"
          >
            Commencer gratuitement — 3 mois offerts
          </button>
          <button
            onClick={() => document.querySelector('#demo')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 text-base font-bold text-gray-300 transition-all hover:bg-white/10 hover:text-white"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
              <span className="ml-0.5 text-xs">▶</span>
            </span>
            Voir la démo (2 min)
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500"
        >
          <span className="flex items-center gap-1.5">
            <span className="text-[#10B981]">✓</span> Aucune carte requise
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[#10B981]">✓</span> Configuration en 15 min
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[#10B981]">✓</span> Support en français & anglais
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mx-auto mt-16 max-w-4xl"
        >
          <div className="animate-float rounded-2xl border border-white/10 bg-[#111827] p-6 shadow-2xl shadow-black/40 sm:p-8">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-500">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Lycée Bilingue de Garoua — Bulletin 1er Trimestre 2025/2026
            </div>
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-sm font-bold text-white">Marie NGONO</span>
                <span className="ml-3 text-xs text-gray-500">Classe: 3ème A4</span>
              </div>
              <div className="rounded-lg bg-[#2563EB]/10 px-3 py-1 text-sm font-bold text-[#60a5fa]">
                Rang: 3<sup>ème</sup> / 47
              </div>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold text-gray-500">
                  <th className="pb-2">Matière</th>
                  <th className="pb-2">Coeff</th>
                  <th className="pb-2">DS</th>
                  <th className="pb-2">Compo</th>
                  <th className="pb-2">Moy.</th>
                  <th className="pb-2">Mention</th>
                </tr>
              </thead>
              <tbody className="text-white/90">
                {grades.map((g, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="py-2 font-semibold">{g.subject}</td>
                    <td className="py-2 text-gray-400">{g.coeff}</td>
                    <td className="py-2">{g.ds}</td>
                    <td className="py-2">{g.compo}</td>
                    <td className="py-2 font-bold text-[#10B981]">{((+g.ds + +g.compo) / 2).toFixed(1)}</td>
                    <td className="py-2 text-[#fbbf24]">{g.mention}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10">
                  <td colSpan={4} className="pt-3 text-right text-sm font-bold text-white">Moyenne générale</td>
                  <td className="pt-3 text-sm font-bold text-[#10B981]">14.8/20</td>
                  <td className="pt-3 text-sm font-bold text-white">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
