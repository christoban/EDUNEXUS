'use client'

import { motion } from 'framer-motion'

export default function CTASection() {
  return (
    <section id="cta" className="relative overflow-hidden bg-gradient-to-br from-[#1D4ED8] to-[#2563EB] py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white opacity-[0.04] blur-[60px]" />
        <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-white opacity-[0.04] blur-[60px]" />
      </div>
      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-4xl font-extrabold text-white sm:text-5xl"
        >
          Prêt à moderniser votre établissement ?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mx-auto mt-4 max-w-2xl text-lg text-blue-200"
        >
          Rejoignez les centaines d&apos;écoles camerounaises qui font confiance à EduNexus.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
        >
          <button className="rounded-xl bg-white px-8 py-3.5 text-base font-bold text-[#1D4ED8] shadow-lg transition-all hover:bg-gray-100">
            Commencer gratuitement
          </button>
          <button className="rounded-xl border border-white/30 px-8 py-3.5 text-base font-bold text-white transition-all hover:bg-white/10">
            Parler à un conseiller
          </button>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.35 }}
          className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-blue-200"
        >
          <span>✓ 3 mois gratuits</span>
          <span>✓ Migration de données incluse</span>
          <span>✓ Formation du personnel incluse</span>
        </motion.div>
      </div>
    </section>
  )
}
