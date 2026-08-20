import type { Request, Response, NextFunction } from 'express';
import type { CouncilDecision, ReportCardStatus } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { journaliserActionIA } from '@infrastructure/services/AIActionAuditLogger';
import { logActivity } from '../../../utils/activitieslog';
import { notifyBulletinSms } from '../../services/SmsNotificationService';
import { whereProfilesParClasse } from '@application/shared/studentEnrollment';
import type { PreparerVueConseilClasseUseCase } from '@application/classCouncil/PreparerVueConseilClasseUseCase';

type AuthUser = { schoolId: string; userId: string; role: string; permissions?: string[] };

export class ClassCouncilController {
  constructor(private readonly preparerVueConseil: PreparerVueConseilClasseUseCase) {}

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

      // Pré-peupler une décision DELIBERATION pour chaque élève de la classe
      const students = await prisma.studentProfile.findMany({
        where: { ...whereProfilesParClasse(classId) },
        select: { userId: true },
      });
      if (students.length > 0) {
        await prisma.classCouncilDecision.createMany({
          data: students.map(s => ({
            sessionId: session.id,
            studentId: s.userId,
            decision: 'DELIBERATION' as CouncilDecision,
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
  listerSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.user(req);
      const { classId, academicPeriodId } = req.query as Record<string, string>;

      const sessions = await prisma.classCouncilSession.findMany({
        where: {
          schoolId: user.schoolId,
          ...(classId ? { classId } : {}),
          ...(academicPeriodId ? { academicPeriodId } : {}),
        },
        include: {
          class: { select: { id: true, name: true } },
          academicPeriod: { select: { id: true, name: true } },
          _count: { select: { decisions: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ sessions, total: sessions.length });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/class-councils/preview?classId=&academicPeriodId=
  // Vue préparatoire (V1.12) — fonctionne avant même l'ouverture de la session de conseil,
  // indexée sur la classe et la période, pas sur une session.
  preparerVue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      // Isolation multi-tenant : la classe et la période doivent appartenir à l'établissement
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
  obtenirSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.user(req);
      const role = user.role.toUpperCase();

      const session = await prisma.classCouncilSession.findFirst({
        where: { id: req.params.id as string, schoolId: user.schoolId },
        include: {
          class: { select: { id: true, name: true } },
          academicPeriod: { select: { id: true, name: true } },
          presidedBy: { select: { id: true, firstName: true, lastName: true } },
          decisions: {
            include: {
              student: {
                select: { id: true, firstName: true, lastName: true, studentProfile: { select: { healthScore: true } } },
              },
            },
          },
        },
      });
      if (!session) {
        res.status(404).json({ message: 'Session introuvable' });
        return;
      }

      // Surface les élèves à risque directement dans le détail du conseil — utile au président
      // de séance pour repérer d'un coup d'œil qui mérite une attention particulière pendant la
      // délibération, sans dupliquer la logique de seuils (mêmes SchoolConfig que le reste de
      // l'Early Warning System).
      const config = await prisma.schoolConfig
        .findUnique({ where: { schoolId: user.schoolId }, select: { aiRiskThreshold: true, aiRiskThresholdCritical: true } })
        .catch(() => null);
      const warningThreshold = config?.aiRiskThreshold ?? 50;
      const criticalThreshold = config?.aiRiskThresholdCritical ?? 30;
      session.decisions = session.decisions.map((d: any) => {
        const score = d.student?.studentProfile?.healthScore ?? 75;
        const { studentProfile, ...studentSansProfile } = d.student ?? {};
        return {
          ...d,
          student: studentSansProfile,
          healthScore: score,
          alertLevel: score <= criticalThreshold ? 'critical' : score <= warningThreshold ? 'warning' : null,
        };
      });

      if (role === 'STUDENT') {
        const myDecision = session.decisions.find((d) => d.studentId === user.userId);
        res.json({ session: { ...session, decisions: myDecision ? [myDecision] : [] } });
        return;
      }

      if (role === 'PARENT') {
        const parentProfile = await prisma.parentProfile.findUnique({
          where: { userId: user.userId },
          include: { children: { include: { studentProfile: true } } },
        });
        const childIds = (parentProfile?.children ?? [])
          .map((c) => c.studentProfile?.userId)
          .filter((id): id is string => Boolean(id));
        res.json({ session: { ...session, decisions: session.decisions.filter((d) => childIds.includes(d.studentId)) } });
        return;
      }

      res.json({ session });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/class-councils/:id/decisions
  ajouterDecision = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.user(req);
      const sessionId = req.params.id as string;
      const { studentId, decision, observations } = req.body;

      if (!studentId || !decision) {
        res.status(400).json({ message: 'studentId et decision sont requis' });
        return;
      }
      const validDecisions = ['PASS', 'REPEAT', 'DELIBERATION'];
      if (!validDecisions.includes(decision)) {
        res.status(400).json({ message: `decision doit être : ${validDecisions.join(', ')}` });
        return;
      }
      if (!this.canManage(user)) {
        res.status(403).json({ message: 'Permission VALIDATE_GRADES requise' });
        return;
      }

      const session = await prisma.classCouncilSession.findFirst({ where: { id: sessionId, schoolId: user.schoolId } });
      if (!session) { res.status(404).json({ message: 'Session introuvable' }); return; }
      if (session.status === 'LOCKED') { res.status(409).json({ message: 'Cette session est verrouillée. Aucune modification possible.' }); return; }

      const studentProfile = await prisma.studentProfile.findFirst({ where: { userId: studentId, ...whereProfilesParClasse(session.classId) } });
      if (!studentProfile) { res.status(404).json({ message: "Cet élève n'appartient pas à cette classe" }); return; }

      const councilDecision = await prisma.classCouncilDecision.upsert({
        where: { sessionId_studentId: { sessionId, studentId } },
        create: { sessionId, studentId, decision: decision as CouncilDecision, observations: observations ?? null },
        update: { decision: decision as CouncilDecision, observations: observations ?? null },
        include: { student: { select: { id: true, firstName: true, lastName: true } } },
      });

      res.json({ decision: councilDecision });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/class-councils/:id/decisions/bulk
  ajouterDecisionsEnBloc = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.user(req);
      const sessionId = req.params.id as string;
      const decisions: { studentId: string; decision: string; observations?: string }[] =
        Array.isArray(req.body.decisions) ? req.body.decisions : [];

      if (!decisions.length) { res.status(400).json({ message: 'decisions (tableau) est requis' }); return; }
      if (!this.canManage(user)) { res.status(403).json({ message: 'Permission VALIDATE_GRADES requise' }); return; }

      // Absente jusqu'ici sur la voie en bloc (contrairement à ajouterDecision, la voie
      // unitaire) — le cast `as any` masquait l'absence de validation, une décision hors
      // énumération aurait fait échouer Prisma à l'exécution (500) plutôt qu'un 400 propre.
      const validDecisions = ['PASS', 'REPEAT', 'DELIBERATION'];
      const invalide = decisions.find(d => !validDecisions.includes(d.decision));
      if (invalide) {
        res.status(400).json({ message: `decision doit être : ${validDecisions.join(', ')} (reçu "${invalide.decision}" pour l'élève ${invalide.studentId})` });
        return;
      }

      const session = await prisma.classCouncilSession.findFirst({ where: { id: sessionId, schoolId: user.schoolId } });
      if (!session) { res.status(404).json({ message: 'Session introuvable' }); return; }
      if (session.status === 'LOCKED') { res.status(409).json({ message: 'Session verrouillée' }); return; }

      const results = await Promise.all(
        decisions.map((d) =>
          prisma.classCouncilDecision.upsert({
            where: { sessionId_studentId: { sessionId, studentId: d.studentId } },
            create: { sessionId, studentId: d.studentId, decision: d.decision as CouncilDecision, observations: d.observations ?? null },
            update: { decision: d.decision as CouncilDecision, observations: d.observations ?? null },
          })
        )
      );

      res.json({ message: `${results.length} décision(s) enregistrée(s)`, count: results.length });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/class-councils/:id/lock
  verrouiller = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.user(req);
      const sessionId = req.params.id;

      if (!this.canManage(user)) { res.status(403).json({ message: 'Permission VALIDATE_GRADES requise' }); return; }

      const session = await prisma.classCouncilSession.findFirst({
        where: { id: sessionId as string, schoolId: user.schoolId },
        include: { class: { select: { id: true, name: true } }, decisions: true },
      });
      if (!session) { res.status(404).json({ message: 'Session introuvable' }); return; }
      if (session.status === 'LOCKED') { res.status(409).json({ message: 'Session déjà verrouillée' }); return; }
      if (!session.decisions.length) { res.status(400).json({ message: 'Impossible de verrouiller une session sans décisions' }); return; }

      const updated = await prisma.classCouncilSession.update({
        where: { id: sessionId as string },
        data: { status: 'LOCKED', validatedAt: new Date() },
      });

      await logActivity({
        userId: user.userId,
        schoolId: user.schoolId,
        action: 'Class council session locked',
        details: `Classe ${session.class?.name} — ${session.decisions.length} décision(s)`,
      });

      res.json({ session: updated, message: 'Session verrouillée' });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/class-councils/:id/publish-bulletins
  publicerBulletins = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.user(req);
      if (user.role.toUpperCase() !== 'ADMIN') {
        res.status(403).json({ message: 'Réservé aux administrateurs' });
        return;
      }

      const sessionId = req.params.id as string;
      const session = await prisma.classCouncilSession.findFirst({
        where: { id: sessionId, schoolId: user.schoolId },
        include: { academicPeriod: { select: { id: true, name: true } } },
      });
      if (!session) { res.status(404).json({ message: 'Session introuvable' }); return; }
      if (session.status !== 'LOCKED') {
        res.status(409).json({ message: 'Le conseil doit être verrouillé avant de publier les bulletins' });
        return;
      }

      const bulletins = await prisma.reportCard.findMany({
        where: {
          schoolId: user.schoolId,
          academicPeriodId: session.academicPeriodId,
          validationStatus: 'GENERATED' as ReportCardStatus,
          student: { studentProfile: whereProfilesParClasse(session.classId) },
        },
        select: {
          id: true,
          studentId: true,
          student: { select: { firstName: true, lastName: true } },
        },
      }) as { id: string; studentId: string; student: { firstName: string; lastName: string } }[];

      if (bulletins.length > 0) {
        await prisma.reportCard.updateMany({
          where: { id: { in: bulletins.map(b => b.id) } },
          data: { validationStatus: 'SENT' as ReportCardStatus },
        });

        const periodName: string = session.academicPeriod?.name ?? 'cette période';
        Promise.all(
          bulletins.map(b =>
            notifyBulletinSms({
              schoolId: user.schoolId,
              studentId: b.studentId,
              studentName: `${b.student.firstName} ${b.student.lastName}`,
              periodName,
            })
          )
        ).catch(() => {});
      }

      res.json({
        count: bulletins.length,
        message: `${bulletins.length} bulletin${bulletins.length !== 1 ? 's' : ''} publié${bulletins.length !== 1 ? 's' : ''}`,
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/class-councils/:id/pv
  genererPV = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.user(req);
      const sessionId = req.params.id as string;

      if (!this.canManage(user)) {
        res.status(403).json({ message: 'Permission VALIDATE_GRADES requise' });
        return;
      }

      const session = await prisma.classCouncilSession.findFirst({
        where: { id: sessionId, schoolId: user.schoolId },
        include: {
          class: { select: { id: true, name: true } },
          academicPeriod: {
            select: {
              id: true, name: true, orderIndex: true,
              academicYear: { select: { name: true } },
            },
          },
          presidedBy: { select: { firstName: true, lastName: true } },
          decisions: {
            include: { student: { select: { firstName: true, lastName: true } } },
            orderBy: { student: { lastName: 'asc' } },
          },
          school: { select: { name: true, city: true, phone: true } },
        },
      });

      if (!session) { res.status(404).json({ message: 'Session introuvable' }); return; }

      // Moyennes depuis les bulletins générés (ReportCard), fallback sur notes brutes
      const reportCards = await prisma.reportCard.findMany({
        where: {
          schoolId: user.schoolId,
          academicPeriodId: session.academicPeriodId,
          student: { studentProfile: whereProfilesParClasse(session.classId) },
        },
        select: { studentId: true, generalAverage: true, mention: true, rank: true },
      });
      const rcByStudentId = new Map(reportCards.map(r => [r.studentId, r]));

      const schoolName: string = session.school?.name ?? 'Établissement';
      const schoolCity: string = session.school?.city ?? '';
      const yearName: string = session.academicPeriod?.academicYear?.name ?? '—';
      const periodName: string = session.academicPeriod?.name ?? '—';
      const className: string = session.class?.name ?? '—';
      const presidedBy: string = session.presidedBy
        ? `${session.presidedBy.firstName} ${session.presidedBy.lastName}` : '—';
      const dateConseil = session.validatedAt
        ? new Date(session.validatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
        : new Date(session.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

      const totalStudents = session.decisions.length;
      const passCount    = session.decisions.filter((d: any) => d.decision === 'PASS').length;
      const repeatCount  = session.decisions.filter((d: any) => d.decision === 'REPEAT').length;
      const deliCount    = session.decisions.filter((d: any) => d.decision === 'DELIBERATION').length;
      const successRate  = totalStudents > 0 ? Math.round(((passCount + deliCount) / totalStudents) * 100) : 0;

      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));

      // ── En-tête bilingue ──────────────────────────────────────────
      const lineY = doc.y;
      doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b');
      doc.text('République du Cameroun\nPaix – Travail – Patrie', 40, lineY, { width: 180, align: 'center' });
      doc.text('Republic of Cameroon\nPeace – Work – Fatherland', 375, lineY, { width: 180, align: 'center' });
      doc.moveDown(0.2);

      const lineAfterHeader = doc.y;
      doc.moveTo(40, lineAfterHeader).lineTo(555, lineAfterHeader).strokeColor('#1e293b').lineWidth(0.5).stroke();
      doc.moveDown(0.3);

      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b').text(schoolName.toUpperCase(), { align: 'center' });
      if (schoolCity) doc.fontSize(9).font('Helvetica').text(schoolCity, { align: 'center' });
      doc.moveDown(0.5);

      doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e293b')
        .text('PROCÈS-VERBAL DU CONSEIL DE CLASSE', { align: 'center' });
      doc.moveDown(0.15);
      doc.fontSize(10).font('Helvetica').fillColor('#334155')
        .text(`Année scolaire ${yearName}  —  ${periodName}`, { align: 'center' });
      doc.moveDown(0.6);

      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#334155').lineWidth(0.5).stroke();
      doc.moveDown(0.4);

      // ── Infos séance ─────────────────────────────────────────────
      doc.fontSize(10).font('Helvetica');
      const infoStart = doc.y;
      doc.text(`Classe :`, 40, infoStart, { continued: true }).font('Helvetica-Bold').text(` ${className}`, { continued: false });
      doc.font('Helvetica').text(`Date du conseil :`, { continued: true }).font('Helvetica-Bold').text(` ${dateConseil}`);
      doc.font('Helvetica').text(`Président de séance :`, { continued: true }).font('Helvetica-Bold').text(` ${presidedBy}`);
      doc.font('Helvetica').text(`Effectif total :`, { continued: true }).font('Helvetica-Bold').text(` ${totalStudents} élève(s)`);
      doc.moveDown(0.6);

      // ── Tableau des décisions ────────────────────────────────────
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#334155').lineWidth(0.4).stroke();
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica-Bold').text('DÉLIBÉRATIONS PAR ÉLÈVE', { underline: true });
      doc.moveDown(0.3);

      const colX = { nom: 40, moy: 270, decision: 340, obs: 430 };
      const tableHeaderY = doc.y;
      doc.rect(40, tableHeaderY, 515, 16).fill('#1e293b');
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('white');
      doc.text('NOM ET PRÉNOM', colX.nom + 4, tableHeaderY + 4, { width: 226 });
      doc.text('MOY.', colX.moy + 2, tableHeaderY + 4, { width: 66, align: 'center' });
      doc.text('DÉCISION', colX.decision, tableHeaderY + 4, { width: 86, align: 'center' });
      doc.text('OBSERVATIONS', colX.obs, tableHeaderY + 4, { width: 121 });
      doc.fillColor('black');
      doc.y = tableHeaderY + 18;

      const decisionLabel: Record<string, string> = {
        PASS: 'ADMIS(E)', REPEAT: 'REDOUBLE', DELIBERATION: 'DÉLIBÉRATION',
      };
      const decisionColor: Record<string, string> = {
        PASS: '#15803d', REPEAT: '#b91c1c', DELIBERATION: '#b45309',
      };

      session.decisions.forEach((d: any, i: number) => {
        if (doc.y > 720) {
          doc.addPage();
          doc.y = 40;
        }
        const rowY = doc.y;
        const rc = rcByStudentId.get(d.studentId);
        const avgText = rc?.generalAverage != null ? rc.generalAverage.toFixed(2) : '—';

        if (i % 2 === 0) doc.rect(40, rowY, 515, 15).fill('#f8fafc');
        doc.rect(40, rowY, 515, 15).strokeColor('#e2e8f0').lineWidth(0.3).stroke();

        doc.fillColor('#1e293b').fontSize(8.5).font('Helvetica');
        doc.text(`${d.student.lastName} ${d.student.firstName}`, colX.nom + 4, rowY + 3, { width: 222, ellipsis: true });
        doc.text(avgText, colX.moy + 2, rowY + 3, { width: 66, align: 'center' });
        doc.fillColor(decisionColor[d.decision] ?? '#1e293b').font('Helvetica-Bold');
        doc.text(decisionLabel[d.decision] ?? d.decision, colX.decision, rowY + 3, { width: 86, align: 'center' });
        doc.fillColor('#334155').font('Helvetica');
        doc.text(d.observations ?? '', colX.obs, rowY + 3, { width: 119, ellipsis: true });
        doc.y = rowY + 16;
      });

      doc.moveDown(0.7);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#334155').lineWidth(0.4).stroke();
      doc.moveDown(0.3);

      // ── Bilan statistique ────────────────────────────────────────
      doc.fontSize(9).font('Helvetica-Bold').text('BILAN DE LA DÉLIBÉRATION', { underline: true });
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(9);
      doc.text(`Admis(es) (PASS) : ${passCount}   |   En délibération : ${deliCount}   |   Redoublants : ${repeatCount}   |   Taux de réussite : ${successRate}%`);
      doc.moveDown(0.8);

      // ── Signatures ───────────────────────────────────────────────
      if (doc.y > 680) doc.addPage();
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#334155').lineWidth(0.4).stroke();
      doc.moveDown(0.4);
      doc.fontSize(9).font('Helvetica-Bold').text('SIGNATURES', { underline: true });
      doc.moveDown(0.5);

      const sigY = doc.y;
      const sigCols = [40, 210, 390];
      const sigLabels = ['Le Président de séance', 'Le Secrétaire', 'Le Chef d\'Établissement'];
      sigLabels.forEach((label, i) => {
        const x = sigCols[i] ?? 40;
        doc.fontSize(8.5).font('Helvetica').fillColor('#334155').text(label, x, sigY, { width: 150, align: 'center' });
        doc.moveTo(x, sigY + 38).lineTo(x + 150, sigY + 38).strokeColor('#94a3b8').lineWidth(0.5).stroke();
      });

      doc.end();
      const pdfBuffer = Buffer.concat(buffers);

      const filename = `PV-conseil-${className.replace(/\s+/g, '-')}-${periodName.replace(/\s+/g, '-')}.pdf`;
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
  genererRapport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.user(req);
      const sessionId = req.params.id;

      if (!this.canManage(user)) { res.status(403).json({ message: 'Permission VALIDATE_GRADES requise' }); return; }

      const session = await prisma.classCouncilSession.findFirst({
        where: { id: sessionId as string, schoolId: user.schoolId },
        include: {
          class: { select: { id: true, name: true, level: true } },
          academicPeriod: { select: { id: true, name: true, academicYear: { select: { name: true } } } },
          presidedBy: { select: { id: true, firstName: true, lastName: true } },
          decisions: {
            include: { student: { select: { id: true, firstName: true, lastName: true } } },
            orderBy: { student: { lastName: 'asc' } },
          },
          school: { select: { name: true } },
        },
      });
      if (!session) { res.status(404).json({ message: 'Session introuvable' }); return; }

      const grades = await prisma.grade.findMany({
        where: { schoolId: user.schoolId, classId: session.classId, validationStatus: { in: ['VALIDATED', 'LOCKED'] } },
        select: { studentId: true, sequenceAverage: true, coefficient: true },
      });

      const gradesByStudent = new Map<string, typeof grades>();
      for (const g of grades) {
        const list = gradesByStudent.get(g.studentId) ?? [];
        list.push(g);
        gradesByStudent.set(g.studentId, list);
      }
      const averageByStudent = new Map<string, number>();
      for (const [sid, sg] of gradesByStudent) {
        const weighted = sg.reduce((sum, g) => sum + (g.sequenceAverage ?? 0) * (g.coefficient ?? 1), 0);
        const totalCoeff = sg.reduce((sum, g) => sum + (g.coefficient ?? 1), 0);
        averageByStudent.set(sid, totalCoeff > 0 ? weighted / totalCoeff : 0);
      }

      const totalStudents = session.decisions.length;
      const passCount = session.decisions.filter((d) => d.decision === 'PASS').length;
      const repeatCount = session.decisions.filter((d) => d.decision === 'REPEAT').length;
      const deliberationCount = session.decisions.filter((d) => d.decision === 'DELIBERATION').length;
      const averages = Array.from(averageByStudent.values());
      const classAverage = averages.length > 0 ? averages.reduce((a, b) => a + b, 0) / averages.length : 0;
      const highestAverage = averages.length > 0 ? Math.max(...averages) : 0;
      const lowestAverage = averages.length > 0 ? Math.min(...averages) : 0;
      const successRate = totalStudents > 0 ? Math.round(((passCount + deliberationCount) / totalStudents) * 100) : 0;

      const schoolName = session.school?.name ?? 'Établissement';
      const yearName = session.academicPeriod?.academicYear?.name ?? '—';
      const periodName = session.academicPeriod?.name ?? '—';
      const className = session.class?.name ?? '—';
      const presidedBy = session.presidedBy
        ? `${session.presidedBy.firstName} ${session.presidedBy.lastName}`
        : '—';

      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));

      doc.fontSize(16).font('Helvetica-Bold').text('RAPPORT DE CONSEIL DE CLASSE', { align: 'center' });
      doc.fontSize(11).font('Helvetica').text(`${schoolName}  —  Année scolaire ${yearName}`, { align: 'center' });
      doc.moveDown(0.3);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#334155').lineWidth(0.5).stroke();
      doc.moveDown(0.5);

      doc.fontSize(11).font('Helvetica-Bold').text('INFORMATIONS GÉNÉRALES');
      doc.moveDown(0.2);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Classe : ${className}`);
      doc.text(`Période : ${periodName}`);
      doc.text(`Date du conseil : ${session.validatedAt ? new Date(session.validatedAt).toLocaleDateString('fr-FR') : new Date(session.createdAt).toLocaleDateString('fr-FR')}`);
      doc.text(`Présidé par : ${presidedBy}`);
      doc.text(`Statut : ${session.status}`);
      doc.moveDown(0.5);

      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#334155').lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica-Bold').text('SITUATION PÉDAGOGIQUE');
      doc.moveDown(0.2);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Effectif total : ${totalStudents} élève(s)`);
      doc.text(`Admis (Passage) : ${passCount} élève(s)`);
      doc.text(`En délibération : ${deliberationCount} élève(s)`);
      doc.text(`Redoublants : ${repeatCount} élève(s)`);
      doc.text(`Taux de réussite : ${successRate}%`);
      doc.moveDown(0.3);
      doc.text(`Moyenne de classe : ${classAverage.toFixed(2)} / 20`);
      doc.text(`Plus haute moyenne : ${highestAverage.toFixed(2)} / 20`);
      doc.text(`Plus basse moyenne : ${lowestAverage.toFixed(2)} / 20`);
      doc.moveDown(0.5);

      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#334155').lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica-Bold').text('DÉCISIONS PAR ÉLÈVE');
      doc.moveDown(0.3);

      const tableY = doc.y;
      doc.rect(40, tableY, 515, 16).fill('#1e293b');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('white');
      doc.text('NOM ET PRÉNOM', 44, tableY + 4, { width: 200 });
      doc.text('MOYENNE', 244, tableY + 4, { width: 70, align: 'center' });
      doc.text('DÉCISION', 314, tableY + 4, { width: 100, align: 'center' });
      doc.text('OBSERVATIONS', 414, tableY + 4, { width: 141 });
      doc.fillColor('black');
      doc.y = tableY + 18;

      session.decisions.forEach((d, i) => {
        const rowY = doc.y;
        const avg = averageByStudent.get(d.studentId);
        const avgText = avg !== undefined ? avg.toFixed(2) : '—';
        const decisionColor = d.decision === 'PASS' ? '#16a34a' : d.decision === 'REPEAT' ? '#dc2626' : '#d97706';

        if (i % 2 === 0) doc.rect(40, rowY, 515, 15).fill('#f8fafc').stroke('#e2e8f0');
        else doc.rect(40, rowY, 515, 15).stroke('#e2e8f0');

        doc.fillColor('black').fontSize(9).font('Helvetica');
        doc.text(`${d.student.lastName} ${d.student.firstName}`, 44, rowY + 3, { width: 196, ellipsis: true });
        doc.text(avgText, 244, rowY + 3, { width: 70, align: 'center' });
        doc.fillColor(decisionColor).font('Helvetica-Bold');
        doc.text(d.decision, 314, rowY + 3, { width: 100, align: 'center' });
        doc.fillColor('black').font('Helvetica');
        doc.text(d.observations ?? '', 414, rowY + 3, { width: 137, ellipsis: true });
        doc.y = rowY + 16;
      });

      doc.moveDown(1);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#334155').lineWidth(0.5).stroke();
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica-Bold').text('SIGNATURES');
      doc.moveDown(0.5);

      const sigY = doc.y;
      const sigCols = [40, 210, 390];
      const sigLabels = ['Professeur Principal', 'Censeur / VP', 'Proviseur / Principal'];
      sigLabels.forEach((label, i) => {
        const x = sigCols[i] ?? 40;
        doc.fontSize(9).font('Helvetica').text(label, x, sigY, { width: 140, align: 'center' });
        doc.moveTo(x, sigY + 35).lineTo(x + 140, sigY + 35).strokeColor('#94a3b8').lineWidth(0.5).stroke();
      });

      doc.end();
      const pdfBuffer = Buffer.concat(buffers);

      const filename = `conseil-classe-${className.replace(/\s+/g, '-')}-${periodName.replace(/\s+/g, '-')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (error) {
      next(error);
    }
  };
}
