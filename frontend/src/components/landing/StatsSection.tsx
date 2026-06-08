'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

const stats = [
  { value: '500+', label: 'Établissements' },
  { value: '17', label: "Types d'écoles" },
  { value: '3', label: 'Langues' },
  { value: '98%', label: 'Uptime' },
]

function CountUp({ to, suffix = '' }: { to: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const num = parseInt(to.replace(/\D/g, ''))
  const display = inView ? to : '0'

  return (
    <span ref={ref} className="text-4xl font-extrabold text-white sm:text-5xl">
      {display}{suffix}
    </span>
  )
}

export default function StatsSection() {
  return (
    <section className="border-y border-white/[0.06] bg-[#111827] py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center"
            >
              <CountUp to={stat.value} />
              <div className="mt-1 text-sm font-semibold text-gray-500">{stat.label}</div>
            </motion.div>
          ))}
        </div>
        <div className="mt-10 text-center text-xs font-medium text-gray-600">
          Conforme au Décret 2001/041 · Arrêtés MINESEC · Circulaire 32/09/MINESEC/IGE · Décret 95-035 BAC
        </div>
      </div>
    </section>
  )
}
