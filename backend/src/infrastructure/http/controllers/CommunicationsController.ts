import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { sendSMS, isSmsConfigured } from '../../../services/smsService';
import { sendTransactionalEmail, isEmailConfigured } from '../../../services/emailService';

// ─── Types ────────────────────────────────────────────────────────────────────

type BroadcastChannel = 'SMS' | 'EMAIL' | 'BOTH';

interface BroadcastTarget {
  role?: 'STUDENT' | 'PARENT' | 'TEACHER' | 'STAFF';
  classId?: string;
  level?: string;
  paymentStatus?: 'OVERDUE' | 'PENDING' | 'PARTIAL' | 'PAID';
}

interface Recipient {
  name: string;
  phone?: string | null;
  email?: string | null;
  userId?: string;
  className?: string;
  balance?: number;
}

// ─── Variable interpolation ───────────────────────────────────────────────────

const VARS_RE = /\{(nom_eleve|classe|solde)\}/g;

function interpolate(
  template: string,
  vars: { nom_eleve?: string; classe?: string; solde?: string },
): string {
  return template.replace(VARS_RE, (_, key: string) => {
    if (key === 'nom_eleve') return vars.nom_eleve ?? '{nom_eleve}';
    if (key === 'classe')    return vars.classe    ?? '{classe}';
    if (key === 'solde')     return vars.solde     ?? '{solde}';
    return `{${key}}`;
  });
}

// ─── Phone normalization ──────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s+]/g, '');
  return digits.startsWith('237') ? digits : `237${digits}`;
}

// ─── Target resolution ───────────────────────────────────────────────────────

async function resolveRecipients(
  prisma: PrismaClient,
  schoolId: string,
  target: BroadcastTarget,
): Promise<Recipient[]> {
  const recipients: Recipient[] = [];

  // ── Cible : parents d'une classe ou d'un niveau ──────────────────────────
  if (target.classId || target.level || target.paymentStatus) {
    const studentWhere: Record<string, unknown> = { schoolId };
    if (target.classId) studentWhere['classId'] = target.classId;
    if (target.level) {
      const classes = await prisma.class.findMany({
        where: { schoolId, level: target.level },
        select: { id: true },
      });
      studentWhere['classId'] = { in: classes.map((c) => c.id) };
    }

    const students = await prisma.studentProfile.findMany({
      where: studentWhere as any,
      include: {
        user: { select: { firstName: true, lastName: true } },
        class: { select: { name: true } },
        parents: {
          include: {
            parentProfile: {
              include: { user: { select: { id: true, phone: true, email: true } } },
            },
          },
        },
      },
    });

    for (const student of students) {
      // Filtre optionnel sur paymentStatus
      if (target.paymentStatus) {
        const latestInvoice = await (prisma as any).invoice.findFirst({
          where: { schoolId, studentId: student.userId },
          orderBy: { createdAt: 'desc' },
          select: { status: true, amount: true, paidAmount: true },
        });
        if (!latestInvoice) continue;
        if (target.paymentStatus === 'OVERDUE' && latestInvoice.status !== 'OVERDUE') continue;
        if (target.paymentStatus === 'PENDING' && latestInvoice.status !== 'PENDING') continue;
        if (target.paymentStatus === 'PARTIAL' && latestInvoice.status !== 'PARTIAL') continue;
        if (target.paymentStatus === 'PAID'    && latestInvoice.status !== 'PAID')    continue;
      }

      const studentName = `${student.user.lastName} ${student.user.firstName}`;
      const className   = student.class?.name ?? '';

      // Calcul du solde restant (somme des factures non payées)
      const invoices = await (prisma as any).invoice.findMany({
        where: { schoolId, studentId: student.userId, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
        select: { amount: true, paidAmount: true },
      });
      const balance: number = invoices.reduce(
        (acc: number, inv: { amount: number; paidAmount: number }) => acc + (inv.amount - (inv.paidAmount ?? 0)),
        0,
      );

      for (const link of student.parents) {
        const parentUser = link.parentProfile.user;
        recipients.push({
          name: studentName,
          phone: parentUser.phone,
          email: parentUser.email,
          userId: parentUser.id,
          className,
          balance,
        });
      }
    }

    return recipients;
  }

  // ── Cible : rôle direct (STUDENT, TEACHER, STAFF, PARENT) ───────────────
  if (target.role) {
    const users = await prisma.user.findMany({
      where: { schoolId, role: target.role as any, isActive: true },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
    });
    for (const u of users) {
      recipients.push({
        name: `${u.lastName} ${u.firstName}`,
        phone: u.phone,
        email: u.email,
        userId: u.id,
      });
    }
    return recipients;
  }

  return recipients;
}

// ─── SMS dispatch (simulation-safe) ──────────────────────────────────────────

async function dispatchSmsToOne(
  prisma: PrismaClient,
  schoolId: string,
  rawPhone: string,
  message: string,
): Promise<'sent' | 'simulated' | 'failed'> {
  const phone = normalizePhone(rawPhone);
  try {
    if (!isSmsConfigured()) {
      console.log(`[SMS-BROADCAST-SIM] À: ${phone} | ${message}`);
      await (prisma as any).smsLog.create({
        data: { schoolId, to: phone, content: message, type: 'BROADCAST', status: 'simulated', simulated: true },
      });
      return 'simulated';
    }
    const result = await sendSMS(phone, message);
    await (prisma as any).smsLog.create({
      data: {
        schoolId,
        to: phone,
        content: message,
        type: 'BROADCAST',
        status: result.success ? 'sent' : 'failed',
        simulated: false,
      },
    });
    return result.success ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

// ─── Email dispatch ───────────────────────────────────────────────────────────

async function dispatchEmailToOne(
  prisma: PrismaClient,
  schoolId: string,
  recipientEmail: string,
  message: string,
  recipientUserId?: string,
): Promise<'sent' | 'failed'> {
  try {
    const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.5">${message.replace(/\n/g, '<br>')}</div>`;
    const result = await sendTransactionalEmail({
      recipientEmail,
      recipientUserId,
      subject: 'Message de votre établissement',
      html,
      text: message,
      template: 'broadcast',
      eventType: 'discipline_notification', // closest available type
      metadata: { schoolId },
    });
    await (prisma as any).emailLog.create({
      data: {
        schoolId,
        to: recipientEmail,
        subject: 'Message de votre établissement',
        status: result.status,
        provider: 'broadcast',
      },
    });
    return result.status;
  } catch {
    return 'failed';
  }
}

// ─── Diffusion (extrait pour être réutilisable hors HTTP — ex. catalogue copilot) ─

export interface BroadcastResultat {
  total: number;
  sent: number;
  failed: number;
}

export async function executerBroadcast(
  prisma: PrismaClient,
  schoolId: string,
  createdById: string | undefined,
  target: BroadcastTarget,
  channel: BroadcastChannel,
  message: string,
): Promise<BroadcastResultat> {
  const recipients = await resolveRecipients(prisma, schoolId, target);
  if (recipients.length === 0) {
    return { total: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const r of recipients) {
    const vars = {
      nom_eleve: r.name,
      classe: r.className,
      solde: r.balance != null ? new Intl.NumberFormat('fr-FR').format(r.balance) + ' XAF' : undefined,
    };
    const personalizedMsg = interpolate(message, vars);

    if ((channel === 'SMS' || channel === 'BOTH') && r.phone) {
      const result = await dispatchSmsToOne(prisma, schoolId, r.phone, personalizedMsg);
      result === 'failed' ? failed++ : sent++;
    }
    if ((channel === 'EMAIL' || channel === 'BOTH') && r.email) {
      const result = await dispatchEmailToOne(prisma, schoolId, r.email, personalizedMsg, r.userId);
      result === 'failed' ? failed++ : sent++;
    }
    if (!r.phone && !r.email) failed++;
  }

  await (prisma as any).broadcastLog.create({
    data: {
      schoolId,
      channel,
      target,
      message,
      recipientCount: recipients.length,
      sentCount: sent,
      failedCount: failed,
      status: failed === 0 ? 'completed' : sent === 0 ? 'failed' : 'partial',
      createdById,
    },
  });

  return { total: recipients.length, sent, failed };
}

// ─── Controller ───────────────────────────────────────────────────────────────

export class CommunicationsController {
  constructor(private readonly prisma: PrismaClient) {}

  // GET /api/v2/communications/broadcasts/preview?role=&classId=&level=&paymentStatus=
  preview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = (req as any).user.schoolId;
      const { role, classId, level, paymentStatus } = req.query as {
        role?: string; classId?: string; level?: string; paymentStatus?: string;
      };

      const target: BroadcastTarget = {
        role: role as BroadcastTarget['role'],
        classId,
        level,
        paymentStatus: paymentStatus as BroadcastTarget['paymentStatus'],
      };

      const recipients = await resolveRecipients(this.prisma, schoolId, target);
      const withPhone = recipients.filter((r) => r.phone).length;
      const withEmail = recipients.filter((r) => r.email).length;

      res.json({ success: true, data: { total: recipients.length, withPhone, withEmail } });
    } catch (err) {
      next(err);
    }
  };

  // POST /api/v2/communications/broadcast
  broadcast = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId   = (req as any).user.schoolId;
      const createdById = (req as any).user.userId ?? (req as any).user.id;
      const { target, channel, message } = req.body as {
        target: BroadcastTarget;
        channel: BroadcastChannel;
        message: string;
      };

      if (!message?.trim()) {
        res.status(400).json({ success: false, error: 'Le message est requis.' });
        return;
      }
      if (!channel || !['SMS', 'EMAIL', 'BOTH'].includes(channel)) {
        res.status(400).json({ success: false, error: 'Canal invalide. Utilisez SMS, EMAIL ou BOTH.' });
        return;
      }
      if (!target || (!target.role && !target.classId && !target.level && !target.paymentStatus)) {
        res.status(400).json({ success: false, error: 'Aucun filtre de ciblage fourni.' });
        return;
      }

      const resultat = await executerBroadcast(this.prisma, schoolId, createdById, target, channel, message);
      if (resultat.total === 0) {
        res.json({ success: true, data: { ...resultat, message: 'Aucun destinataire trouvé.' } });
        return;
      }

      res.json({ success: true, data: resultat });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/communications/broadcasts?page=1&limit=20
  history = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = (req as any).user.schoolId;
      const page  = Math.max(1, parseInt(String(req.query['page']  ?? 1)));
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query['limit'] ?? 20))));
      const skip  = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        (this.prisma as any).broadcastLog.findMany({
          where: { schoolId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        (this.prisma as any).broadcastLog.count({ where: { schoolId } }),
      ]);

      res.json({ success: true, data: { logs, total, page, limit } });
    } catch (err) {
      next(err);
    }
  };
}
