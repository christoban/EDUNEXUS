'use client'

import { useState, useEffect, Fragment } from 'react'
import type { CSSProperties } from 'react'
import DemoModal from './DemoModal'

// ─────────────────────────────────────────────────────────────────────────────
// TRANSLATIONS
// ─────────────────────────────────────────────────────────────────────────────
const textsFR = {
  nav: {
    badge: 'MINESEC Cameroun',
    features: 'Fonctionnalités',
    howItWorks: 'Comment ça marche',
    plans: 'Plans',
    contact: 'Contact',
    login: 'Se connecter',
    demo: 'Demander une démo',
  },
  hero: {
    badge: '🇨🇲 Plateforme officielle · Système MINESEC Cameroun',
    title: 'La plateforme scolaire de référence au Cameroun',
    subtitle:
      'EduNexus centralise la gestion de votre établissement : notes, présences, bulletins, emploi du temps et paiements Mobile Money. Conforme MINESEC.',
    cta1: '🎓 Demander une démo gratuite',
    cta2: '▶ Voir comment ça marche',
    trust: ['✅ Conforme MINESEC', '🔒 Données hébergées en Afrique', '📱 MTN MoMo & Orange Money', '📶 Mode hors-ligne inclus'],
  },
  stats: {
    items: [
      { icon: '🏫', value: '24+', label: 'Écoles actives' },
      { icon: '👨‍🎓', value: '6 000+', label: 'Élèves gérés' },
      { icon: '👨‍🏫', value: '342', label: 'Enseignants inscrits' },
      { icon: '📱', value: '89%', label: 'Recouvrement Mobile Money' },
    ],
  },
  features: {
    title: 'Tout ce dont votre école a besoin',
    subtitle: 'Pensé pour le système éducatif camerounais',
    items: [
      { icon: '📝', title: 'Notes & Bulletins', desc: 'Coefficients BAC MINESEC, calcul automatique des moyennes, bulletins PDF générés en un clic.' },
      { icon: '✅', title: 'Présences intelligentes', desc: "Saisie rapide par l'enseignant, alertes SMS aux parents, statistiques en temps réel." },
      { icon: '📱', title: 'Mobile Money intégré', desc: 'MTN MoMo & Orange Money via Campay. Rappels automatiques aux parents en retard de paiement.' },
      { icon: '📅', title: 'Emploi du temps', desc: 'Détection de conflits (Loi 7 MINESEC ≤14h/AP), sous-groupes TP, publication en un clic.' },
      { icon: '🤖', title: 'IA Santé Scolaire', desc: 'Score 0-100 par élève : notes, présences, paiements, comportement. Alertes préventives Gemini AI.' },
      { icon: '📶', title: 'Mode hors-ligne', desc: 'Fonctionne sans internet (IndexedDB + service worker). Synchronisation automatique au retour du réseau.' },
    ],
  },
  howItWorks: {
    title: 'Opérationnel en 72 heures',
    steps: [
      { icon: '📧', title: 'Invitation', desc: "L'équipe EduNexus envoie une invitation à votre directeur. Lien d'activation valable 72 heures." },
      { icon: '🏫', title: 'Onboarding guidé', desc: 'Configurez classes, matières, enseignants. Notre assistant vous guide étape par étape.' },
      { icon: '🚀', title: 'Tout le monde connecté', desc: 'Chaque rôle accède à son espace dédié. Enseignants, parents et élèves reçoivent leurs accès.' },
    ],
  },
  roles: {
    title: 'Un espace dédié pour chaque acteur',
    items: [
      {
        icon: '🏫', label: 'Proviseur',
        benefits: ["Vue d'ensemble : KPIs, présences, recouvrement en temps réel", 'Gestion des utilisateurs, classes et matières', 'Clôture d\'année avec promotions automatiques MINESEC', 'Configuration complète de l\'établissement'],
      },
      {
        icon: '👨‍🏫', label: 'Enseignant',
        benefits: ['Saisie des présences en 2 minutes chrono', 'Notes par séquence avec calcul automatique', 'Emploi du temps personnel + alertes conflits', 'Demandes de rattrapage en un clic'],
      },
      {
        icon: '👨‍👩‍👧', label: 'Parent',
        benefits: ['Suivi des notes et bulletins de ses enfants', 'Alertes absences en temps réel par SMS', "Paiements Mobile Money MTN/Orange depuis l'app", "Communication directe avec l'établissement"],
      },
      {
        icon: '👨‍🎓', label: 'Élève',
        benefits: ['Notes, moyennes et bulletins disponibles 24h/24', 'Emploi du temps personnel', 'Examens en ligne soumis directement dans la plateforme', 'Accessible hors-ligne'],
      },
      {
        icon: '🔍', label: 'Censeur',
        benefits: ['Validation des notes des enseignants', 'Conseil de classe avec décisions de promotion', 'Gestion des cautions et discipline', 'Mobile Money : suivi des impayés et rappels'],
      },
    ],
  },
  pricing: {
    title: 'Des plans adaptés à chaque établissement',
    subtitle: 'Démarrez gratuitement, sans carte bancaire',
    recommended: 'RECOMMANDÉ',
    plans: [
      { name: 'Découverte', price: 'Gratuit', recommended: false, features: ['50 élèves max', '2 classes', 'Notes & Présences', 'Support communautaire'], cta: 'Commencer gratuitement' },
      { name: 'Standard', price: 'Sur devis', recommended: true, features: ['300 élèves', 'Classes illimitées', 'Toutes fonctionnalités', 'Mobile Money', 'Support prioritaire'], cta: 'Demander un devis' },
      { name: 'Premium', price: 'Sur devis', recommended: false, features: ['Élèves illimités', 'IA Santé Scolaire', 'Multi-établissements', 'Support dédié + formation'], cta: "Contacter l'équipe" },
    ],
  },
  testimonials: {
    title: 'Ils font confiance à EduNexus',
    items: [
      { quote: 'Depuis EduNexus, les bulletins sont prêts le jour même du conseil de classe. Le recouvrement des frais a augmenté de 40% grâce aux rappels Mobile Money automatiques.', author: 'Mme Ekambi', role: 'Proviseure · Lycée de la Réussite, Yaoundé', initials: 'ME' },
      { quote: 'La saisie des notes prend 10 minutes au lieu de 2 heures. Les coefficients BAC MINESEC sont automatiques — fini les erreurs de calcul.', author: 'M. Ateba', role: 'Directeur · Collège Sainte-Marie, Douala', initials: 'MA' },
      { quote: "Le mode hors-ligne est essentiel pour nous. La connexion est instable, mais EduNexus fonctionne quand même et synchronise dès que le réseau revient.", author: 'M. Fouda', role: 'Censeur · Institut Technique de Bafoussam', initials: 'MF' },
    ],
  },
  faq: {
    title: 'Questions fréquentes',
    items: [
      { q: 'EduNexus est-il conforme au MINESEC ?', a: 'Oui. Coefficients BAC, séquences, notes /20, seuils Art. 48 — préconfiguré selon les arrêtés MINESEC en vigueur.' },
      { q: 'Faut-il internet en permanence ?', a: 'Non. Mode hors-ligne complet (IndexedDB + PWA). Synchronisation automatique dès le retour du réseau.' },
      { q: 'Comment fonctionne le Mobile Money ?', a: "Via Campay (MTN MoMo & Orange Money). Paiement depuis le téléphone, confirmation en temps réel pour l'intendant." },
      { q: 'Combien de temps pour mettre en place EduNexus ?', a: '72 heures en moyenne avec l\'accompagnement de notre équipe.' },
      { q: 'Les données des élèves sont-elles sécurisées ?', a: 'Hébergement en Afrique, chiffrement TLS, MFA obligatoire pour les administrateurs.' },
    ],
  },
  cta: {
    title: 'Rejoignez les établissements qui font confiance à EduNexus',
    subtitle: "Période d'essai gratuite · Aucune carte bancaire · Démarrage en 72h",
    btn: '🎓 Demander une démo gratuite',
  },
  footer: {
    tagline: 'Gestion scolaire · Cameroun · MINESEC',
    copyright: '© 2026 EduNexus · Tous droits réservés',
    cols: {
      product: { title: 'Produit', links: ['Fonctionnalités', 'Plans tarifaires', 'Sécurité', 'API'] },
      resources: { title: 'Ressources', links: ['Documentation', 'Guides MINESEC', 'Blog', 'Support'] },
      company: { title: 'Entreprise', links: ['À propos', 'Carrières', 'Presse', 'Partenaires'] },
      contact: { title: 'Contact', info: ['Yaoundé, Cameroun', 'contact@edunexus.cm', '+237 6XX XXX XXX'] },
    },
  },
}

const textsEN = {
  nav: {
    badge: 'MINESEC Cameroon',
    features: 'Features',
    howItWorks: 'How it works',
    plans: 'Plans',
    contact: 'Contact',
    login: 'Log in',
    demo: 'Request a demo',
  },
  hero: {
    badge: '🇨🇲 Official platform · MINESEC Cameroon',
    title: 'The reference school management platform in Cameroon',
    subtitle: 'EduNexus centralizes your school management: grades, attendance, report cards, timetables and Mobile Money payments. MINESEC compliant.',
    cta1: '🎓 Request a free demo',
    cta2: '▶ See how it works',
    trust: ['✅ MINESEC Compliant', '🔒 Data hosted in Africa', '📱 MTN MoMo & Orange Money', '📶 Offline mode included'],
  },
  stats: {
    items: [
      { icon: '🏫', value: '24+', label: 'Active schools' },
      { icon: '👨‍🎓', value: '6,000+', label: 'Students managed' },
      { icon: '👨‍🏫', value: '342', label: 'Teachers registered' },
      { icon: '📱', value: '89%', label: 'Mobile Money recovery' },
    ],
  },
  features: {
    title: 'Everything your school needs',
    subtitle: 'Designed for the Cameroonian education system',
    items: [
      { icon: '📝', title: 'Grades & Report Cards', desc: 'MINESEC BAC coefficients, automatic average calculation, PDF report cards generated in one click.' },
      { icon: '✅', title: 'Smart Attendance', desc: 'Quick teacher entry, SMS alerts to parents, real-time statistics.' },
      { icon: '📱', title: 'Integrated Mobile Money', desc: 'MTN MoMo & Orange Money via Campay. Automatic reminders to late-paying parents.' },
      { icon: '📅', title: 'Timetable', desc: 'Conflict detection (MINESEC Rule 7 ≤14h/week), lab groups, one-click publishing.' },
      { icon: '🤖', title: 'AI School Health', desc: 'Score 0-100 per student: grades, attendance, payments, behavior. Preventive Gemini AI alerts.' },
      { icon: '📶', title: 'Offline Mode', desc: 'Works without internet (IndexedDB + service worker). Auto-sync when network returns.' },
    ],
  },
  howItWorks: {
    title: 'Operational in 72 hours',
    steps: [
      { icon: '📧', title: 'Invitation', desc: 'The EduNexus team sends an invitation to your headmaster. Activation link valid 72 hours.' },
      { icon: '🏫', title: 'Guided Onboarding', desc: 'Set up classes, subjects, teachers. Our assistant guides you step by step.' },
      { icon: '🚀', title: 'Everyone connected', desc: 'Each role accesses their dedicated space. Teachers, parents and students receive their access.' },
    ],
  },
  roles: {
    title: 'A dedicated space for each stakeholder',
    items: [
      { icon: '🏫', label: 'Principal', benefits: ['Overview: KPIs, attendance, recovery in real time', 'User, class and subject management', 'Year-end with automatic MINESEC promotions', 'Complete school configuration'] },
      { icon: '👨‍🏫', label: 'Teacher', benefits: ['Attendance entry in 2 minutes', 'Grades per sequence with automatic calculation', 'Personal timetable + conflict alerts', 'Make-up class requests in one click'] },
      { icon: '👨‍👩‍👧', label: 'Parent', benefits: ["Track children's grades and report cards", 'Real-time absence alerts by SMS', 'MTN/Orange Mobile Money payments from the app', 'Direct communication with the school'] },
      { icon: '👨‍🎓', label: 'Student', benefits: ['Grades, averages and report cards 24/7', 'Personal timetable', 'Online exams submitted directly in the platform', 'Offline accessible'] },
      { icon: '🔍', label: 'Vice-Principal', benefits: ['Validation of teacher grades', 'Class council with promotion decisions', 'Caution and discipline management', 'Mobile Money: overdue tracking and reminders'] },
    ],
  },
  pricing: {
    title: 'Plans for every school',
    subtitle: 'Start free, no credit card required',
    recommended: 'RECOMMENDED',
    plans: [
      { name: 'Discovery', price: 'Free', recommended: false, features: ['50 students max', '2 classes', 'Grades & Attendance', 'Community support'], cta: 'Start for free' },
      { name: 'Standard', price: 'On request', recommended: true, features: ['300 students', 'Unlimited classes', 'All features', 'Mobile Money', 'Priority support'], cta: 'Request a quote' },
      { name: 'Premium', price: 'On request', recommended: false, features: ['Unlimited students', 'AI School Health', 'Multi-school', 'Dedicated support + training'], cta: 'Contact the team' },
    ],
  },
  testimonials: {
    title: 'Schools that trust EduNexus',
    items: [
      { quote: 'Since EduNexus, report cards are ready on the day of the class council. Fee collection increased by 40% thanks to automatic Mobile Money reminders.', author: 'Mme Ekambi', role: 'Principal · Lycée de la Réussite, Yaoundé', initials: 'ME' },
      { quote: 'Entering grades takes 10 minutes instead of 2 hours. MINESEC BAC coefficients are automatic — no more calculation errors.', author: 'M. Ateba', role: 'Director · Collège Sainte-Marie, Douala', initials: 'MA' },
      { quote: "Offline mode is essential for us. The connection is unstable, but EduNexus still works and syncs as soon as the network comes back.", author: 'M. Fouda', role: 'Vice-Principal · Institut Technique de Bafoussam', initials: 'MF' },
    ],
  },
  faq: {
    title: 'Frequently asked questions',
    items: [
      { q: 'Is EduNexus MINESEC compliant?', a: 'Yes. BAC coefficients, sequences, grades /20, Art. 48 thresholds — pre-configured according to current MINESEC regulations.' },
      { q: 'Do you need internet all the time?', a: 'No. Full offline mode (IndexedDB + PWA). Automatic sync when the network returns.' },
      { q: 'How does Mobile Money work?', a: 'Via Campay (MTN MoMo & Orange Money). Payment from the phone, real-time confirmation for the bursar.' },
      { q: 'How long does it take to set up EduNexus?', a: 'On average 72 hours with our team guidance.' },
      { q: 'Is student data secure?', a: 'Hosted in Africa, TLS encryption, mandatory MFA for administrators.' },
    ],
  },
  cta: {
    title: 'Join the schools that trust EduNexus',
    subtitle: 'Free trial · No credit card · Up and running in 72h',
    btn: '🎓 Request a free demo',
  },
  footer: {
    tagline: 'School management · Cameroon · MINESEC',
    copyright: '© 2026 EduNexus · All rights reserved',
    cols: {
      product: { title: 'Product', links: ['Features', 'Pricing', 'Security', 'API'] },
      resources: { title: 'Resources', links: ['Documentation', 'MINESEC Guides', 'Blog', 'Support'] },
      company: { title: 'Company', links: ['About', 'Careers', 'Press', 'Partners'] },
      contact: { title: 'Contact', info: ['Yaoundé, Cameroon', 'contact@edunexus.cm', '+237 6XX XXX XXX'] },
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STYLE TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const DECO_BAND: CSSProperties = {
  height: 5,
  background: 'repeating-linear-gradient(90deg,#f59e0b 0,#f59e0b 16px,#22c55e 16px,#22c55e 32px,#ef4444 32px,#ef4444 48px,#60a5fa 48px,#60a5fa 64px,#d4a843 64px,#d4a843 80px)',
  flexShrink: 0,
}

// Cards avec border-radius moderne (16px au lieu de 13px)
const CARD: CSSProperties = {
  background: 'white',
  borderRadius: 16,
  border: '1.5px solid #e8e0d4',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
}

// Section heading helper
const SH: CSSProperties = {
  fontFamily: 'var(--font-spectral),Spectral,serif',
  fontSize: 40,
  fontWeight: 700,
  color: '#1a1209',
  textAlign: 'center',
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO MOCKUP (pure HTML, no external images)
// ─────────────────────────────────────────────────────────────────────────────
function HeroMockup() {
  const kpis = [
    { label: 'Élèves présents', value: '418 / 460', icon: '✅', bg: '#d1fae5', text: '#065f46' },
    { label: 'Notes à valider', value: '12', icon: '📝', bg: '#fef3c7', text: '#92400e' },
    { label: 'Frais recouvrés', value: '76%', icon: '💰', bg: '#dbeafe', text: '#1e40af' },
    { label: 'Alertes actives', value: '3', icon: '⚠️', bg: '#fee2e2', text: '#991b1b' },
  ]
  const bars = [
    { cls: '3ème A', pct: 92 },
    { cls: '4ème B', pct: 78 },
    { cls: 'Tle C', pct: 95 },
    { cls: '2nde D', pct: 65 },
  ]

  return (
    <div style={{ ...CARD, padding: 24, width: '100%', maxWidth: 460, boxShadow: '0 24px 72px rgba(0,0,0,0.14)', borderRadius: 20 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#059669,#047857)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>🎓</div>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1209' }}>Tableau de bord — Trimestre 2</div>
        <div style={{ marginLeft: 'auto', background: '#d1fae5', color: '#065f46', fontSize: 10, fontWeight: 900, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>LIVE</div>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: k.bg, borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 18, marginBottom: 3 }}>{k.icon}</div>
            <div style={{ fontSize: 19, fontWeight: 900, color: k.text, lineHeight: 1.1 }}>{k.value}</div>
            <div style={{ fontSize: 10, color: k.text, opacity: 0.7, fontWeight: 600, marginTop: 3 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Attendance bars */}
      <div style={{ background: '#f7f3ee', borderRadius: 12, padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#6b5c45', marginBottom: 10 }}>
          <span>Présences par classe</span>
          <span>Aujourd'hui</span>
        </div>
        {bars.map(row => (
          <div key={row.cls} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <div style={{ width: 46, fontSize: 10, color: '#a89478', fontWeight: 700, flexShrink: 0 }}>{row.cls}</div>
            <div style={{ flex: 1, background: '#e8e0d4', borderRadius: 5, height: 7 }}>
              <div style={{
                width: `${row.pct}%`,
                background: row.pct >= 90 ? '#059669' : row.pct >= 75 ? '#d97706' : '#dc2626',
                borderRadius: 5, height: 7, transition: 'width 600ms ease',
              }} />
            </div>
            <div style={{ width: 30, textAlign: 'right', fontSize: 10, color: '#1a1209', fontWeight: 900, flexShrink: 0 }}>{row.pct}%</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, textAlign: 'center', fontSize: 10, color: '#a89478', fontWeight: 600 }}>
        EduNexus · Lycée Bilingue de Yaoundé · Séquence 3
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const [tabRole, setTabRole] = useState(0)
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const [navScrolled, setNavScrolled] = useState(false)

  const tx = lang === 'fr' ? textsFR : textsEN

  const [demoOpen, setDemoOpen] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  const openDemo = () => setDemoOpen(true)

  // shared button styles — taille standard landing page moderne
  const btnPrimary: CSSProperties = {
    background: 'linear-gradient(135deg,#059669,#047857)',
    color: 'white',
    fontWeight: 800,
    fontSize: 15,
    padding: '14px 28px',
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 3px 12px rgba(5,150,105,0.22)',
    fontFamily: 'inherit',
    transition: 'all 150ms',
    display: 'inline-block',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  }
  const btnSecondary: CSSProperties = {
    background: 'white',
    color: '#6b5c45',
    fontWeight: 700,
    fontSize: 15,
    padding: '14px 28px',
    borderRadius: 10,
    border: '1.5px solid #d4c8b8',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 150ms',
    display: 'inline-block',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ fontFamily: 'var(--font-nunito),Nunito,sans-serif', color: '#1a1209', background: '#f7f3ee' }}>

      {/* ══════════════════════════════════════════════════
          NAVBAR — hauteur 72px, padding horizontal 56px
      ══════════════════════════════════════════════════ */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: 72, background: 'white',
        borderBottom: '1.5px solid #e8e0d4',
        display: 'flex', alignItems: 'center', padding: '0 56px', gap: 40,
        transition: 'box-shadow 200ms',
        boxShadow: navScrolled ? '0 2px 16px rgba(0,0,0,0.07)' : 'none',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
          <span style={{ fontSize: 27 }}>🎓</span>
          <span style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }}>EduNexus</span>
          <span style={{ background: '#f0ebe3', border: '1px solid #e8e0d4', color: '#a89478', fontSize: 14, fontWeight: 700, borderRadius: 20, padding: '2px 11px', marginLeft: 4, whiteSpace: 'nowrap' }}>
            {tx.nav.badge}
          </span>
        </div>

        {/* Links */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 36 }}>
          {[
            { label: tx.nav.features, href: '#fonctionnalites' },
            { label: tx.nav.howItWorks, href: '#comment' },
            { label: tx.nav.plans, href: '#plans' },
            { label: tx.nav.contact, href: '#contact' },
          ].map(link => (
            <a key={link.href} href={link.href}
              style={{ fontSize: 17, fontWeight: 600, color: '#6b5c45', textDecoration: 'none', transition: 'color 150ms' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#059669' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#6b5c45' }}
            >{link.label}</a>
          ))}
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {/* Lang switcher */}
          <div style={{ display: 'flex', background: '#f0ebe3', borderRadius: 8, border: '1px solid #e8e0d4', overflow: 'hidden' }}>
            {(['fr', 'en'] as const).map(l => (
              <button key={l} onClick={() => setLang(l)}
                style={{
                  padding: '6px 11px', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', transition: 'all 150ms',
                  background: lang === l ? '#059669' : 'transparent',
                  color: lang === l ? 'white' : '#6b5c45',
                }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <a href="/login" style={{ ...btnSecondary, fontSize: 17, padding: '9px 18px' }}>{tx.nav.login}</a>
          <button onClick={openDemo} style={{ ...btnPrimary, fontSize: 17, padding: '9px 18px' }}>{tx.nav.demo}</button>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════
          HERO — padding généreux, titre 66px
      ══════════════════════════════════════════════════ */}
      <section style={{ background: '#f7f3ee', paddingTop: 72 }}>
        <div style={DECO_BAND} />
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '100px 64px 112px', display: 'flex', alignItems: 'center', gap: 80 }}>
          {/* Left */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'inline-block', background: '#d1fae5', color: '#065f46', fontSize: 12, fontWeight: 900, borderRadius: 20, padding: '6px 16px', marginBottom: 26 }}>
              {tx.hero.badge}
            </div>
            <h1 style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 66, fontWeight: 700, color: '#1a1209', lineHeight: 1.08, maxWidth: 660, marginBottom: 26 }}>
              {tx.hero.title}
            </h1>
            <p style={{ fontSize: 18, color: '#6b5c45', maxWidth: 540, lineHeight: 1.7, marginBottom: 36, fontWeight: 500 }}>
              {tx.hero.subtitle}
            </p>
            {/* CTAs */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 32 }}>
              <button onClick={openDemo} style={{ ...btnPrimary, fontSize: 16, padding: '16px 32px' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(5,150,105,0.32)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 3px 12px rgba(5,150,105,0.22)' }}
              >{tx.hero.cta1}</button>
              <a href="#comment" style={{ ...btnSecondary, fontSize: 16, padding: '16px 32px' }}>{tx.hero.cta2}</a>
            </div>
            {/* Trust badges */}
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              {tx.hero.trust.map(badge => (
                <span key={badge} style={{ fontSize: 14, color: '#6b5c45', fontWeight: 700 }}>{badge}</span>
              ))}
            </div>
          </div>

          {/* Right — mockup flottant */}
          <div style={{ flexShrink: 0, animation: 'float 4s ease-in-out infinite' }}>
            <HeroMockup />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          STATS — chiffres 52px, padding 72px
      ══════════════════════════════════════════════════ */}
      <section style={{ background: 'white', padding: '72px 64px', borderTop: '1.5px solid #e8e0d4', borderBottom: '1.5px solid #e8e0d4' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 32 }}>
          {tx.stats.items.map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontFamily: 'var(--font-nunito),Nunito,sans-serif', fontSize: 52, fontWeight: 900, color: '#1a1209', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 14, color: '#a89478', fontWeight: 600, marginTop: 8 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FEATURES — grille 3×2, cards padding 32px
      ══════════════════════════════════════════════════ */}
      <section id="fonctionnalites" style={{ background: '#f7f3ee', padding: '112px 64px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 68 }}>
            <h2 style={SH}>{tx.features.title}</h2>
            <p style={{ fontSize: 15, color: '#a89478', fontWeight: 600, marginTop: 10 }}>{tx.features.subtitle}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 28 }}>
            {tx.features.items.map(f => (
              <div key={f.title} style={{ ...CARD, padding: 32, transition: 'box-shadow 200ms,transform 200ms', cursor: 'default' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = '0 8px 28px rgba(0,0,0,0.09)'; el.style.transform = 'translateY(-4px)' }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; el.style.transform = 'translateY(0)' }}
              >
                <div style={{ fontSize: 36, marginBottom: 16 }}>{f.icon}</div>
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 19, fontWeight: 700, color: '#1a1209', marginBottom: 10 }}>{f.title}</div>
                <div style={{ fontSize: 14, color: '#6b5c45', lineHeight: 1.7 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          HOW IT WORKS — cercles 58px, icônes 44px
      ══════════════════════════════════════════════════ */}
      <section id="comment" style={{ background: 'white', padding: '112px 64px', borderTop: '1.5px solid #e8e0d4', borderBottom: '1.5px solid #e8e0d4' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={{ ...SH, marginBottom: 72 }}>{tx.howItWorks.title}</h2>

          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            {tx.howItWorks.steps.map((step, i) => (
              <Fragment key={i}>
                <div style={{ flex: 1, textAlign: 'center', padding: '0 32px' }}>
                  <div style={{ width: 58, height: 58, borderRadius: '50%', background: '#d1fae5', color: '#059669', fontSize: 22, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    {i + 1}
                  </div>
                  <div style={{ fontSize: 44, marginBottom: 14 }}>{step.icon}</div>
                  <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 19, fontWeight: 700, color: '#1a1209', marginBottom: 10 }}>
                    Étape {i + 1} — {step.title}
                  </div>
                  <div style={{ fontSize: 14, color: '#6b5c45', lineHeight: 1.7, maxWidth: 260, margin: '0 auto' }}>{step.desc}</div>
                </div>
                {i < tx.howItWorks.steps.length - 1 && (
                  <div style={{ paddingTop: 22, color: '#d4c8b8', fontSize: 28, flexShrink: 0, alignSelf: 'flex-start' }}>→</div>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          ROLES — tabs + card, padding 40px
      ══════════════════════════════════════════════════ */}
      <section style={{ background: '#f7f3ee', padding: '112px 64px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={{ ...SH, marginBottom: 40 }}>{tx.roles.title}</h2>

          {/* Role tabs */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 40 }}>
            {tx.roles.items.map((r, i) => (
              <button key={i} onClick={() => setTabRole(i)}
                style={{
                  padding: '10px 24px', fontSize: 14, fontWeight: 700, borderRadius: 28, cursor: 'pointer',
                  fontFamily: 'inherit', transition: 'all 150ms',
                  background: tabRole === i ? '#059669' : 'white',
                  color: tabRole === i ? 'white' : '#6b5c45',
                  boxShadow: tabRole === i ? '0 4px 14px rgba(5,150,105,0.25)' : '0 2px 6px rgba(0,0,0,0.06)',
                  border: tabRole !== i ? '1.5px solid #e8e0d4' : '1.5px solid transparent',
                }}>
                {r.icon} {r.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div key={tabRole} style={{ ...CARD, padding: 40, animation: 'fadeIn 0.18s ease' }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>{tx.roles.items[tabRole].icon}</div>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 24, fontWeight: 700, color: '#1a1209', marginBottom: 24 }}>
              Espace {tx.roles.items[tabRole].label}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {tx.roles.items[tabRole].benefits.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#d1fae5', color: '#059669', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>✓</div>
                  <div style={{ fontSize: 15, color: '#6b5c45', lineHeight: 1.6 }}>{b}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          PRICING — cards padding 32px, price 38px
      ══════════════════════════════════════════════════ */}
      <section id="plans" style={{ background: 'white', padding: '112px 64px', borderTop: '1.5px solid #e8e0d4', borderBottom: '1.5px solid #e8e0d4' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 68 }}>
            <h2 style={SH}>{tx.pricing.title}</h2>
            <p style={{ fontSize: 15, color: '#a89478', fontWeight: 600, marginTop: 10 }}>{tx.pricing.subtitle}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 28 }}>
            {tx.pricing.plans.map(plan => (
              <div key={plan.name} style={{
                background: 'white', borderRadius: 18, padding: 32,
                border: plan.recommended ? '2px solid #059669' : '1.5px solid #e8e0d4',
                boxShadow: plan.recommended ? '0 10px 32px rgba(5,150,105,0.14)' : '0 2px 8px rgba(0,0,0,0.06)',
                position: 'relative',
                transition: 'transform 200ms,box-shadow 200ms',
              }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.transform = 'translateY(-6px)'
                  el.style.boxShadow = plan.recommended ? '0 18px 44px rgba(5,150,105,0.22)' : '0 8px 28px rgba(0,0,0,0.09)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.transform = 'translateY(0)'
                  el.style.boxShadow = plan.recommended ? '0 10px 32px rgba(5,150,105,0.14)' : '0 2px 8px rgba(0,0,0,0.06)'
                }}
              >
                {plan.recommended && (
                  <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: '#059669', color: 'white', fontSize: 10, fontWeight: 900, borderRadius: 20, padding: '4px 16px', whiteSpace: 'nowrap' }}>
                    ⭐ {tx.pricing.recommended}
                  </div>
                )}
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 6 }}>{plan.name}</div>
                <div style={{ fontSize: 38, fontWeight: 900, color: plan.recommended ? '#059669' : '#1a1209', marginBottom: 22, lineHeight: 1 }}>{plan.price}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, color: '#6b5c45' }}>
                      <span style={{ color: '#059669', fontWeight: 900 }}>✓</span>{f}
                    </div>
                  ))}
                </div>
                <button onClick={openDemo}
                  style={plan.recommended
                    ? { ...btnPrimary, display: 'block', width: '100%', textAlign: 'center', fontSize: 14, padding: '13px 24px' }
                    : { ...btnSecondary, display: 'block', width: '100%', textAlign: 'center', fontSize: 14, padding: '13px 24px' }
                  }>{plan.cta}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          TESTIMONIALS — cards padding 32px, quote 52px
      ══════════════════════════════════════════════════ */}
      <section style={{ background: '#f7f3ee', padding: '112px 64px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h2 style={{ ...SH, marginBottom: 68 }}>{tx.testimonials.title}</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 28 }}>
            {tx.testimonials.items.map(item => (
              <div key={item.author} style={{ ...CARD, padding: 32 }}>
                <div style={{ fontSize: 52, color: '#059669', fontWeight: 900, fontFamily: 'Georgia,serif', lineHeight: 1, marginBottom: 14 }}>&ldquo;</div>
                <p style={{ fontSize: 15, color: '#6b5c45', lineHeight: 1.75, marginBottom: 24, fontStyle: 'italic' }}>{item.quote}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {item.initials}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1209' }}>{item.author}</div>
                    <div style={{ fontSize: 13, color: '#a89478', marginTop: 2 }}>{item.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FAQ — accordéon, border-radius 12px
      ══════════════════════════════════════════════════ */}
      <section style={{ background: 'white', padding: '112px 64px', borderTop: '1.5px solid #e8e0d4', borderBottom: '1.5px solid #e8e0d4' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2 style={{ ...SH, marginBottom: 64 }}>{tx.faq.title}</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tx.faq.items.map((faq, i) => (
              <div key={i} style={{
                borderRadius: 12, overflow: 'hidden', transition: 'all 150ms',
                border: faqOpen === i ? '1.5px solid #059669' : '1.5px solid #e8e0d4',
                borderLeft: faqOpen === i ? '4px solid #059669' : '1.5px solid #e8e0d4',
                background: faqOpen === i ? '#f0ebe3' : 'white',
              }}>
                <button onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1209' }}>{faq.q}</span>
                  <span style={{ fontSize: 20, color: '#059669', fontWeight: 900, transition: 'transform 150ms', transform: faqOpen === i ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0, marginLeft: 16 }}>▾</span>
                </button>
                {faqOpen === i && (
                  <div style={{ padding: '0 24px 20px', fontSize: 15, color: '#6b5c45', lineHeight: 1.75, animation: 'fadeIn 0.15s ease' }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          CTA FINAL — padding 120px, titre 52px
      ══════════════════════════════════════════════════ */}
      <section id="contact" style={{
        backgroundImage: 'url(https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=1600&q=80)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
      }}>
        {/* Overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,46,30,0.82)', zIndex: 0 }} />
        {/* Deco band */}
        <div style={{ ...DECO_BAND, position: 'relative', zIndex: 1 }} />
        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, padding: '120px 64px', textAlign: 'center', overflow: 'hidden' }}>
          {/* Decorative circles */}
          <div style={{ position: 'absolute', top: 48, left: '7%', width: 240, height: 240, borderRadius: '50%', background: 'rgba(5,150,105,0.1)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: 48, right: '6%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(5,150,105,0.07)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '35%', right: '18%', width: 140, height: 140, borderRadius: '50%', background: 'rgba(74,222,128,0.06)', pointerEvents: 'none' }} />

          <h2 style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 52, fontWeight: 700, color: 'white', maxWidth: 720, margin: '0 auto 24px', lineHeight: 1.15 }}>
            {tx.cta.title}
          </h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', marginBottom: 44 }}>
            {tx.cta.subtitle}
          </p>
          <button onClick={openDemo}
            style={{
              background: '#4ade80', color: '#1a2e1e',
              fontWeight: 900, fontSize: 18, padding: '20px 52px', borderRadius: 12,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 150ms',
              boxShadow: '0 6px 24px rgba(74,222,128,0.32)',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = '#22c55e'
              el.style.boxShadow = '0 8px 32px rgba(74,222,128,0.48)'
              el.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = '#4ade80'
              el.style.boxShadow = '0 6px 24px rgba(74,222,128,0.32)'
              el.style.transform = 'translateY(0)'
            }}
          >
            {tx.cta.btn}
          </button>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FOOTER — padding 72px/44px, maxWidth 1200
      ══════════════════════════════════════════════════ */}
      <footer style={{ background: '#243b29', padding: '72px 64px 44px', color: 'white' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 56, marginBottom: 56 }}>
            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                <span style={{ fontSize: 24 }}>🎓</span>
                <span style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'white' }}>EduNexus</span>
              </div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.42)', lineHeight: 1.75 }}>{tx.footer.tagline}</div>
            </div>

            {/* Produit */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>{tx.footer.cols.product.title}</div>
              {tx.footer.cols.product.links.map(l => (
                <a key={l} href="#" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.48)', textDecoration: 'none', marginBottom: 10, transition: 'color 150ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#4ade80' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.48)' }}
                >{l}</a>
              ))}
            </div>

            {/* Ressources */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>{tx.footer.cols.resources.title}</div>
              {tx.footer.cols.resources.links.map(l => (
                <a key={l} href="#" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.48)', textDecoration: 'none', marginBottom: 10, transition: 'color 150ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#4ade80' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.48)' }}
                >{l}</a>
              ))}
            </div>

            {/* Entreprise */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>{tx.footer.cols.company.title}</div>
              {tx.footer.cols.company.links.map(l => (
                <a key={l} href="#" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.48)', textDecoration: 'none', marginBottom: 10, transition: 'color 150ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#4ade80' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.48)' }}
                >{l}</a>
              ))}
            </div>

            {/* Contact */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>{tx.footer.cols.contact.title}</div>
              {tx.footer.cols.contact.info.map(l => (
                <div key={l} style={{ fontSize: 14, color: 'rgba(255,255,255,0.48)', marginBottom: 10 }}>{l}</div>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.28)' }}>{tx.footer.copyright}</div>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.07)', borderRadius: 8, overflow: 'hidden' }}>
              {(['fr', 'en'] as const).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  style={{
                    padding: '6px 13px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', transition: 'all 150ms',
                    background: lang === l ? '#059669' : 'transparent',
                    color: lang === l ? 'white' : 'rgba(255,255,255,0.38)',
                  }}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* ── DEMO MODAL ───────────────────────────────── */}
      <DemoModal
        isOpen={demoOpen}
        onClose={() => setDemoOpen(false)}
        onSuccess={() => {
          setDemoOpen(false)
          setToast({ msg: '✅ Demande envoyée ! Nous vous contactons dans les 24h.', type: 'success' })
        }}
        onError={msg => setToast({ msg: `❌ ${msg}`, type: 'error' })}
        lang={lang}
      />

      {/* ── TOAST ────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 32, right: 32, zIndex: 300,
          background: toast.type === 'success' ? '#059669' : '#dc2626',
          color: 'white', padding: '14px 22px', borderRadius: 12,
          fontSize: 15, fontWeight: 700,
          boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
          animation: 'fadeIn 0.2s ease', maxWidth: 400,
          lineHeight: 1.5,
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
