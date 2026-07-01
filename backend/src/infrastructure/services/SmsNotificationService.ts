/**
 * SmsNotificationService — wraps Techsoft sendSMS with:
 *   - Simulation mode when TECHSOFT_API_KEY is absent
 *   - SmsLog persistence (success and failure)
 *   - SchoolNotificationSettings gate per event type
 *   - Never throws — all public functions are fire-and-forget safe
 */
import { prisma } from '@infrastructure/persistence/prisma/prisma.client'
import { sendSMS, isSmsConfigured } from '../../services/smsService'

type SmsType = 'ABSENCE' | 'PAYMENT' | 'BULLETIN' | 'DISCIPLINE'

const DISCIPLINE_TYPE_LABELS: Record<string, string> = {
  WARNING_ORAL: 'Avertissement oral',
  WARNING_WRITTEN: 'Avertissement écrit',
  TEMP_EXCLUSION: 'Exclusion temporaire',
  COUNCIL_DECISION: 'Décision du conseil de discipline',
  PERMANENT_EXCLUSION: 'Exclusion définitive',
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

    const dateStr = opts.date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    const subjectPart = opts.subjectName ? ` en ${opts.subjectName}` : ''
    const message = `EduNexus: ${opts.studentName} a été marqué(e) absent(e) le ${dateStr}${subjectPart}.`

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

    const amountStr = new Intl.NumberFormat('fr-FR').format(opts.amount)
    const message = `EduNexus: Paiement de ${amountStr} XAF reçu pour ${opts.studentName}. Merci !`

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

    const amountStr = new Intl.NumberFormat('fr-FR').format(opts.amount)
    const message = `EduNexus: RAPPEL — Facture "${opts.invoiceLabel}" de ${amountStr} XAF pour ${opts.studentName} est en retard de ${opts.daysOverdue} jour(s). Veuillez régulariser.`

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

    const typeLabel = DISCIPLINE_TYPE_LABELS[opts.type] ?? opts.type
    const message = `EduNexus: ${opts.studentName} a fait l'objet d'une sanction (${typeLabel}). Motif : ${opts.reason}. Contactez l'établissement pour plus d'informations.`

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

    const message = `EduNexus: ALERTE — ${opts.studentName} cumule ${opts.count} absences non justifiées (seuil : ${opts.threshold}). Merci de contacter l'établissement.`

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

    const message = `EduNexus: Le bulletin de ${opts.studentName} (${opts.periodName}) est disponible. Connectez-vous pour le consulter.`

    await Promise.all(phones.map((phone) => dispatchSms(opts.schoolId, phone, message, 'BULLETIN')))
  } catch (err) {
    console.error('[SMS Bulletin] Erreur inattendue:', err)
  }
}
