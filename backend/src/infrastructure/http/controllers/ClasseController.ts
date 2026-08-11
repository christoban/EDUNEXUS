import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import type { CreerClasseUseCase } from '@application/class/CreerClasseUseCase';
import type { ModifierClasseUseCase } from '@application/class/ModifierClasseUseCase';
import type { SupprimerClasseUseCase } from '@application/class/SupprimerClasseUseCase';
import type { AssignerProfesseurPrincipalUseCase } from '@application/class/AssignerProfesseurPrincipalUseCase';
import type { CreerSousGroupeTPUseCase } from '@application/class/CreerSousGroupeTPUseCase';
import type { AssignerElevesAuSousGroupeUseCase } from '@application/class/AssignerElevesAuSousGroupeUseCase';
import type { AssignerSalleClasseUseCase } from '@application/studentGroup/AssignerSalleClasseUseCase';
import type { RetirerAssignationSalleUseCase } from '@application/studentGroup/RetirerAssignationSalleUseCase';
import { CYCLE2_LEVELS, NIVEAU_MAP, parseSerie } from '@application/school/SubjectAssignmentHelper';
import { journaliserActionIA } from '@infrastructure/services/AIActionAuditLogger';

export class ClasseController {
  constructor(
    private readonly creer: CreerClasseUseCase,
    private readonly modifier: ModifierClasseUseCase,
    private readonly supprimer: SupprimerClasseUseCase,
    private readonly assignerProfesseur: AssignerProfesseurPrincipalUseCase,
    private readonly creerSousGroupe: CreerSousGroupeTPUseCase,
    private readonly assignerEleves: AssignerElevesAuSousGroupeUseCase,
    private readonly assignerSalle: AssignerSalleClasseUseCase,
    private readonly retirerAssignationSalle: RetirerAssignationSalleUseCase,
    private readonly prisma: PrismaClient,
  ) {}

  creerClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { level, serie } = req.body as { level?: string; serie?: string };

      // Validation : pour le 2nd cycle, la combinaison (niveau, série) doit exister
      // dans les BacCoefficients (source de vérité MINESEC Cameroun)
      if (level && serie && (CYCLE2_LEVELS as string[]).includes(level)) {
        const niveauBac = NIVEAU_MAP[level];
        if (niveauBac) {
          const seriePart = serie.includes('-') ? serie.split('-')[0] : serie;
          const exists = await this.prisma.bacCoefficient.findFirst({
            where: { serie: seriePart, niveau: niveauBac },
            select: { id: true },
          });
          if (!exists) {
            res.status(400).json({
              success: false,
              message: `La série "${serie}" n'existe pas au niveau "${level}" dans le programme officiel MINESEC. Vérifiez la combinaison niveau/série.`,
            });
            return;
          }
        }
      }

      const anneeCourante = await this.prisma.academicYear.findFirst({
        where: { schoolId: user.schoolId, isCurrent: true },
        select: { id: true },
      });
      if (!anneeCourante) {
        res.status(400).json({ success: false, message: "Aucune année académique courante — impossible de créer une classe." });
        return;
      }

      const resultat = await this.creer.execute({
        schoolId: user.schoolId,
        academicYearId: anneeCourante.id,
        ...req.body,
      });
      journaliserActionIA(this.prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        // Bug indépendant : CreerClasseResultat expose `classeId`, jamais `id` — le cast `as
        // any` masquait un ciblage d'audit toujours undefined pour cette action.
        actionName: 'creer_classe', targetType: 'Class', targetId: resultat.classeId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      const user = req.user;
      journaliserActionIA(this.prisma, {
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'creer_classe', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  modifierClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.modifier.execute({
        classeId: req.params.id as string,
        schoolId: user.schoolId,
        ...req.body,
      });
      res.json({ success: true, message: 'Classe mise à jour' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  supprimerClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.supprimer.execute({
        classeId: req.params.id as string,
        schoolId: user.schoolId,
        demandeurId: user.userId,
      });
      journaliserActionIA(this.prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'supprimer_classe', targetType: 'Class', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.json({ success: true, message: 'Classe mise à la corbeille' });
    } catch (error) {
      const user = req.user;
      journaliserActionIA(this.prisma, {
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'supprimer_classe', targetType: 'Class', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  assignerProfesseurPrincipal = async (
    req: Request, res: Response, next: NextFunction
  ): Promise<void> => {
    try {
      const user = req.user;
      const { teacherUserId } = req.body;
      const classeId = req.params.id as string;

      if (!teacherUserId) {
        res.status(400).json({ success: false, message: 'teacherUserId requis' });
        return;
      }

      // Un PP doit obligatoirement enseigner au moins une matière dans cette classe
      const assignment = await this.prisma.teachingAssignment.findFirst({
        where: { classId: classeId, teacherId: teacherUserId, schoolId: user.schoolId },
        select: { id: true },
      });
      if (!assignment) {
        res.status(400).json({
          success: false,
          code: 'PP_SANS_MATIERE',
          message: 'Cet enseignant n\'enseigne aucune matière dans cette classe. Assignez-lui d\'abord une matière avant de le désigner Professeur Principal.',
        });
        return;
      }

      await this.assignerProfesseur.execute({
        classeId,
        teacherUserId,
        schoolId: user.schoolId,
        demandeurRole: user.role,
      });
      journaliserActionIA(this.prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'assigner_professeur_principal', targetType: 'Class', targetId: classeId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { classeId, teacherUserId },
      });
      res.json({ success: true, message: 'Professeur Principal assigné' });
    } catch (error) {
      const user = req.user;
      journaliserActionIA(this.prisma, {
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'assigner_professeur_principal', targetType: 'Class', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  creerSousGroupeTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { name } = req.body;

      if (!name) {
        res.status(400).json({ success: false, message: 'name requis (ex: "Groupe A")' });
        return;
      }

      const resultat = await this.creerSousGroupe.execute({
        classeId: req.params.id as string,
        name,
        schoolId: user.schoolId,
        demandeurRole: user.role,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  assignerElevesAuSousGroupe = async (
    req: Request, res: Response, next: NextFunction
  ): Promise<void> => {
    try {
      const user = req.user;
      const { studentProfileIds } = req.body;

      const resultat = await this.assignerEleves.execute({
        subGroupId: req.params.subGroupId as string,
        studentProfileIds,
        schoolId: user.schoolId,
        demandeurRole: user.role,
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /:classId/subjects — Ajouter ou modifier une matière dans une classe
  // body: { subjectId, coefficient, classOnly?: boolean }
  // classOnly=true  → ClassSubjectOverride (uniquement cette classe)
  // classOnly=false → SubjectCoefficient   (toutes les classes du même niveau)
  ajouterMatiereClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.params.classId as string;
      const { subjectId, coefficient, classOnly } = req.body as { subjectId?: string; coefficient?: number; classOnly?: boolean };

      if (!subjectId || coefficient == null) {
        res.status(400).json({ success: false, message: 'subjectId et coefficient requis' });
        return;
      }

      const classe = await this.prisma.class.findFirst({
        where: { id: classId, schoolId },
        select: { id: true, level: true, serie: true, filiere: true, name: true },
      });
      if (!classe) {
        res.status(404).json({ success: false, message: 'Classe introuvable' });
        return;
      }

      // Si un ClassSubjectOverride existe déjà pour cette classe+matière, on le met à jour
      const existingOverride = await this.prisma.classSubjectOverride.findUnique({
        where: { classId_subjectId: { classId, subjectId } },
      });

      if (classOnly || existingOverride) {
        const override = await this.prisma.classSubjectOverride.upsert({
          where: { classId_subjectId: { classId, subjectId } },
          create: { schoolId, classId, subjectId, coefficient },
          update: { coefficient },
        });
        res.json({ success: true, data: { ...override, classOnly: true } });
        return;
      }

      // Comportement par défaut : SubjectCoefficient partagé par niveau
      const serieCode: string | null =
        classe.serie ??
        classe.filiere ??
        ((classe.level && (CYCLE2_LEVELS as string[]).includes(classe.level))
          ? parseSerie(classe.name ?? '', classe.level) : null);

      const coeff = await this.prisma.subjectCoefficient.upsert({
        where: {
          schoolId_subjectId_classLevel_serieCode: {
            schoolId, subjectId, classLevel: classe.level ?? '', serieCode: serieCode ?? '',
          },
        },
        create: { schoolId, subjectId, classLevel: classe.level ?? '', serieCode, coefficient },
        update: { coefficient },
      });

      res.json({ success: true, data: { ...coeff, classOnly: false } });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // DELETE /:classId/subjects/:subjectId — Retirer une matière d'une classe
  supprimerMatiereClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.params.classId as string;
      const subjectId = req.params.subjectId as string;

      // Vérifier d'abord si c'est un override spécifique à cette classe
      const override = await this.prisma.classSubjectOverride.findUnique({
        where: { classId_subjectId: { classId, subjectId } },
      });
      if (override) {
        await this.prisma.classSubjectOverride.delete({ where: { classId_subjectId: { classId, subjectId } } });
        res.json({ success: true, message: 'Matière spécifique retirée de cette classe' });
        return;
      }

      // Sinon supprimer le SubjectCoefficient partagé (affecte toutes les classes du niveau)
      const classe = await this.prisma.class.findFirst({
        where: { id: classId, schoolId },
        select: { id: true, level: true, serie: true, filiere: true, name: true },
      });
      if (!classe) {
        res.status(404).json({ success: false, message: 'Classe introuvable' });
        return;
      }

      const serieCode: string | null =
        classe.serie ??
        classe.filiere ??
        ((classe.level && (CYCLE2_LEVELS as string[]).includes(classe.level))
          ? parseSerie(classe.name ?? '', classe.level) : null);

      await this.prisma.subjectCoefficient.deleteMany({
        where: {
          schoolId, subjectId, classLevel: classe.level ?? undefined,
          ...(serieCode !== null ? { serieCode } : { serieCode: null }),
        },
      });

      res.json({ success: true, message: 'Matière retirée de la classe' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // GET /:id/students — liste des élèves de la classe avec moyennes et taux de présence
  getStudents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const classId = req.params.id as string;

      const classe = await this.prisma.class.findFirst({
        where: { id: classId, schoolId: user.schoolId },
        select: { id: true, name: true },
      });
      if (!classe) {
        res.status(404).json({ success: false, message: 'Classe introuvable' });
        return;
      }

      const students = await this.prisma.user.findMany({
        where: { schoolId: user.schoolId, role: 'STUDENT', isActive: true, studentProfile: { classId } },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });

      const studentIds = students.map(s => s.id);
      if (studentIds.length === 0) {
        res.json({ success: true, data: [], className: classe.name });
        return;
      }

      const [grades, attendances] = await Promise.all([
        this.prisma.grade.findMany({
          where: { schoolId: user.schoolId, classId, studentId: { in: studentIds }, validationStatus: { in: ['VALIDATED', 'LOCKED'] } },
          select: { studentId: true, sequenceAverage: true, coefficient: true },
        }),
        this.prisma.attendance.findMany({
          where: { classId, studentId: { in: studentIds } },
          select: { studentId: true, status: true },
        }),
      ]);

      const gradesByStudent = new Map<string, { sequenceAverage: number | null; coefficient: number }[]>();
      for (const g of grades) {
        if (!gradesByStudent.has(g.studentId)) gradesByStudent.set(g.studentId, []);
        gradesByStudent.get(g.studentId)!.push(g);
      }

      const attByStudent = new Map<string, string[]>();
      for (const a of attendances) {
        if (!attByStudent.has(a.studentId)) attByStudent.set(a.studentId, []);
        attByStudent.get(a.studentId)!.push(a.status);
      }

      const result = students.map(s => {
        const sg = gradesByStudent.get(s.id) ?? [];
        const totalCoeff = sg.reduce((acc, g) => acc + (g.coefficient ?? 0), 0);
        const totalW = sg.reduce((acc, g) => acc + ((g.sequenceAverage ?? 0) * (g.coefficient ?? 0)), 0);
        const moyenne = totalCoeff > 0 ? Math.round((totalW / totalCoeff) * 100) / 100 : null;

        const att = attByStudent.get(s.id) ?? [];
        const presents = att.filter(a => a === 'PRESENT').length;
        const tauxPresence = att.length > 0 ? Math.round((presents / att.length) * 100) : null;

        return { id: s.id, firstName: s.firstName, lastName: s.lastName, moyenne, tauxPresence };
      });

      result.sort((a, b) => {
        if (a.moyenne === null && b.moyenne === null) return 0;
        if (a.moyenne === null) return 1;
        if (b.moyenne === null) return -1;
        return b.moyenne - a.moyenne;
      });

      const ranked = result.map((s, i) => ({ ...s, rang: i + 1 }));
      res.json({ success: true, data: ranked, className: classe.name });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // PUT /classes/:id/room-assignment — assigne/change la salle habituelle de la classe pour l'année
  assignerSalleClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { roomId, academicYearId } = req.body as { roomId?: string; academicYearId?: string };
      if (!roomId || !academicYearId) {
        res.status(400).json({ success: false, message: 'roomId et academicYearId requis' });
        return;
      }
      await this.assignerSalle.execute({
        classId: req.params.id as string, roomId, academicYearId,
        schoolId: user.schoolId, demandeurRole: user.role,
      });
      res.json({ success: true, message: 'Salle habituelle assignée' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // DELETE /classes/:id/room-assignment?academicYearId= — retire la salle habituelle de la classe
  retirerAssignationSalleClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const academicYearId = req.query['academicYearId'] as string | undefined;
      if (!academicYearId) {
        res.status(400).json({ success: false, message: 'academicYearId requis' });
        return;
      }
      await this.retirerAssignationSalle.execute({
        classId: req.params.id as string, academicYearId,
        schoolId: user.schoolId, demandeurRole: user.role,
      });
      res.json({ success: true, message: 'Assignation de salle retirée' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof Error) {
      if (error.message.includes('existe déjà')) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (
        error.message.includes('Seul') ||
        error.message.includes('refusé') ||
        error.message.includes('pas un enseignant')
      ) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }

  // GET /api/v2/classes/:id/tableau-honneur?periodId=&top=10
  tableauHonneur = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const classId = req.params.id as string;
      const { periodId } = req.query as Record<string, string>;
      const top = Math.min(20, Math.max(1, parseInt((req.query.top as string) || '10')));

      if (!periodId) {
        res.status(400).json({ success: false, message: 'periodId est requis' });
        return;
      }

      const [schoolClass, period, school] = await Promise.all([
        this.prisma.class.findFirst({ where: { id: classId, schoolId: user.schoolId }, select: { name: true } }),
        this.prisma.academicPeriod.findUnique({
          where: { id: periodId },
          select: { name: true, academicYear: { select: { name: true } } },
        }),
        this.prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true, city: true } }),
      ]);

      if (!schoolClass) { res.status(404).json({ success: false, message: 'Classe introuvable' }); return; }

      const reportCards = await this.prisma.reportCard.findMany({
        where: {
          schoolId: user.schoolId,
          academicPeriodId: periodId,
          student: { studentProfile: { classId } },
          generalAverage: { not: null },
        },
        include: { student: { select: { firstName: true, lastName: true } } },
        orderBy: { generalAverage: 'desc' },
        take: top,
      });

      if (reportCards.length === 0) {
        res.status(404).json({ success: false, message: 'Aucun bulletin généré pour cette classe et cette période' });
        return;
      }

      const className = schoolClass.name;
      const periodName = period?.name ?? '—';
      const yearName = period?.academicYear?.name ?? '—';
      const schoolName = school?.name ?? 'Établissement';
      const schoolCity = school?.city ?? '';

      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));

      const mentionLabel = (avg: number | null) => {
        if (avg == null) return '—';
        if (avg >= 16) return 'Très Bien';
        if (avg >= 14) return 'Bien';
        if (avg >= 12) return 'Assez Bien';
        if (avg >= 10) return 'Passable';
        return 'Insuffisant';
      };

      // ── En-tête ─────────────────────────────────────────────────
      const lineY = doc.y;
      doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b');
      doc.text('République du Cameroun\nPaix – Travail – Patrie', 40, lineY, { width: 180, align: 'center' });
      doc.text('Republic of Cameroon\nPeace – Work – Fatherland', 375, lineY, { width: 180, align: 'center' });
      doc.moveDown(0.2);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#1e293b').lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica-Bold').text(schoolName.toUpperCase(), { align: 'center' });
      if (schoolCity) doc.fontSize(9).font('Helvetica').text(schoolCity, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#b45309').text('TABLEAU D\'HONNEUR', { align: 'center' });
      doc.moveDown(0.15);
      doc.fontSize(10).font('Helvetica').fillColor('#334155')
        .text(`${className}  —  ${periodName}  —  Année scolaire ${yearName}`, { align: 'center' });
      doc.fontSize(9).text(`Établi le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`, { align: 'center' });
      doc.moveDown(0.7);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#334155').lineWidth(0.5).stroke();
      doc.moveDown(0.5);

      // ── Tableau ──────────────────────────────────────────────────
      const colX2 = { rang: 40, nom: 95, moy: 360, mention: 435 };
      const tableHeaderY = doc.y;
      doc.rect(40, tableHeaderY, 515, 18).fill('#92400e');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('white');
      doc.text('RANG', colX2.rang + 4, tableHeaderY + 5, { width: 51, align: 'center' });
      doc.text('NOM ET PRÉNOM', colX2.nom, tableHeaderY + 5, { width: 261 });
      doc.text('MOYENNE', colX2.moy, tableHeaderY + 5, { width: 71, align: 'center' });
      doc.text('MENTION', colX2.mention, tableHeaderY + 5, { width: 116, align: 'center' });
      doc.fillColor('black');
      doc.y = tableHeaderY + 20;

      reportCards.forEach((rc, i) => {
        const rowY = doc.y;
        const avg = rc.generalAverage ?? 0;
        const avgStr = avg.toFixed(2);
        const mention = rc.mention ?? mentionLabel(avg);
        const isGold = i === 0;
        const isSilver = i === 1;
        const isBronze = i === 2;

        const rowBg = isGold ? '#fef9c3' : isSilver ? '#f1f5f9' : isBronze ? '#fef3c7' : (i % 2 === 0 ? '#fafaf8' : 'white');
        doc.rect(40, rowY, 515, 18).fill(rowBg);
        doc.rect(40, rowY, 515, 18).strokeColor('#e5e7eb').lineWidth(0.3).stroke();

        const medal = isGold ? '🥇' : isSilver ? '🥈' : isBronze ? '🥉' : `${i + 1}`;
        const rankColor = isGold ? '#b45309' : isSilver ? '#475569' : isBronze ? '#92400e' : '#334155';

        doc.fillColor(rankColor).font('Helvetica-Bold').fontSize(9);
        doc.text(medal, colX2.rang + 4, rowY + 5, { width: 51, align: 'center' });
        doc.fillColor('#1e293b').font('Helvetica-Bold');
        doc.text(`${rc.student.lastName} ${rc.student.firstName}`, colX2.nom, rowY + 5, { width: 261, ellipsis: true });
        doc.fillColor('#1e293b').font('Helvetica-Bold');
        doc.text(avgStr, colX2.moy, rowY + 5, { width: 71, align: 'center' });

        const mentionColor = avg >= 14 ? '#15803d' : avg >= 12 ? '#065f46' : avg >= 10 ? '#334155' : '#b91c1c';
        doc.fillColor(mentionColor).font('Helvetica');
        doc.text(mention, colX2.mention, rowY + 5, { width: 116, align: 'center' });
        doc.y = rowY + 19;
      });

      doc.moveDown(1.2);
      const sigY = doc.y;
      doc.fontSize(9).font('Helvetica').fillColor('#334155')
        .text('Le Chef d\'Établissement', 375, sigY, { width: 180, align: 'center' });
      doc.moveTo(375, sigY + 40).lineTo(555, sigY + 40).strokeColor('#94a3b8').lineWidth(0.5).stroke();

      doc.end();
      const pdfBuffer = Buffer.concat(buffers);
      const filename = `tableau-honneur-${className.replace(/\s+/g, '-')}-${periodName.replace(/\s+/g, '-')}.pdf`;
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

  // GET /api/v2/classes/:id/tableau-honneur-annuel?top=10
  tableauHonneurAnnuel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const classId = req.params.id as string;
      const top = Math.min(20, Math.max(1, parseInt((req.query.top as string) || '10')));

      const [schoolClass, school, academicYear] = await Promise.all([
        this.prisma.class.findFirst({ where: { id: classId, schoolId: user.schoolId }, select: { name: true } }),
        this.prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true, city: true } }),
        this.prisma.academicYear.findFirst({
          where: { schoolId: user.schoolId, isCurrent: true },
          include: { periods: { orderBy: { orderIndex: 'asc' }, select: { id: true, name: true } } },
        }),
      ]);

      if (!schoolClass) { res.status(404).json({ success: false, message: 'Classe introuvable' }); return; }
      if (!academicYear || !academicYear.periods.length) {
        res.status(400).json({ success: false, message: 'Aucune année scolaire courante ou sans trimestres' });
        return;
      }

      // Vérifier que tous les conseils de la classe sont verrouillés
      const lockedSessions = await this.prisma.classCouncilSession.findMany({
        where: { classId, schoolId: user.schoolId, status: 'LOCKED' },
        select: { academicPeriodId: true },
      });
      const lockedIds = new Set(lockedSessions.map(s => s.academicPeriodId));
      const allLocked = academicYear.periods.every(p => lockedIds.has(p.id));
      if (!allLocked) {
        const missingCount = academicYear.periods.filter(p => !lockedIds.has(p.id)).length;
        res.status(400).json({
          success: false,
          message: `${missingCount} conseil(s) de classe non encore verrouillé(s). Le tableau annuel n'est disponible qu'une fois tous les conseils clôturés.`,
        });
        return;
      }

      const allRcs = await this.prisma.reportCard.findMany({
        where: {
          schoolId: user.schoolId,
          academicPeriodId: { in: academicYear.periods.map(p => p.id) },
          student: { studentProfile: { classId } },
        },
        include: { student: { select: { firstName: true, lastName: true } } },
      });

      // Calcul de la moyenne annuelle = moyenne des moyennes trimestrielles
      const byStudent = new Map<string, { name: string; avgs: number[] }>();
      for (const rc of allRcs) {
        if (!byStudent.has(rc.studentId)) {
          byStudent.set(rc.studentId, { name: `${rc.student.lastName} ${rc.student.firstName}`, avgs: [] });
        }
        if (rc.generalAverage != null) byStudent.get(rc.studentId)!.avgs.push(rc.generalAverage);
      }

      const ranked = Array.from(byStudent.entries())
        .filter(([, d]) => d.avgs.length > 0)
        .map(([, d]) => ({ name: d.name, annualAvg: d.avgs.reduce((a, b) => a + b, 0) / d.avgs.length }))
        .sort((a, b) => b.annualAvg - a.annualAvg)
        .slice(0, top);

      if (ranked.length === 0) {
        res.status(404).json({ success: false, message: 'Aucun bulletin annuel disponible pour cette classe' });
        return;
      }

      const className = schoolClass.name;
      const yearName = academicYear.name;
      const schoolName = school?.name ?? 'Établissement';
      const schoolCity = school?.city ?? '';

      const mentionLabel = (avg: number) => {
        if (avg >= 16) return 'Très Bien';
        if (avg >= 14) return 'Bien';
        if (avg >= 12) return 'Assez Bien';
        if (avg >= 10) return 'Passable';
        return 'Insuffisant';
      };

      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));

      const lineY = doc.y;
      doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b');
      doc.text('République du Cameroun\nPaix – Travail – Patrie', 40, lineY, { width: 180, align: 'center' });
      doc.text('Republic of Cameroon\nPeace – Work – Fatherland', 375, lineY, { width: 180, align: 'center' });
      doc.moveDown(0.2);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#1e293b').lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica-Bold').text(schoolName.toUpperCase(), { align: 'center' });
      if (schoolCity) doc.fontSize(9).font('Helvetica').text(schoolCity, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#b45309').text('TABLEAU D\'HONNEUR ANNUEL', { align: 'center' });
      doc.moveDown(0.15);
      doc.fontSize(10).font('Helvetica').fillColor('#334155')
        .text(`${className}  —  Année scolaire ${yearName}`, { align: 'center' });
      doc.fontSize(9).text(`Établi le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`, { align: 'center' });
      doc.moveDown(0.7);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#334155').lineWidth(0.5).stroke();
      doc.moveDown(0.5);

      const colX2 = { rang: 40, nom: 95, moy: 360, mention: 435 };
      const tableHeaderY = doc.y;
      doc.rect(40, tableHeaderY, 515, 18).fill('#92400e');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('white');
      doc.text('RANG', colX2.rang + 4, tableHeaderY + 5, { width: 51, align: 'center' });
      doc.text('NOM ET PRÉNOM', colX2.nom, tableHeaderY + 5, { width: 261 });
      doc.text('MOY. ANNUELLE', colX2.moy, tableHeaderY + 5, { width: 71, align: 'center' });
      doc.text('MENTION', colX2.mention, tableHeaderY + 5, { width: 116, align: 'center' });
      doc.fillColor('black');
      doc.y = tableHeaderY + 20;

      ranked.forEach((r, i) => {
        const rowY = doc.y;
        const isGold = i === 0; const isSilver = i === 1; const isBronze = i === 2;
        const rowBg = isGold ? '#fef9c3' : isSilver ? '#f1f5f9' : isBronze ? '#fef3c7' : (i % 2 === 0 ? '#fafaf8' : 'white');
        doc.rect(40, rowY, 515, 18).fill(rowBg);
        doc.rect(40, rowY, 515, 18).strokeColor('#e5e7eb').lineWidth(0.3).stroke();
        const medal = isGold ? '🥇' : isSilver ? '🥈' : isBronze ? '🥉' : `${i + 1}`;
        const rankColor = isGold ? '#b45309' : isSilver ? '#475569' : '#334155';
        doc.fillColor(rankColor).font('Helvetica-Bold').fontSize(9);
        doc.text(medal, colX2.rang + 4, rowY + 5, { width: 51, align: 'center' });
        doc.fillColor('#1e293b').font('Helvetica-Bold');
        doc.text(r.name, colX2.nom, rowY + 5, { width: 261, ellipsis: true });
        doc.text(r.annualAvg.toFixed(2), colX2.moy, rowY + 5, { width: 71, align: 'center' });
        const mentionColor = r.annualAvg >= 14 ? '#15803d' : r.annualAvg >= 10 ? '#334155' : '#b91c1c';
        doc.fillColor(mentionColor).font('Helvetica');
        doc.text(mentionLabel(r.annualAvg), colX2.mention, rowY + 5, { width: 116, align: 'center' });
        doc.y = rowY + 19;
      });

      doc.moveDown(1.2);
      const sigY = doc.y;
      doc.fontSize(9).font('Helvetica').fillColor('#334155')
        .text('Le Chef d\'Établissement', 375, sigY, { width: 180, align: 'center' });
      doc.moveTo(375, sigY + 40).lineTo(555, sigY + 40).strokeColor('#94a3b8').lineWidth(0.5).stroke();

      doc.end();
      const pdfBuffer = Buffer.concat(buffers);
      const filename = `tableau-honneur-annuel-${className.replace(/\s+/g, '-')}-${yearName.replace(/\s+/g, '-')}.pdf`;
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
}
