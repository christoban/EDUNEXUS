'use client'

import { useState, useEffect } from 'react'
import { Menu, X, ChevronDown, Hexagon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const navLinks = [
  { label: 'Fonctionnalités', href: '#fonctionnalites' },
  { label: 'Tarifs', href: '#tarifs' },
  { label: 'FAQ', href: '#faq' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (href: string) => {
    setMobileOpen(false)
    const el = document.querySelector(href)
    el?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className={`transition-all duration-300 ${
        scrolled
          ? 'bg-[#0A0F1E]/80 backdrop-blur-xl border-b border-white/[0.06]'
          : 'bg-transparent'
      }`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="#" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563EB]">
              <Hexagon className="h-5 w-5 text-white" fill="white" />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-white">
              Edu<span className="text-[#2563EB]">Nexus</span>
            </span>
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="text-sm font-semibold text-gray-400 transition-colors hover:text-white"
              >
                {link.label}
              </button>
            ))}
            <a
              href="/master/login"
              className="text-sm font-semibold text-gray-300 transition-colors hover:text-white"
            >
              Se connecter
            </a>
            <button
              onClick={() => scrollTo('#cta')}
              className="rounded-lg bg-[#2563EB] px-5 py-2 text-sm font-bold text-white shadow-lg shadow-[#2563EB]/25 transition-all hover:bg-[#1d4ed8] hover:shadow-[#2563EB]/35"
            >
              Demander une démo →
            </button>
          </nav>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-white md:hidden"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="border-t border-white/[0.06] bg-[#0A0F1E]/95 backdrop-blur-xl md:hidden"
          >
            <nav className="flex flex-col gap-2 px-4 py-4">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => scrollTo(link.href)}
                  className="rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
                >
                  {link.label}
                </button>
              ))}
              <a
                href="/master/login"
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                Se connecter
              </a>
              <button
                onClick={() => scrollTo('#cta')}
                className="mt-2 rounded-lg bg-[#2563EB] px-5 py-2.5 text-center text-sm font-bold text-white"
              >
                Demander une démo →
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
