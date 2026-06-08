'use client'

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

const plans = [
  {
    name: 'DÉCOUVERTE',
    price: 'Gratuit',
    sub: '3 mois',
    popular: false,
    features: ['≤ 100 élèves', 'Notes', 'Présences', 'Bulletins base'],
    cta: 'Commencer',
  },
  {
    name: 'STANDARD',
    price: '15 000 FCFA',
    sub: '/mois',
    popular: false,
    features: ['≤ 500 élèves', '+ Finance', '+ Mobile Money', '+ Communication', '+ Bulletins avancés'],
    cta: 'Choisir',
  },
  {
    name: 'PREMIUM',
    price: '35 000 FCFA',
    sub: '/mois',
    popular: true,
    features: ['Illimité', '+ IA Gemini', '+ Mode hors ligne', '+ Rapports auto', '+ Messagerie avancée'],
    cta: 'Choisir',
  },
  {
    name: 'ÉTABLISSEMENT+',
    price: 'Sur devis',
    sub: '',
    popular: false,
    features: ['Multi-écoles', 'Sous direction unique'],
    cta: 'Nous contacter',
  },
]

export default function PricingSection() {
  return (
    <section id="tarifs" className="bg-[#0A0F1E] py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-4 text-center"
        >
          <h2 className="text-4xl font-extrabold text-white sm:text-5xl">Un plan pour chaque établissement.</h2>
          <p className="mt-3 text-lg text-gray-400">Commencez gratuitement. Évoluez quand vous êtes prêt.</p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-4">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                plan.popular
                  ? 'border-[#2563EB] bg-[#1a1f2e] shadow-lg shadow-[#2563EB]/10'
                  : 'border-white/[0.08] bg-[#111827]'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2563EB] px-4 py-1 text-xs font-bold text-white">
                  Le plus populaire
                </div>
              )}
              <div className="mb-1 text-sm font-bold text-gray-500">{plan.name}</div>
              <div className="mb-1">
                <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                {plan.sub && <span className="ml-1 text-sm text-gray-500">{plan.sub}</span>}
              </div>
              <div className="mb-6 mt-auto space-y-3">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-gray-300">
                    <Check className="h-4 w-4 shrink-0 text-[#10B981]" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <button
                className={`w-full rounded-xl py-2.5 text-sm font-bold transition-all ${
                  plan.popular
                    ? 'bg-[#2563EB] text-white shadow-lg shadow-[#2563EB]/20 hover:bg-[#1d4ed8]'
                    : 'border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {plan.cta}
              </button>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 text-center text-xs text-gray-600">
          *Commission 0.5–1% sur transactions Mobile Money · Module SMS disponible en option
        </div>
      </div>
    </section>
  )
}
