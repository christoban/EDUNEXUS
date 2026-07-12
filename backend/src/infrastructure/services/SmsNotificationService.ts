/**
 * SmsNotificationService — wraps Techsoft sendSMS with:
 *   - Simulation mode when TECHSOFT_API_KEY is absent
 *   - SmsLog persistence (success and failure)
 *   - SchoolNotificationSettings gate per event type
 *   - Never throws — all public functions are fire-and-forget safe
 */
import { prisma } from '@infrastructure/persistence/prisma/prisma.client'
import { sendSMS, isSmsConfigured } from '../../services/smsService'
import { resolveLanguage, type Language } from '../../utils/languageHelper'

type SmsType = 'ABSENCE' | 'PAYMENT' | 'BULLETIN' | 'DISCIPLINE' | 'ADMISSION' | 'PEBS' | 'LV2' | 'ONBOARDING'

const DISCIPLINE_TYPE_LABELS: Record<string, { fr: string; en: string }> = {
  WARNING_ORAL:        { fr: 'Avertissement oral',                 en: 'Verbal warning' },
  WARNING_WRITTEN:     { fr: 'Avertissement écrit',                en: 'Written warning' },
  TEMP_EXCLUSION:      { fr: 'Exclusion temporaire',               en: 'Temporary exclusion' },
  COUNCIL_DECISION:    { fr: 'Décision du conseil de discipline',  en: 'Disciplinary council decision' },
  PERMANENT_EXCLUSION: { fr: 'Exclusion définitive',               en: 'Permanent exclusion' },
}

// ── Templates SMS bilingues (fr/en) ─────────────────────────────────────────
// La langue est résolue par resolveSmsLanguage() (sous-système + section si bilingue).
const smsTemplates = {
  absence: {
    fr: (name: string, date: string, subjectPart: string) => `ZekoulABia: ${name} a été marqué(e) absent(e) le ${date}${subjectPart}.`,
    en: (name: string, date: string, subjectPart: string) => `ZekoulABia: ${name} was marked absent on ${date}${subjectPart}.`,
  },
  payment: {
    fr: (name: string, amount: string) => `ZekoulABia: Paiement de ${amount} XAF reçu pour ${name}. Merci !`,
    en: (name: string, amount: string) => `ZekoulABia: Payment of ${amount} XAF received for ${name}. Thank you!`,
  },
  overdue: {
    fr: (name: string, label: string, amount: string, days: number) => `ZekoulABia: RAPPEL — Facture "${label}" de ${amount} XAF pour ${name} est en retard de ${days} jour(s). Veuillez régulariser.`,
    en: (name: string, label: string, amount: string, days: number) => `ZekoulABia: REMINDER — Invoice "${label}" of ${amount} XAF for ${name} is ${days} day(s) overdue. Please settle it.`,
  },
  discipline: {
    fr: (name: string, typeLabel: string, reason: string) => `ZekoulABia: ${name} a fait l'objet d'une sanction (${typeLabel}). Motif : ${reason}. Contactez l'établissement pour plus d'informations.`,
    en: (name: string, typeLabel: string, reason: string) => `ZekoulABia: ${name} received a disciplinary sanction (${typeLabel}). Reason: ${reason}. Please contact the school for more information.`,
  },
  absenceThreshold: {
    fr: (name: string, count: number, threshold: number) => `ZekoulABia: ALERTE — ${name} cumule ${count} absences non justifiées (seuil : ${threshold}). Merci de contacter l'établissement.`,
    en: (name: string, count: number, threshold: number) => `ZekoulABia: ALERT — ${name} has ${count} unexcused absences (threshold: ${threshold}). Please contact the school.`,
  },
  bulletin: {
    fr: (name: string, period: string) => `ZekoulABia: Le bulletin de ${name} (${period}) est disponible. Connectez-vous pour le consulter.`,
    en: (name: string, period: string) => `ZekoulABia: ${name}'s report card (${period}) is available. Log in to view it.`,
  },
  admissionProvisoire: {
    fr: (name: string) => `ZekoulABia: ${name} est admis(e) provisoirement au concours d'entrée. L'admission sera confirmée après résultat du CEP.`,
    en: (name: string) => `ZekoulABia: ${name} has been provisionally admitted to the entrance exam. Admission will be confirmed after the CEP result.`,
  },
  cepConfirme: {
    fr: (name: string) => `ZekoulABia: Félicitations ! ${name} a réussi le CEP, son admission en 6e est confirmée.`,
    en: (name: string) => `ZekoulABia: Congratulations! ${name} passed the CEP, admission into Form 1 is confirmed.`,
  },
  cepAnnule: {
    fr: (name: string) => `ZekoulABia: ${name} n'a pas obtenu le CEP. L'admission en 6e ne peut malheureusement pas être maintenue. Contactez l'établissement pour plus d'informations.`,
    en: (name: string) => `ZekoulABia: ${name} did not pass the CEP. Admission into Form 1 unfortunately cannot be maintained. Please contact the school for more information.`,
  },
  pebsSelectionne: {
    fr: (name: string) => `ZekoulABia: ${name} a été sélectionné(e) pour le Programme Spécial Bilingue (PEBS) et a été transféré(e) dans la classe correspondante.`,
    en: (name: string) => `ZekoulABia: ${name} has been selected for the Special Bilingual Programme (PEBS) and has been transferred to the corresponding class.`,
  },
  pebsNonSelectionne: {
    fr: (name: string) => `ZekoulABia: ${name} n'a pas été sélectionné(e) pour le Programme Spécial Bilingue (PEBS) cette année.`,
    en: (name: string) => `ZekoulABia: ${name} was not selected for the Special Bilingual Programme (PEBS) this year.`,
  },
  lv2WindowOpen: {
    fr: (name: string, level: string, closeDate: string) => `ZekoulABia: La période de choix de la LV2 pour ${level} est ouverte jusqu'au ${closeDate}. Merci de faire le choix de ${name} depuis son compte élève.`,
    en: (name: string, level: string, closeDate: string) => `ZekoulABia: The LV2 choice period for ${level} is open until ${closeDate}. Please submit ${name}'s choice from their student account.`,
  },
  minesecOverdue: {
    fr: (name: string, amount: string, types: string) => `ZekoulABia: RAPPEL — Frais MINESEC (${types}) de ${amount} XAF en retard pour ${name}. Ce paiement se fait exclusivement sur cartescolaire.cm.`,
    en: (name: string, amount: string, types: string) => `ZekoulABia: REMINDER — MINESEC fees (${types}) of ${amount} XAF overdue for ${name}. This payment is made exclusively on cartescolaire.cm.`,
  },
  onboardingLink: {
    fr: (nomProvisoire: string, schoolName: string, expiryDays: number) => `ZekoulABia: ${schoolName} vous invite à compléter le dossier d'inscription de ${nomProvisoire}. Consultez votre email pour le lien (valable ${expiryDays} jours).`,
    en: (nomProvisoire: string, schoolName: string, expiryDays: number) => `ZekoulABia: ${schoolName} invites you to complete ${nomProvisoire}'s enrollment file. Check your email for the link (valid ${expiryDays} days).`,
  },
  onboardingReminder: {
    fr: (nomProvisoire: string, schoolName: string) => `ZekoulABia: RAPPEL — Le dossier d'inscription de ${nomProvisoire} pour ${schoolName} n'est pas encore complété. Consultez votre email pour le lien.`,
    en: (nomProvisoire: string, schoolName: string) => `ZekoulABia: REMINDER — ${nomProvisoire}'s enrollment file for ${schoolName} is not yet completed. Check your email for the link.`,
  },
  onboardingActivated: {
    fr: (schoolName: string) => `ZekoulABia: Le dossier d'inscription a été validé par ${schoolName}. Consultez votre email pour configurer votre mot de passe.`,
    en: (schoolName: string) => `ZekoulABia: The enrollment file has been validated by ${schoolName}. Check your email to set up your password.`,
  },
}

/**
 * Résout la langue du SMS pour un élève : sous-système de l'école, et — en bilingue —
 * la section (FR/EN) de l'élève concerné, afin que le parent reçoive le SMS dans la
 * langue de la section de son enfant.
 */
async function resolveSmsLanguage(schoolId: string, studentId: string): Promise<Language> {
  try {
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { subsystem: true } })
    if (school?.subsystem !== 'BILINGUAL') return resolveLanguage(school?.subsystem)
    const sp = await prisma.studentProfile.findUnique({
      where: { userId: studentId },
      select: { class: { select: { section: { select: { code: true } } } } },
    })
    return resolveLanguage('BILINGUAL', sp?.class?.section?.code ?? null)
  } catch {
    return 'fr'
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────

async function persistLog(data: {
  schoolId: string
  to: string
  content: string
  type: SmsType
  status: string
  simulated: boolean
}): Promise<void> {
  try {
    await (prisma as any).smsLog.create({
      data: {
        schoolId: data.schoolId,
        to: data.to,
        content: data.content,
        status: data.status,
        type: data.type,
        simulated: data.simulated,
      },
    })
  } catch {
    // Log failures are silent — never block the main flow
  }
}

async function getNotifSettings(schoolId: string): Promise<{
  smsAbsences: boolean
  smsPayments: boolean
  smsBulletins: boolean
}> {
  try {
    const s = await (prisma as any).schoolNotificationSettings.findUnique({
      where: { schoolId },
    })
    // Pas encore de paramètres → on adopte les défauts du schéma (tous à true)
    return s ?? { smsAbsences: true, smsPayments: true, smsBulletins: true }
  } catch {
    return { smsAbsences: true, smsPayments: true, smsBulletins: true }
  }
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\s+/g, '').replace(/^\+/, '')
  return digits.startsWith('237') ? digits : `237${digits}`
}

async function dispatchSms(
  schoolId: string,
  rawPhone: string,
  message: string,
  type: SmsType,
): Promise<void> {
  if (!rawPhone) return
  const phone = normalizePhone(rawPhone)

  if (!isSmsConfigured()) {
    console.log(`[SMS-SIMULATION] À: ${phone} | Type: ${type} | Message: ${message}`)
    await persistLog({ schoolId, to: phone, content: message, type, status: 'simulated', simulated: true })
    return
  }

  const result = await sendSMS(phone, message)
  await persistLog({
    schoolId,
    to: phone,
    content: message,
    type,
    status: result.success ? 'sent' : 'failed',
    simulated: false,
  })
}

async function getParentPhones(studentId: string): Promise<string[]> {
  try {
    const sp = await prisma.studentProfile.findUnique({ where: { userId: studentId } })
    if (!sp) return []

    const links = await prisma.parentStudent.findMany({
      where: { studentProfileId: sp.id },
      include: { parentProfile: { include: { user: { select: { phone: true } } } } },
    })

    return links
      .map((l) => l.parentProfile.user.phone)
      .filter((p): p is string => Boolean(p))
  } catch {
    return []
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function notifyAbsenceSms(opts: {
  schoolId: string
  studentId: string
  studentName: string
  date: Date
  subjectName?: string
}): Promise<void> {
  try {
    const settings = await getNotifSettings(opts.schoolId)
    if (!settings.smsAbsences) return

    const phones = await getParentPhones(opts.studentId)
    if (phones.length === 0) return

    const lang = await resolveSmsLanguage(opts.schoolId, opts.studentId)
    const dateStr = opts.date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    const subjectPart = opts.subjectName ? (lang === 'fr' ? ` en ${opts.subjectName}` : ` in ${opts.subjectName}`) : ''
    const message = smsTemplates.absence[lang](opts.studentName, dateStr, subjectPart)

    await Promise.all(phones.map((phone) => dispatchSms(opts.schoolId, phone, message, 'ABSENCE')))
  } catch (err) {
    console.error('[SMS Absence] Erreur inattendue:', err)
  }
}

export async function notifyPaymentSms(opts: {
  schoolId: string
  studentId: string
  studentName: string
  amount: number
  parentPhone?: string
}): Promise<void> {
  try {
    const settings = await getNotifSettings(opts.schoolId)
    if (!settings.smsPayments) return

    const phones = opts.parentPhone
      ? [opts.parentPhone]
      : await getParentPhones(opts.studentId)
    if (phones.length === 0) return

    const lang = await resolveSmsLanguage(opts.schoolId, opts.studentId)
    const amountStr = new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US').format(opts.amount)
    const message = smsTemplates.payment[lang](opts.studentName, amountStr)

    await Promise.all(phones.map((phone) => dispatchSms(opts.schoolId, phone, message, 'PAYMENT')))
  } catch (err) {
    console.error('[SMS Paiement] Erreur inattendue:', err)
  }
}

export async function notifyOverdueInvoiceSms(opts: {
  schoolId: string
  studentId: string
  studentName: string
  amount: number
  daysOverdue: number
  invoiceLabel: string
}): Promise<void> {
  try {
    const settings = await getNotifSettings(opts.schoolId)
    if (!settings.smsPayments) return

    const phones = await getParentPhones(opts.studentId)
    if (phones.length === 0) return

    const lang = await resolveSmsLanguage(opts.schoolId, opts.studentId)
    const amountStr = new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US').format(opts.amount)
    const message = smsTemplates.overdue[lang](opts.studentName, opts.invoiceLabel, amountStr, opts.daysOverdue)

    await Promise.all(phones.map((phone) => dispatchSms(opts.schoolId, phone, message, 'PAYMENT')))
  } catch (err) {
    console.error('[SMS Overdue Invoice] Erreur inattendue:', err)
  }
}

export async function notifyDisciplineSms(opts: {
  schoolId: string
  studentId: string
  studentName: string
  type: string
  reason: string
}): Promise<void> {
  try {
    const phones = await getParentPhones(opts.studentId)
    if (phones.length === 0) return

    const lang = await resolveSmsLanguage(opts.schoolId, opts.studentId)
    const typeLabel = DISCIPLINE_TYPE_LABELS[opts.type]?.[lang] ?? opts.type
    const message = smsTemplates.discipline[lang](opts.studentName, typeLabel, opts.reason)

    await Promise.all(phones.map((phone) => dispatchSms(opts.schoolId, phone, message, 'DISCIPLINE')))
  } catch (err) {
    console.error('[SMS Discipline] Erreur inattendue:', err)
  }
}

export async function notifyAbsenceThresholdSms(opts: {
  schoolId: string
  studentId: string
  studentName: string
  count: number
  threshold: number
}): Promise<void> {
  try {
    const settings = await getNotifSettings(opts.schoolId)
    if (!settings.smsAbsences) return

    const phones = await getParentPhones(opts.studentId)
    if (phones.length === 0) return

    const lang = await resolveSmsLanguage(opts.schoolId, opts.studentId)
    const message = smsTemplates.absenceThreshold[lang](opts.studentName, opts.count, opts.threshold)

    await Promise.all(phones.map((phone) => dispatchSms(opts.schoolId, phone, message, 'ABSENCE')))
  } catch (err) {
    console.error('[SMS Seuil Absences] Erreur inattendue:', err)
  }
}

export async function notifyBulletinSms(opts: {
  schoolId: string
  studentId: string
  studentName: string
  periodName: string
}): Promise<void> {
  try {
    const settings = await getNotifSettings(opts.schoolId)
    if (!settings.smsBulletins) return

    const phones = await getParentPhones(opts.studentId)
    if (phones.length === 0) return

    const lang = await resolveSmsLanguage(opts.schoolId, opts.studentId)
    const message = smsTemplates.bulletin[lang](opts.studentName, opts.periodName)

    await Promise.all(phones.map((phone) => dispatchSms(opts.schoolId, phone, message, 'BULLETIN')))
  } catch (err) {
    console.error('[SMS Bulletin] Erreur inattendue:', err)
  }
}

/**
 * Résout la langue pour un candidat au concours d'entrée — celui-ci n'a pas encore de
 * compte élève/classe/section à ce stade, on se limite donc à la langue de base de l'école.
 */
async function resolveSchoolBaseLanguage(schoolId: string): Promise<Language> {
  try {
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { subsystem: true } })
    return resolveLanguage(school?.subsystem)
  } catch {
    return 'fr'
  }
}

// ── Module Examens & Affectations (concours d'entrée, sélection PEBS, choix LV2) ──

export async function notifyAdmissionProvisoireSms(opts: {
  schoolId: string
  candidateName: string
  parentPhone: string | null
}): Promise<void> {
  try {
    if (!opts.parentPhone) return
    const lang = await resolveSchoolBaseLanguage(opts.schoolId)
    const message = smsTemplates.admissionProvisoire[lang](opts.candidateName)
    await dispatchSms(opts.schoolId, opts.parentPhone, message, 'ADMISSION')
  } catch (err) {
    console.error('[SMS Admission Provisoire] Erreur inattendue:', err)
  }
}

export async function notifyCepResultSms(opts: {
  schoolId: string
  candidateName: string
  parentPhone: string | null
  result: 'REUSSI' | 'ECHOUE'
}): Promise<void> {
  try {
    if (!opts.parentPhone) return
    const lang = await resolveSchoolBaseLanguage(opts.schoolId)
    const message = opts.result === 'REUSSI'
      ? smsTemplates.cepConfirme[lang](opts.candidateName)
      : smsTemplates.cepAnnule[lang](opts.candidateName)
    await dispatchSms(opts.schoolId, opts.parentPhone, message, 'ADMISSION')
  } catch (err) {
    console.error('[SMS Résultat CEP] Erreur inattendue:', err)
  }
}

export async function notifyPebsSelectionSms(opts: {
  schoolId: string
  studentUserId: string
  studentName: string
  selected: boolean
}): Promise<void> {
  try {
    const phones = await getParentPhones(opts.studentUserId)
    if (phones.length === 0) return

    const lang = await resolveSmsLanguage(opts.schoolId, opts.studentUserId)
    const message = opts.selected
      ? smsTemplates.pebsSelectionne[lang](opts.studentName)
      : smsTemplates.pebsNonSelectionne[lang](opts.studentName)

    await Promise.all(phones.map((phone) => dispatchSms(opts.schoolId, phone, message, 'PEBS')))
  } catch (err) {
    console.error('[SMS Sélection PEBS] Erreur inattendue:', err)
  }
}

export async function notifyMinesecOverdueSms(opts: {
  schoolId: string
  studentUserId: string
  studentName: string
  amount: number
  typesFrais: string
}): Promise<void> {
  try {
    const settings = await getNotifSettings(opts.schoolId)
    if (!settings.smsPayments) return

    const phones = await getParentPhones(opts.studentUserId)
    if (phones.length === 0) return

    const lang = await resolveSmsLanguage(opts.schoolId, opts.studentUserId)
    const amountStr = new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US').format(opts.amount)
    const message = smsTemplates.minesecOverdue[lang](opts.studentName, amountStr, opts.typesFrais)

    await Promise.all(phones.map((phone) => dispatchSms(opts.schoolId, phone, message, 'PAYMENT')))
  } catch (err) {
    console.error('[SMS MINESEC Overdue] Erreur inattendue:', err)
  }
}

export async function notifyLv2WindowOpenSms(opts: {
  schoolId: string
  studentUserId: string
  studentName: string
  level: string
  closeDate: Date
}): Promise<void> {
  try {
    const phones = await getParentPhones(opts.studentUserId)
    if (phones.length === 0) return

    const lang = await resolveSmsLanguage(opts.schoolId, opts.studentUserId)
    const dateStr = opts.closeDate.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
    const message = smsTemplates.lv2WindowOpen[lang](opts.studentName, opts.level, dateStr)

    await Promise.all(phones.map((phone) => dispatchSms(opts.schoolId, phone, message, 'LV2')))
  } catch (err) {
    console.error('[SMS Fenêtre LV2] Erreur inattendue:', err)
  }
}

// ── Module Onboarding Auto-Service Élèves ───────────────────────────────────
// Le contact (téléphone) est déjà connu explicitement via StudentOnboarding.contactTelephone
// — pas de lookup via getParentPhones ici, contrairement aux notifications post-inscription
// (l'élève/parent n'a pas encore de compte au moment du lien ou de la relance).

export async function notifyOnboardingLinkSms(opts: {
  schoolId: string
  nomProvisoire: string
  schoolName: string
  phone: string | null
  expiryDays: number
}): Promise<void> {
  try {
    if (!opts.phone) return
    const lang = await resolveSchoolBaseLanguage(opts.schoolId)
    const message = smsTemplates.onboardingLink[lang](opts.nomProvisoire, opts.schoolName, opts.expiryDays)
    await dispatchSms(opts.schoolId, opts.phone, message, 'ONBOARDING')
  } catch (err) {
    console.error('[SMS Onboarding Lien] Erreur inattendue:', err)
  }
}

export async function notifyOnboardingReminderSms(opts: {
  schoolId: string
  nomProvisoire: string
  schoolName: string
  phone: string | null
}): Promise<void> {
  try {
    if (!opts.phone) return
    const lang = await resolveSchoolBaseLanguage(opts.schoolId)
    const message = smsTemplates.onboardingReminder[lang](opts.nomProvisoire, opts.schoolName)
    await dispatchSms(opts.schoolId, opts.phone, message, 'ONBOARDING')
  } catch (err) {
    console.error('[SMS Onboarding Relance] Erreur inattendue:', err)
  }
}

export async function notifyOnboardingActivatedSms(opts: {
  schoolId: string
  schoolName: string
  phone: string | null
}): Promise<void> {
  try {
    if (!opts.phone) return
    const lang = await resolveSchoolBaseLanguage(opts.schoolId)
    const message = smsTemplates.onboardingActivated[lang](opts.schoolName)
    await dispatchSms(opts.schoolId, opts.phone, message, 'ONBOARDING')
  } catch (err) {
    console.error('[SMS Onboarding Activé] Erreur inattendue:', err)
  }
}
