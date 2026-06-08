'use client'

import { motion } from 'framer-motion'
import {
  BookOpen, Users, CreditCard, ClipboardList,
  MessageSquare, Shield, Zap, WifiOff, BarChart2,
} from 'lucide-react'

const features = [
  {
    icon: BookOpen,
    title: 'Notes & Bulletins MINESEC',
    desc: 'Séquences, trimestres, moyennes pondérées, rangs et bulletins officiels générés en PDF pour les systèmes FR, EN et bilingue. 6 templates de bulletins inclus.',
  },
  {
    icon: Users,
    title: '17 Types d\'établissements',
    desc: 'Lycée général, CES, technique, CETIC, GHS, GSS, primaire APC, bilingue, complexe scolaire… Chaque type avec ses propres règles, séries, filières et coefficients.',
  },
  {
    icon: CreditCard,
    title: 'Finance & Mobile Money',
    desc: 'Collecte des frais via MTN MoMo et Orange Money (Campay). Facturation, reçus, suivi des impayés — dans le respect des seuils légaux MINESEC (Art. 48).',
  },
  {
    icon: ClipboardList,
    title: 'Présences & Discipline',
    desc: 'Feuilles d\'appel numériques, alertes absences automatiques, dossiers disciplinaires, conseils de discipline — conformes aux articles 29 et 30.',
  },
  {
    icon: MessageSquare,
    title: 'Communication multi-canal',
    desc: 'Messagerie interne parents-enseignants, notifications push, SMS, bulletins partagés. En français et en anglais selon la section.',
  },
  {
    icon: Shield,
    title: 'Sécurité multi-tenant',
    desc: 'Chaque établissement dans un espace totalement isolé. JWT httpOnly, 2FA TOTP, journaux d\'audit complets. Vos données n\'appartiennent qu\'à vous.',
  },
  {
    icon: Zap,
    title: 'IA intégrée (Gemini)',
    desc: 'Suggestions de formulations pour appréciations, analyse des résultats par classe, détection des élèves en difficulté. Disponible sur le plan Premium.',
  },
  {
    icon: WifiOff,
    title: 'Mode hors ligne',
    desc: 'Les enseignants saisissent les notes même sans internet. Synchronisation automatique à la reconnexion. Parfait pour les zones à connectivité limitée.',
  },
  {
    icon: BarChart2,
    title: 'Rapports & Analytics',
    desc: 'Rapports automatiques pour la DDES et la DRES, statistiques de réussite par classe, taux d\'assiduité, comparatifs inter-classes. Export PDF et CSV.',
  },
]

export default function FeaturesGrid() {
  return (
    <section id="fonctionnalites" className="bg-[#0A0F1E] py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="text-4xl font-extrabold text-white sm:text-5xl">
            Tout ce dont votre établissement a besoin.<br />
            <span className="text-gray-400">Dans un seul outil.</span>
          </h2>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feat, i) => {
            const Icon = feat.icon
            return (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="group rounded-xl border border-white/[0.08] bg-[#111827] p-6 transition-all hover:border-[#2563EB]/40 hover:shadow-lg hover:shadow-[#2563EB]/5"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#2563EB]/10 text-[#2563EB] group-hover:bg-[#2563EB]/20">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-white">{feat.title}</h3>
                <p className="text-sm leading-relaxed text-gray-400">{feat.desc}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
