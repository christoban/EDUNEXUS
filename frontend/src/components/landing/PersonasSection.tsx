'use client'

import { motion } from 'framer-motion'

const personas = [
  {
    icon: '👤',
    title: 'Proviseur / Directeur / Principal',
    desc: "Vue globale de l'école : finances, résultats, rapports MINESEC. Signez les bulletins et générez les rapports DDES en un clic.",
  },
  {
    icon: '👤',
    title: 'Censeur / Vice-Principal',
    desc: "Validez les notes soumises par les enseignants, organisez les conseils de classe, supervisez les emplois du temps.",
  },
  {
    icon: '👤',
    title: 'Enseignant / Teacher',
    desc: "Saisissez vos notes depuis n'importe quel appareil, même hors ligne. Publiez les devoirs, gérez les présences de vos classes.",
  },
  {
    icon: '👤',
    title: 'Parent / Tuteur',
    desc: "Consultez les bulletins, suivez les absences de votre enfant, communiquez directement avec les enseignants.",
  },
]

export default function PersonasSection() {
  return (
    <section className="border-y border-white/[0.06] bg-[#111827] py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-14 text-center"
        >
          <h2 className="text-4xl font-extrabold text-white sm:text-5xl">
            Pour chaque rôle dans votre établissement.
          </h2>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {personas.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="rounded-xl border border-white/[0.08] bg-[#0A0F1E] p-6 transition-all hover:border-[#2563EB]/30"
            >
              <div className="mb-3 text-3xl">{p.icon}</div>
              <h3 className="mb-2 text-base font-bold text-white">{p.title}</h3>
              <p className="text-sm leading-relaxed text-gray-400">{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
