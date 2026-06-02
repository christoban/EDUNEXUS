import type { Request, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { logActivity } from '../../../utils/activitieslog';

type AuthUser = { schoolId: string; userId: string; role: string; permissions?: string[] };

export class ClassCouncilController {
  private user(req: Request): AuthUser {
    return (req as any).user as AuthUser;
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

      await logActivity({
        userId: user.userId,
        schoolId: user.schoolId,
        action: 'Class council session created',
        details: `Classe ${schoolClass.name} — période ${academicPeriodId}`,
      });

      res.status(201).json({ session });
    } catch (error) {
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
            include: { student: { select: { id: true, firstName: true, lastName: true } } },
          },
        },
      }) as any;
      if (!session) {
        res.status(404).json({ message: 'Session introuvable' });
        return;
      }

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

      const studentProfile = await prisma.studentProfile.findFirst({ where: { userId: studentId, classId: session.classId } });
      if (!studentProfile) { res.status(404).json({ message: "Cet élève n'appartient pas à cette classe" }); return; }

      const councilDecision = await prisma.classCouncilDecision.upsert({
        where: { sessionId_studentId: { sessionId, studentId } },
        create: { sessionId, studentId, decision: decision as any, observations: observations ?? null },
        update: { decision: decision as any, observations: observations ?? null },
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

      const session = await prisma.classCouncilSession.findFirst({ where: { id: sessionId, schoolId: user.schoolId } });
      if (!session) { res.status(404).json({ message: 'Session introuvable' }); return; }
      if (session.status === 'LOCKED') { res.status(409).json({ message: 'Session verrouillée' }); return; }

      const results = await Promise.all(
        decisions.map((d) =>
          prisma.classCouncilDecision.upsert({
            where: { sessionId_studentId: { sessionId, studentId: d.studentId } },
            create: { sessionId, studentId: d.studentId, decision: d.decision as any, observations: d.observations ?? null },
            update: { decision: d.decision as any, observations: d.observations ?? null },
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
      }) as any;
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
      }) as any;
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

      const schoolName = (session as any).school?.name ?? 'Établissement';
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
