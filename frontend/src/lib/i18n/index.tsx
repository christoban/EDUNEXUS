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

const DICTIONARY_LOADERS: Record<Language, Record<Namespace, () => Promise<Dictionary>>> = {
  fr: {
    common: () => import('@/locales/fr/common.json').then(m => m.default),
    navigation: () => import('@/locales/fr/navigation.json').then(m => m.default),
    admin: () => import('@/locales/fr/admin.json').then(m => m.default),
    teacher: () => import('@/locales/fr/teacher.json').then(m => m.default),
    staff: () => import('@/locales/fr/staff.json').then(m => m.default),
    parent: () => import('@/locales/fr/parent.json').then(m => m.default),
    student: () => import('@/locales/fr/student.json').then(m => m.default),
    grades: () => import('@/locales/fr/grades.json').then(m => m.default),
    finance: () => import('@/locales/fr/finance.json').then(m => m.default),
    discipline: () => import('@/locales/fr/discipline.json').then(m => m.default),
    errors: () => import('@/locales/fr/errors.json').then(m => m.default),
    onboarding: () => import('@/locales/fr/onboarding.json').then(m => m.default),
  },
  en: {
    common: () => import('@/locales/en/common.json').then(m => m.default),
    navigation: () => import('@/locales/en/navigation.json').then(m => m.default),
    admin: () => import('@/locales/en/admin.json').then(m => m.default),
    teacher: () => import('@/locales/en/teacher.json').then(m => m.default),
    staff: () => import('@/locales/en/staff.json').then(m => m.default),
    parent: () => import('@/locales/en/parent.json').then(m => m.default),
    student: () => import('@/locales/en/student.json').then(m => m.default),
    grades: () => import('@/locales/en/grades.json').then(m => m.default),
    finance: () => import('@/locales/en/finance.json').then(m => m.default),
    discipline: () => import('@/locales/en/discipline.json').then(m => m.default),
    errors: () => import('@/locales/en/errors.json').then(m => m.default),
    onboarding: () => import('@/locales/en/onboarding.json').then(m => m.default),
  },
}

// Dictionnaire FR complet, prêt synchrone dès le chargement du module.
const FR_DICTS: Record<Namespace, Dictionary> = {
  common: frCommon, navigation: frNavigation, admin: frAdmin, teacher: frTeacher,
  staff: frStaff, parent: frParent, student: frStudent, grades: frGrades,
  finance: frFinance, discipline: frDiscipline, errors: frErrors, onboarding: frOnboarding,
}

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

async function loadAllDictionaries(lang: Language): Promise<Record<Namespace, Dictionary>> {
  const loaders = DICTIONARY_LOADERS[lang]
  const entries = await Promise.all(
    ALL_NAMESPACES.map(async (ns) => [ns, await loaders[ns]()] as const),
  )
  return Object.fromEntries(entries) as Record<Namespace, Dictionary>
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

      try {
        const raw = localStorage.getItem('edunexus_user')
        if (raw) {
          const res = await fetchApi('/api/v2/school/me')
          if (res.ok) {
            const body = await res.json()
            if (body?.success && body.data?.subsystem) {
              subsystem = body.data.subsystem as Subsystem
            }
          }
        }
      } catch {
        /* network error — will fall back to browser language */
      }

      const resolved: Language = subsystem
        ? resolveLanguage(subsystem)
        : getBrowserLanguage()

      // FR est déjà chargé (synchrone). On ne charge dynamiquement que si EN est requis.
      if (resolved === 'en') {
        const loaded = await loadAllDictionaries('en')
        if (!cancelled) {
          setLang('en')
          setDicts(loaded)
        }
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
    if (typeof val !== 'string') val = key
    if (params) val = val.replace(/\{(\w+)\}/g, (_match: string, k: string) => String(params[k] ?? `{${k}}`))
    return val
  }

  const t = useCallback(
    (namespace: Namespace) => (key: string, params?: Record<string, string | number>) => resolveKey(namespace, key, params),
    [dicts],
  )

  const changeLanguage = useCallback(async (newLang: Language) => {
    setLoading(true)
    const loaded = await loadAllDictionaries(newLang)
    setLang(newLang)
    setDicts(loaded)
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
