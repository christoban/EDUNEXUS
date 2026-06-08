'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    q: "Mon établissement est bilingue. EduNexus peut-il gérer les deux sections ?",
    a: "Oui. EduNexus prend en charge les lycées bilingues avec une section FR (Censeur) et une section EN (Vice-Principal) indépendantes, chacune avec ses propres bulletins, séries et règles d'évaluation.",
  },
  {
    q: "Les données de mon école sont-elles accessibles par d'autres établissements ?",
    a: "Non. EduNexus est une architecture multi-tenant strictement isolée. Chaque école dispose d'un espace complètement séparé. Ni EduNexus ni aucun autre établissement ne peut accéder à vos données pédagogiques ou financières.",
  },
  {
    q: "Le système génère-t-il les bulletins officiels MINESEC ?",
    a: "Oui. EduNexus génère des bulletins PDF conformes aux 6 templates officiels : secondaire FR, secondaire EN, technique FR, primaire APC, annuel et mensuel (Primary EN).",
  },
  {
    q: "Les enseignants peuvent-ils saisir des notes sans internet ?",
    a: "Oui. Le mode hors ligne (disponible sur le plan Premium) permet la saisie complète des notes sans connexion. La synchronisation est automatique à la reconnexion.",
  },
  {
    q: "Comment fonctionne le paiement via Mobile Money ?",
    a: "EduNexus est intégré avec Campay (partenaire officiel MTN MoMo et Orange Money). Les parents paient directement depuis leur téléphone. L'intendant valide et les reçus sont générés automatiquement.",
  },
  {
    q: "Combien de temps prend la configuration initiale ?",
    a: "L'onboarding guidé prend environ 15 minutes. Vous choisissez le type d'établissement, entrez vos classes, séries et enseignants. EduNexus configure automatiquement les coefficients, formules de notes et templates de bulletins correspondant à votre établissement.",
  },
]

function AccordionItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-white/[0.06]">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-bold text-white transition-colors hover:text-[#60a5fa]"
      >
        <span>{q}</span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm leading-relaxed text-gray-400">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="bg-[#111827] py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <h2 className="text-4xl font-extrabold text-white sm:text-5xl">Questions fréquentes.</h2>
        </motion.div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#0A0F1E] px-6">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              q={faq.q}
              a={faq.a}
              open={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
