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

type SmsType = 'ABSENCE' | 'PAYMENT' | 'BULLETIN' | 'DISCIPLINE'

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
    fr: (name: string, date: string, subjectPart: string) => `EduNexus: ${name} a été marqué(e) absent(e) le ${date}${subjectPart}.`,
    en: (name: string, date: string, subjectPart: string) => `EduNexus: ${name} was marked absent on ${date}${subjectPart}.`,
  },
  payment: {
    fr: (name: string, amount: string) => `EduNexus: Paiement de ${amount} XAF reçu pour ${name}. Merci !`,
    en: (name: string, amount: string) => `EduNexus: Payment of ${amount} XAF received for ${name}. Thank you!`,
  },
  overdue: {
    fr: (name: string, label: string, amount: string, days: number) => `EduNexus: RAPPEL — Facture "${label}" de ${amount} XAF pour ${name} est en retard de ${days} jour(s). Veuillez régulariser.`,
    en: (name: string, label: string, amount: string, days: number) => `EduNexus: REMINDER — Invoice "${label}" of ${amount} XAF for ${name} is ${days} day(s) overdue. Please settle it.`,
  },
  discipline: {
    fr: (name: string, typeLabel: string, reason: string) => `EduNexus: ${name} a fait l'objet d'une sanction (${typeLabel}). Motif : ${reason}. Contactez l'établissement pour plus d'informations.`,
    en: (name: string, typeLabel: string, reason: string) => `EduNexus: ${name} received a disciplinary sanction (${typeLabel}). Reason: ${reason}. Please contact the school for more information.`,
  },
  absenceThreshold: {
    fr: (name: string, count: number, threshold: number) => `EduNexus: ALERTE — ${name} cumule ${count} absences non justifiées (seuil : ${threshold}). Merci de contacter l'établissement.`,
    en: (name: string, count: number, threshold: number) => `EduNexus: ALERT — ${name} has ${count} unexcused absences (threshold: ${threshold}). Please contact the school.`,
  },
  bulletin: {
    fr: (name: string, period: string) => `EduNexus: Le bulletin de ${name} (${period}) est disponible. Connectez-vous pour le consulter.`,
    en: (name: string, period: string) => `EduNexus: ${name}'s report card (${period}) is available. Log in to view it.`,
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
