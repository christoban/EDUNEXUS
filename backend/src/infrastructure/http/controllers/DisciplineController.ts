import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient, DisciplineType } from '@prisma/client';
import { journaliserActionIA } from '@infrastructure/services/AIActionAuditLogger';
import { notifierParentsPushDabord } from '@infrastructure/services/PushFirstNotifier';
import { notifyDisciplineSms } from '@infrastructure/services/SmsNotificationService';
import { sendTransactionalEmail } from '../../../services/emailService';

/**
 * Préfixe /api/v2/discipline — sanctions disciplinaires (ADMIN, STAFF).
 * Extrait de hexagonal.bootstrap.ts (déviation architecturale corrigée).
 * Les types COUNCIL_DECISION/PERMANENT_EXCLUSION sont refusés ici et redirigés
 * vers /api/v2/discipline-council (workflow Art. 30).
 */
export class DisciplineController {
  constructor(private readonly prisma: PrismaClient) {}

  // GET /api/v2/discipline — liste des sanctions
  lister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { studentId, type, status, page = '1', limit = '30' } = req.query as Record<string, string>;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const where: any = {
        schoolId,
        ...(studentId ? { studentId } : {}),
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
      };
      const [total, records] = await Promise.all([
        this.prisma.disciplineRecord.count({ where }),
        this.prisma.disciplineRecord.findMany({
          where,
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            decidedBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
      ]);
      journaliserActionIA(this.prisma, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'sanctions_recentes_eleve', targetType: 'DisciplineRecord', targetId: studentId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { studentId, type, status },
      });
      res.json({ success: true, data: records, pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) } });
    } catch (err) {
      journaliserActionIA(this.prisma, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'sanctions_recentes_eleve', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined,
      });
      next(err);
    }
  };

  // POST /api/v2/discipline — créer une sanction
  creer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { studentId, type, reason, startDate, endDate } = req.body as Record<string, string>;
      if (!studentId || !type || !reason) {
        res.status(400).json({ success: false, message: 'studentId, type et reason sont requis' });
        return;
      }
      const validTypes = ['WARNING_ORAL', 'WARNING_WRITTEN', 'TEMP_EXCLUSION', 'COUNCIL_DECISION', 'PERMANENT_EXCLUSION'];
      if (!validTypes.includes(type)) {
        res.status(400).json({ success: false, message: `type invalide. Valeurs : ${validTypes.join(', ')}` });
        return;
      }
      // Décision grave : exige un Conseil de Discipline conforme Art. 30 (convocation 72h,
      // composition légale, PV) — voir /api/v2/discipline-council. Chantier Juillet 2026.
      if (type === 'COUNCIL_DECISION' || type === 'PERMANENT_EXCLUSION') {
        res.status(400).json({
          success: false,
          code: 'CONSEIL_DISCIPLINE_REQUIS',
          message: "Une décision de conseil ou une exclusion définitive ne peut être créée qu'en tenant un Conseil de Discipline (convocation 72h + composition légale + PV). Utilisez /api/v2/discipline-council.",
        });
        return;
      }
      const student = await this.prisma.user.findFirst({ where: { id: studentId, schoolId, role: 'STUDENT' } });
      if (!student) { res.status(404).json({ success: false, message: 'Élève introuvable' }); return; }
      const record = await this.prisma.disciplineRecord.create({
        data: {
          schoolId, studentId, type: type as DisciplineType, reason,
          decidedById: req.user!.userId,
          ...(startDate ? { startDate: new Date(startDate) } : {}),
          ...(endDate ? { endDate: new Date(endDate) } : {}),
        },
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
          decidedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      journaliserActionIA(this.prisma, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'enregistrer_sanction', targetType: 'DisciplineRecord', targetId: record.id,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { studentId, type, reason, startDate, endDate },
      });
      res.status(201).json({ success: true, data: record });

      // Fire-and-forget : notification SMS + email aux parents
      void (async () => {
        try {
          const studentName = `${record.student.firstName} ${record.student.lastName}`.trim();
          const { phonesSansPush } = await notifierParentsPushDabord({
            schoolId, studentId, type: 'DISCIPLINE_SANCTION',
            titre: 'Sanction disciplinaire',
            corps: `${studentName} a fait l'objet d'une sanction disciplinaire. Motif : ${reason}.`,
          });
          await notifyDisciplineSms({
            schoolId,
            studentId,
            studentName,
            type,
            reason,
            phones: phonesSansPush,
          });

          const parentLinks = await this.prisma.parentStudent.findMany({
            where: { studentProfile: { userId: studentId } },
            include: { parentProfile: { include: { user: { select: { email: true } } } } },
          });
          const parentEmails = parentLinks
            .map((l) => l.parentProfile?.user?.email)
            .filter((e): e is string => Boolean(e));

          for (const email of [...new Set(parentEmails)]) {
            await sendTransactionalEmail({
              recipientEmail: email,
              subject: `Notification disciplinaire — ${studentName}`,
              html: `<p>Bonjour,</p><p><b>${studentName}</b> a fait l'objet d'une sanction disciplinaire.</p><p><b>Type :</b> ${type}</p><p><b>Motif :</b> ${reason}</p><p>Merci de contacter l'établissement pour plus d'informations.</p>`,
              text: `Sanction disciplinaire pour ${studentName} : ${type} — ${reason}`,
              template: 'discipline_notification',
              eventType: 'discipline_notification',
              metadata: { schoolId },
            });
          }
        } catch (err) {
          console.error('[Notification discipline fire-and-forget]', err);
        }
      })();
    } catch (err) {
      journaliserActionIA(this.prisma, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'enregistrer_sanction', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined, parametersSummary: req.body,
      });
      next(err);
    }
  };

  // PATCH /api/v2/discipline/:id/lift — lever une sanction
  lever = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const record = await this.prisma.disciplineRecord.findFirst({ where: { id: req.params.id as string, schoolId } });
      if (!record) { res.status(404).json({ success: false, message: 'Sanction introuvable' }); return; }
      const updated = await this.prisma.disciplineRecord.update({
        where: { id: record.id },
        data: { status: 'LIFTED' },
        include: { student: { select: { id: true, firstName: true, lastName: true } } },
      });
      journaliserActionIA(this.prisma, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'lever_sanction', targetType: 'DisciplineRecord', targetId: record.id,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { disciplineRecordId: record.id },
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      journaliserActionIA(this.prisma, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'lever_sanction', targetType: 'DisciplineRecord', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined,
      });
      next(err);
    }
  };
}