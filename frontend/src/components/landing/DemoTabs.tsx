'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts'

const tabs = ['Tableau de bord', 'Saisie des notes', 'Bulletin PDF', 'Finance']

const chartData = [
  { trimestre: 'T1', Moyenne: 12.5 },
  { trimestre: 'T2', Moyenne: 13.8 },
  { trimestre: 'T3', Moyenne: 14.2 },
]

const eleves = [
  { n: 1, nom: 'ABANDA Paul', ds1: '14.5', ds2: '13', compo: '15.5', moyenne: '14.42', mention: 'Assez Bien', rang: '4ème', status: 'VALIDÉ' },
  { n: 2, nom: 'BELLO Aminatou', ds1: '17', ds2: '16', compo: '18', moyenne: '17.25', mention: 'Très Bien', rang: '1ère', status: 'VALIDÉ' },
  { n: 3, nom: 'CHEN Éric', ds1: '11', ds2: '12', compo: '10.5', moyenne: '11.13', mention: 'Passable', rang: '8ème', status: 'EN ATTENTE' },
  { n: 4, nom: 'DIOP Fatou', ds1: '15', ds2: '14.5', compo: '16', moyenne: '15.25', mention: 'Bien', rang: '2ème', status: 'VALIDÉ' },
]

const paiements = [
  { eleve: 'ABANDA Paul', montant: '45 000', methode: 'MTN MoMo', date: '05/10/2025', statut: '✅ Payé' },
  { eleve: 'BELLO Aminatou', montant: '45 000', methode: 'Orange Money', date: '03/10/2025', statut: '✅ Payé' },
  { eleve: 'FOUDA Jean', montant: '45 000', methode: '—', date: '—', statut: '⚠️ Impayé' },
]

export default function DemoTabs() {
  const [active, setActive] = useState(0)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <section id="demo" className="bg-[#0A0F1E] py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-4 text-center"
        >
          <h2 className="text-4xl font-extrabold text-white sm:text-5xl">Voyez EduNexus en action.</h2>
          <p className="mt-3 text-lg text-gray-400">Cliquez sur les onglets pour explorer les différentes interfaces.</p>
        </motion.div>

        <div className="mb-8 flex flex-wrap justify-center gap-1 rounded-xl bg-[#111827] p-1.5">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActive(i)}
              className={`rounded-lg px-5 py-2.5 text-sm font-bold transition-all ${
                active === i
                  ? 'bg-[#2563EB] text-white shadow-lg shadow-[#2563EB]/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="w-full rounded-2xl border border-white/[0.08] bg-[#111827] p-6 sm:p-8"
          >
            {active === 0 && (
              <div>
                <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { icon: '📊', value: '247', label: 'Élèves' },
                    { icon: '📚', value: '18', label: 'Classes' },
                    { icon: '✅', value: '89%', label: 'Présence' },
                    { icon: '💰', value: '3.2M', label: 'FCFA collectés' },
                  ].map((c, i) => (
                    <div key={i} className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-4 text-center">
                      <div className="text-2xl">{c.icon}</div>
                      <div className="text-xl font-extrabold text-white">{c.value}</div>
                      <div className="text-xs font-semibold text-gray-500">{c.label}</div>
                    </div>
                  ))}
                </div>
                <div className="h-64 w-full">
                  {mounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="trimestre" stroke="#6b7280" />
                        <YAxis domain={[0, 20]} stroke="#6b7280" />
                        <Tooltip contentStyle={{ background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }} />
                        <Line type="monotone" dataKey="Moyenne" stroke="#2563EB" strokeWidth={3} dot={{ fill: '#2563EB', r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}

            {active === 1 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs font-semibold text-gray-500">
                      <th className="pb-3 pr-4">N°</th>
                      <th className="pb-3 pr-4">Élève</th>
                      <th className="pb-3 pr-4">DS1</th>
                      <th className="pb-3 pr-4">DS2</th>
                      <th className="pb-3 pr-4">Compo</th>
                      <th className="pb-3 pr-4">Moyenne</th>
                      <th className="pb-3 pr-4">Mention</th>
                      <th className="pb-3 pr-4">Rang</th>
                      <th className="pb-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eleves.map((e) => (
                      <tr key={e.n} className="border-t border-white/5 text-white/90">
                        <td className="py-3 pr-4 text-gray-500">{e.n}</td>
                        <td className="py-3 pr-4 font-semibold">{e.nom}</td>
                        <td className="py-3 pr-4">{e.ds1}</td>
                        <td className="py-3 pr-4">{e.ds2}</td>
                        <td className="py-3 pr-4">{e.compo}</td>
                        <td className="py-3 pr-4 font-bold text-[#10B981]">{e.moyenne}</td>
                        <td className="py-3 pr-4 text-[#fbbf24]">{e.mention}</td>
                        <td className="py-3 pr-4">{e.rang}</td>
                        <td className="py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            e.status === 'VALIDÉ' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#f59e0b]/10 text-[#f59e0b]'
                          }`}>
                            {e.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {active === 2 && (
              <div>
                <div className="mb-6 rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-6">
                  <div className="mb-4 text-center">
                    <div className="text-xs font-semibold text-gray-500">RÉPUBLIQUE DU CAMEROUN · Paix - Travail - Patrie</div>
                    <div className="mt-1 text-lg font-extrabold text-white">Lycée Bilingue de Garoua</div>
                    <div className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-400">
                      <span className="font-bold text-white">Marie NGONO</span>
                      <span>|</span>
                      <span>3ème A4</span>
                      <span>|</span>
                      <span>1er Trimestre 2025/2026</span>
                    </div>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs font-semibold text-gray-500">
                        <th className="pb-2 pr-4">Matière</th>
                        <th className="pb-2 pr-4">Coeff</th>
                        <th className="pb-2 pr-4">Note</th>
                        <th className="pb-2">Mention</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { matiere: 'Mathématiques', coeff: 4, note: '15/20', mention: 'Bien' },
                        { matiere: 'Français', coeff: 4, note: '16/20', mention: 'Bien' },
                        { matiere: 'Anglais', coeff: 3, note: '14/20', mention: 'Assez Bien' },
                        { matiere: 'Physique', coeff: 3, note: '13/20', mention: 'Assez Bien' },
                        { matiere: 'SVT', coeff: 2, note: '15/20', mention: 'Bien' },
                      ].map((m, i) => (
                        <tr key={i} className="border-t border-white/5 text-white/90">
                          <td className="py-2 pr-4 font-semibold">{m.matiere}</td>
                          <td className="py-2 pr-4 text-gray-400">{m.coeff}</td>
                          <td className="py-2 pr-4 font-bold text-[#10B981]">{m.note}</td>
                          <td className="py-2 text-[#fbbf24]">{m.mention}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                    <div className="text-sm">
                      <span className="text-gray-500">Moyenne générale: </span>
                      <span className="font-extrabold text-[#10B981]">14.8/20</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      Signature: <span className="font-bold text-white">[Cachet]</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center">
                  <button className="rounded-xl bg-[#2563EB] px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#1d4ed8]">
                    Télécharger PDF
                  </button>
                </div>
              </div>
            )}

            {active === 3 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs font-semibold text-gray-500">
                      <th className="pb-3 pr-4">Élève</th>
                      <th className="pb-3 pr-4">Montant</th>
                      <th className="pb-3 pr-4">Méthode</th>
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paiements.map((p, i) => (
                      <tr key={i} className="border-t border-white/5 text-white/90">
                        <td className="py-3 pr-4 font-semibold">{p.eleve}</td>
                        <td className="py-3 pr-4">{p.montant} FCFA</td>
                        <td className="py-3 pr-4 text-gray-400">{p.methode}</td>
                        <td className="py-3 pr-4 text-gray-400">{p.date}</td>
                        <td className={`py-3 font-bold ${p.statut === '✅ Payé' ? 'text-[#10B981]' : 'text-[#f59e0b]'}`}>
                          {p.statut}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}
