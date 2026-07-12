'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { fetchApi } from '@/lib/fetchApi'

// Dictionnaire FR importé STATIQUEMENT (synchrone) → il est disponible dès le premier
// rendu, donc aucune clé brute (ex. « sidebar.dashboard ») ne s'affiche pendant que la
// langue de l'école se résout. Une école francophone ne voit aucun flash ; une école
// anglophone bascule FR→EN une seule fois après résolution.
import frCommon from '@/locales/fr/common.json'
import frNavigation from '@/locales/fr/navigation.json'
import frAdmin from '@/locales/fr/admin.json'
import frTeacher from '@/locales/fr/teacher.json'
import frStaff from '@/locales/fr/staff.json'
import frParent from '@/locales/fr/parent.json'
import frStudent from '@/locales/fr/student.json'
import frGrades from '@/locales/fr/grades.json'
import frFinance from '@/locales/fr/finance.json'
import frDiscipline from '@/locales/fr/discipline.json'
import frErrors from '@/locales/fr/errors.json'
import frOnboarding from '@/locales/fr/onboarding.json'

// Dictionnaires EN importés STATIQUEMENT eux aussi (l'import() dynamique s'avère peu fiable
// selon le navigateur/appareil — un toggle de langue qui « ne fait rien » sur mobile en était
// le symptôme). Léger surcoût de bundle, mais bascule FR↔EN garantie partout, synchrone.
import enCommon from '@/locales/en/common.json'
import enNavigation from '@/locales/en/navigation.json'
import enAdmin from '@/locales/en/admin.json'
import enTeacher from '@/locales/en/teacher.json'
import enStaff from '@/locales/en/staff.json'
import enParent from '@/locales/en/parent.json'
import enStudent from '@/locales/en/student.json'
import enGrades from '@/locales/en/grades.json'
import enFinance from '@/locales/en/finance.json'
import enDiscipline from '@/locales/en/discipline.json'
import enErrors from '@/locales/en/errors.json'
import enOnboarding from '@/locales/en/onboarding.json'

export type Language = 'fr' | 'en'
type Subsystem = 'FRANCOPHONE' | 'ANGLOPHONE' | 'BILINGUAL'
type Dictionary = Record<string, any>
type Namespace =
  | 'common' | 'navigation' | 'admin' | 'teacher' | 'staff'
  | 'parent' | 'student' | 'grades' | 'finance' | 'discipline' | 'errors'
  | 'onboarding'

const ALL_NAMESPACES: Namespace[] = [
  'common', 'navigation', 'admin', 'teacher', 'staff',
  'parent', 'student', 'grades', 'finance', 'discipline', 'errors',
  'onboarding',
]

// Dictionnaires complets FR et EN, prêts synchrones dès le chargement du module.
const FR_DICTS: Record<Namespace, Dictionary> = {
  common: frCommon, navigation: frNavigation, admin: frAdmin, teacher: frTeacher,
  staff: frStaff, parent: frParent, student: frStudent, grades: frGrades,
  finance: frFinance, discipline: frDiscipline, errors: frErrors, onboarding: frOnboarding,
}
const EN_DICTS: Record<Namespace, Dictionary> = {
  common: enCommon, navigation: enNavigation, admin: enAdmin, teacher: enTeacher,
  staff: enStaff, parent: enParent, student: enStudent, grades: enGrades,
  finance: enFinance, discipline: enDiscipline, errors: enErrors, onboarding: enOnboarding,
}

const DICTS_BY_LANG: Record<Language, Record<Namespace, Dictionary>> = { fr: FR_DICTS, en: EN_DICTS }

export function resolveLanguage(
  subsystem: Subsystem | string | null | undefined,
  sectionCode?: string | null,
): Language {
  if (subsystem === 'ANGLOPHONE') return 'en'
  if (subsystem === 'BILINGUAL') return sectionCode === 'EN' ? 'en' : 'fr'
  return 'fr'
}

function getBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'fr'
  return navigator.language?.startsWith('en') ? 'en' : 'fr'
}

// Résolution synchrone depuis les maps statiques (plus aucun import dynamique).
function loadAllDictionaries(lang: Language): Record<Namespace, Dictionary> {
  return DICTS_BY_LANG[lang]
}

interface I18nContextValue {
  lang: Language
  t: (namespace: Namespace) => (key: string, params?: Record<string, string | number>) => string
  changeLanguage: (lang: Language) => Promise<void>
  loading: boolean
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>('fr')
  // Démarre avec le dictionnaire FR synchrone (jamais null) → pas de flash de clés.
  const [dicts, setDicts] = useState<Record<Namespace, Dictionary>>(FR_DICTS)
  const [loading, setLoading] = useState(true)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    let cancelled = false

    async function init() {
      let subsystem: Subsystem | null = null
      let status: string | null = null
      let loggedIn = false

      try {
        const raw = localStorage.getItem('zekoulabia_user')
        if (raw) {
          loggedIn = true
          const res = await fetchApi('/api/v2/school/me')
          if (res.ok) {
            const body = await res.json()
            if (body?.success && body.data) {
              subsystem = (body.data.subsystem ?? null) as Subsystem | null
              status = (body.data.status ?? null) as string | null
            }
          }
        }
      } catch {
        /* network error — will fall back below */
      }

      // Priorité 1 : surcharge manuelle explicite de l'utilisateur (toggle de langue).
      // Utile notamment pendant l'onboarding : un anglophone peut basculer en EN, et son
      // choix est mémorisé. Prime sur toute résolution automatique.
      const override = localStorage.getItem('zekoulabia_lang_override')

      // L'onboarding (page publique par lien d'invitation) doit démarrer en FRANÇAIS, pas selon
      // le navigateur : c'est là que l'établissement DÉCLARE sa langue, et un flip surprise
      // FR→EN en plein remplissage est déroutant. Le toggle FR/EN reste disponible pour basculer.
      const onOnboarding = typeof window !== 'undefined' && window.location.pathname.startsWith('/onboarding')

      // Priorité 2 : la langue officielle de l'établissement ne s'applique qu'une fois l'école
      // ACTIVE (configuration terminée). Pendant l'onboarding (statut APPROVED / route publique)
      // ou si le sous-système est indéterminé, on reste en FRANÇAIS (défaut sûr, majorité
      // francophone au Cameroun) — JAMAIS la langue du navigateur pour un utilisateur connecté ou
      // en onboarding. Les pages publiques restantes (landing, login) suivent le navigateur.
      const resolved: Language =
        override === 'fr' || override === 'en'
          ? override
          : status === 'ACTIVE' && subsystem
            ? resolveLanguage(subsystem)
            : loggedIn || onOnboarding
              ? 'fr'
              : getBrowserLanguage()

      // FR est déjà en place (état initial). On ne bascule que si EN est requis.
      if (resolved === 'en' && !cancelled) {
        setLang('en')
        setDicts(loadAllDictionaries('en'))
      }
      if (!cancelled) setLoading(false)
    }

    init()
    return () => { cancelled = true }
  }, [])

  function resolveKey(namespace: Namespace, key: string, params?: Record<string, string | number>): string {
    if (!dicts) return params ? key.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`)) : key
    const dict = dicts[namespace]
    if (!dict) return key
    let val: any = key.split('.').reduce((acc: any, part) => acc?.[part], dict)
    if (typeof val !== 'string') {
      if (Array.isArray(val) || (typeof val === 'object' && val !== null)) return val
      val = key
    }
    if (params) val = val.replace(/\{(\w+)\}/g, (_match: string, k: string) => String(params[k] ?? `{${k}}`))
    return val
  }

  const t = useCallback(
    (namespace: Namespace) => (key: string, params?: Record<string, string | number>) => resolveKey(namespace, key, params),
    [dicts],
  )

  const changeLanguage = useCallback(async (newLang: Language) => {
    setLoading(true)
    // Mémorise le choix explicite (persistant, prioritaire au prochain chargement).
    try { localStorage.setItem('zekoulabia_lang_override', newLang) } catch { /* ignore */ }
    setLang(newLang)
    setDicts(loadAllDictionaries(newLang))
    setLoading(false)
  }, [])

  return (
    <I18nContext.Provider value={{ lang, t, changeLanguage, loading }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useT(namespace: Namespace): (key: string, params?: Record<string, string | number>) => string {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT must be used within a LanguageProvider')
  return ctx.t(namespace)
}

export function useLanguage(): { lang: Language; loading: boolean } {
  const ctx = useContext(I18nContext)
  if (!ctx) return { lang: 'fr', loading: true }
  return { lang: ctx.lang, loading: ctx.loading }
}

export function useChangeLanguage(): (lang: Language) => Promise<void> {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useChangeLanguage must be used within a LanguageProvider')
  return ctx.changeLanguage
}
