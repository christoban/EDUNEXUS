import type { Request, Response, NextFunction } from 'express';
import { logActivity } from '../../services/audit/ActivityLogService';
import { journaliserActionIA } from '@infrastructure/services/ai/AIActionAuditLogger';
import { notifyBulletinSms } from '../../services/sms/SmsNotificationService.ts';
import type { PreparerVueConseilClasseUseCase } from '@application/classCouncil/PreparerVueConseilClasseUseCase';
import type { ListerSessionsConseilClasseUseCase } from '@application/classCouncil/ListerSessionsConseilClasseUseCase';
import type { ObtenirSessionConseilClasseUseCase } from '@application/classCouncil/ObtenirSessionConseilClasseUseCase';
import type { AjouterDecisionConseilClasseUseCase } from '@application/classCouncil/AjouterDecisionConseilClasseUseCase';
import type { AjouterDecisionsEnBlocUseCase } from '@application/classCouncil/AjouterDecisionsEnBlocUseCase';
import type { VerrouillerConseilClasseUseCase } from '@application/classCouncil/VerrouillerConseilClasseUseCase';
import type { PublierBulletinsConseilClasseUseCase } from '@application/classCouncil/PublierBulletinsConseilClasseUseCase';
import type { GenererProcesVerbalUseCase } from '@application/classCouncil/GenererProcesVerbalUseCase';
import type { GenererRapportConseilUseCase } from '@application/classCouncil/GenererRapportConseilUseCase';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { renderClassCouncilMinutesPdf } from '../../pdf/class-council/ClassCouncilMinutesPdfRenderer';
import { renderClassCouncilReportPdf } from '../../pdf/class-council/ClassCouncilReportPdfRenderer';

type AuthUser = { schoolId: string; userId: string; role: string; permissions?: string[] };

export class ClassCouncilController {
  constructor(
    private readonly preparerVueConseil: PreparerVueConseilClasseUseCase,
    private readonly listerSessions: ListerSessionsConseilClasseUseCase,
    private readonly obtenirSession: ObtenirSessionConseilClasseUseCase,
    private readonly ajouterDecision: AjouterDecisionConseilClasseUseCase,
    private readonly ajouterDecisionsEnBloc: AjouterDecisionsEnBlocUseCase,
    private readonly verrouiller: VerrouillerConseilClasseUseCase,
    private readonly publierBulletins: PublierBulletinsConseilClasseUseCase,
    private readonly genererPV: GenererProcesVerbalUseCase,
    private readonly genererRapport: GenererRapportConseilUseCase,
  ) {}

  private user(req: Request): AuthUser {
    return req.user as AuthUser;
  }

  private canManage(user: AuthUser): boolean {
    return user.role.toUpperCase() === 'ADMIN' || (user.permissions ?? []).includes('VALIDATE_GRADES');
  }

  // POST /api/v2/class-councils
  creerSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.user(req);
      const { classId, academicPeriodId } = req.body;

      if (!classId || !academicPeriodId) {
        res.status(400).json({ message: 'classId et academicPeriodId sont requis' });
        return;
      }
      if (!this.canManage(user)) {
        res.status(403).json({ message: 'Permission VALIDATE_GRADES requise' });
        return;
      }

      const schoolClass = await prisma.class.findFirst({
        where: { id: classId, schoolId: user.schoolId },
        select: { id: true, name: true },
      });
      if (!schoolClass) {
        res.status(404).json({ message: 'Classe introuvable' });
        return;
      }

      const unvalidated = await prisma.grade.count({
        where: {
          schoolId: user.schoolId,
          classId,
          sequence: { academicPeriodId },
          validationStatus: { notIn: ['VALIDATED', 'LOCKED'] },
        },
      });
      if (unvalidated > 0) {
        res.status(409).json({
          message: `${unvalidated} note(s) non encore validée(s). Validez toutes les notes avant de tenir le Conseil de Classe.`,
          unvalidatedCount: unvalidated,
          blocked: true,
        });
        return;
      }

      const existing = await prisma.classCouncilSession.findFirst({ where: { classId, academicPeriodId } });
      if (existing) {
        res.status(409).json({
          message: 'Une session de Conseil de Classe existe déjà pour cette classe et cette période',
          session: existing,
        });
        return;
      }

      const session = await prisma.classCouncilSession.create({
        data: { schoolId: user.schoolId, classId, academicPeriodId, presidedById: user.userId, status: 'OPEN' },
        include: {
          class: { select: { id: true, name: true } },
          academicPeriod: { select: { id: true, name: true } },
          presidedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      const { whereProfilesParClasse } = await import('@application/shared/studentEnrollment');
      const students = await prisma.studentProfile.findMany({
        where: { ...whereProfilesParClasse(classId) },
        select: { userId: true },
      });
      if (students.length > 0) {
        await prisma.classCouncilDecision.createMany({
          data: students.map(s => ({
            sessionId: session.id,
            studentId: s.userId,
            decision: 'DELIBERATION' as any,
            observations: null,
          })),
          skipDuplicates: true,
        });
      }

      await logActivity({
        userId: user.userId,
        schoolId: user.schoolId,
        action: 'Class council session created',
        details: `Classe ${schoolClass.name} — période ${academicPeriodId} — ${students.length} élève(s) pré-peuplé(s)`,
      });

      journaliserActionIA(prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'ouvrir_conseil_classe', targetType: 'Class', targetId: classId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { classId, academicPeriodId },
      });
      res.status(201).json({ session });
    } catch (error) {
      const user = this.user(req);
      journaliserActionIA(prisma, {
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'ouvrir_conseil_classe', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      next(error);
    }
  };

  // GET /api/v2/class-councils
  listerSessionsHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.user(req);
      const { classId, academicPeriodId } = req.query as Record<string, string>;
      const result = await this.listerSessions.execute({ schoolId: user.schoolId, classId, academicPeriodId });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/class-councils/preview
  preparerVueHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.user(req);

      if (['STUDENT', 'PARENT'].includes(user.role.toUpperCase())) {
        res.status(403).json({ message: 'Réservé à la direction et au censeur' });
        return;
      }
      if (!this.canManage(user)) {
        res.status(403).json({ message: 'Permission VALIDATE_GRADES requise' });
        return;
      }

      const { classId, academicPeriodId } = req.query as Record<string, string>;
      if (!classId || !academicPeriodId) {
        res.status(400).json({ message: 'classId et academicPeriodId sont requis' });
        return;
      }

      const classe = await prisma.class.findFirst({
        where: { id: classId, schoolId: user.schoolId },
        select: { id: true },
      });
      if (!classe) {
        res.status(404).json({ message: 'Classe introuvable' });
        return;
      }

      const vue = await this.preparerVueConseil.execute({
        schoolId: user.schoolId,
        classId,
        academicPeriodId,
      });
      res.json({ vue });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/class-councils/:id
  obtenirSessionHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.user(req);
      const result = await this.obtenirSession.execute({
        sessionId: req.params.id as string,
        schoolId: user.schoolId,
        userRole: user.role,
        userId: user.userId,
      });
      if (!result) { res.status(404).json({ message: 'Session introuvable' }); return; }
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/class-councils/:id/decisions
  ajouterDecisionHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.user(req);
      const { studentId, decision, observations } = req.body;

      if (!studentId || !decision) {
        res.status(400).json({ message: 'studentId et decision sont requis' });
        return;
      }
      if (!this.canManage(user)) {
        res.status(403).json({ message: 'Permission VALIDATE_GRADES requise' });
        return;
      }

      const result = await this.ajouterDecision.execute({
        sessionId: req.params.id as string,
        studentId,
        decision,
        observations,
        schoolId: user.schoolId,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/class-councils/:id/decisions/bulk
  ajouterDecisionsEnBlocHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.user(req);
      if (!this.canManage(user)) { res.status(403).json({ message: 'Permission VALIDATE_GRADES requise' }); return; }

      const decisions = Array.isArray(req.body.decisions) ? req.body.decisions : [];
      if (!decisions.length) { res.status(400).json({ message: 'decisions (tableau) est requis' }); return; }

      const validDecisions = ['PASS', 'REPEAT', 'DELIBERATION'];
      const invalide = decisions.find((d: any) => !validDecisions.includes(d.decision));
      if (invalide) {
        res.status(400).json({ message: `decision doit être : ${validDecisions.join(', ')} (reçu "${invalide.decision}" pour l'élève ${invalide.studentId})` });
        return;
      }

      const result = await this.ajouterDecisionsEnBloc.execute({
        sessionId: req.params.id as string,
        decisions,
        schoolId: user.schoolId,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/class-councils/:id/lock
  verrouillerHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.user(req);
      if (!this.canManage(user)) { res.status(403).json({ message: 'Permission VALIDATE_GRADES requise' }); return; }

      const result = await this.verrouiller.execute({
        sessionId: req.params.id as string,
        schoolId: user.schoolId,
      });

      await logActivity({
        userId: user.userId,
        schoolId: user.schoolId,
        action: 'Class council session locked',
        details: `Session ${req.params.id}`,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/class-councils/:id/publish-bulletins
  publicerBulletinsHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.user(req);
      if (user.role.toUpperCase() !== 'ADMIN') {
        res.status(403).json({ message: 'Réservé aux administrateurs' });
        return;
      }

      const result = await this.publierBulletins.execute({
        sessionId: req.params.id as string,
        schoolId: user.schoolId,
      });

      Promise.all(
        result.bulletins.map(b =>
          notifyBulletinSms({
            schoolId: user.schoolId,
            studentId: b.studentId,
            studentName: `${b.student.firstName} ${b.student.lastName}`,
            periodName: result.periodName,
          })
        )
      ).catch(() => {});

      res.json({ count: result.count, message: result.message });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/class-councils/:id/pv
  genererPVHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.user(req);
      if (!this.canManage(user)) {
        res.status(403).json({ message: 'Permission VALIDATE_GRADES requise' });
        return;
      }

      const data = await this.genererPV.execute({
        sessionId: req.params.id as string,
        schoolId: user.schoolId,
      });
      if (!data) { res.status(404).json({ message: 'Session introuvable' }); return; }

      const pdfBuffer = await renderClassCouncilMinutesPdf(data);
      const filename = `PV-conseil-${data.className.replace(/\s+/g, '-')}-${data.academicPeriod.replace(/\s+/g, '-')}.pdf`;
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': pdfBuffer.length,
      });
      res.end(pdfBuffer);
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/class-councils/:id/report
  genererRapportHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.user(req);
      if (!this.canManage(user)) { res.status(403).json({ message: 'Permission VALIDATE_GRADES requise' }); return; }

      const data = await this.genererRapport.execute({
        sessionId: req.params.id as string,
        schoolId: user.schoolId,
      });
      if (!data) { res.status(404).json({ message: 'Session introuvable' }); return; }

      const pdfBuffer = await renderClassCouncilReportPdf(data);
      const filename = `conseil-classe-${data.className.replace(/\s+/g, '-')}-${data.academicPeriod.replace(/\s+/g, '-')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (error) {
      next(error);
    }
  };
}
