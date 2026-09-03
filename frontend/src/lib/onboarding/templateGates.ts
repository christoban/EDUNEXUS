import type { TemplateCatalogEntry } from './templateCatalogTypes'

const PEBS_FR = new Set(['LYCEE_FR', 'CES_FR', 'PRIVE_FR', 'LYCEE_BILINGUE'])
const PEBS_EN = new Set(['GHS_EN', 'GSS_EN', 'PRIVE_EN', 'LYCEE_BILINGUE'])

export const isPebsFrEligible = (code: string): boolean => PEBS_FR.has(code)
export const isPebsEnEligible = (code: string): boolean => PEBS_EN.has(code)

export function showPremierCycle(t: TemplateCatalogEntry | null): boolean {
  return !!t?.hasPremierCycle
}
export function showDeuxiemeCycle(t: TemplateCatalogEntry | null): boolean {
  return !!t?.hasDeuxiemeCycle
}
export function showSeriesFr(t: TemplateCatalogEntry | null): boolean {
  if (!t?.hasDeuxiemeCycle) return false
  return t.subsystem === 'FRANCOPHONE' || t.subsystem === 'BILINGUAL'
}
export function showStreamsEn(t: TemplateCatalogEntry | null): boolean {
  if (!t?.hasDeuxiemeCycle) return false
  return t.subsystem === 'ANGLOPHONE' || t.subsystem === 'BILINGUAL'
}
export function showTechnique(t: TemplateCatalogEntry | null): boolean {
  return !!t?.isTechnique
}
export function showPrimaire(t: TemplateCatalogEntry | null): boolean {
  return !!t?.isPrimaire
}
export function showLv2(t: TemplateCatalogEntry | null): boolean {
  if (!t?.hasPremierCycle) return false
  return t.langMode === 'francophone' || t.langMode === 'bilingual'
}
