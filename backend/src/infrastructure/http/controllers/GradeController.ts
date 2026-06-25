import type { Request, Response, NextFunction } from 'express';
import type { SaisirNoteUseCase } from '@application/grade/SaisirNoteUseCase';
import type { SoumettreNoteUseCase } from '@application/grade/SoumettreNoteUseCase';
import type { ValiderNoteUseCase } from '@application/grade/ValiderNoteUseCase';
import type { RejeterNoteUseCase } from '@application/grade/RejeterNoteUseCase';
import type { ValiderEnBlocUseCase } from '@application/grade/ValiderEnBlocUseCase';
import { validerSaisirNoteDto } from '@infrastructure/http/dto/grade.dto';
import { Note } from '@domain/entities/Note';
import { BulletinBloqueError } from '@domain/errors/BulletinBloqueError';
import { ConseilBloqueError } from '@domain/errors/ConseilBloqueError';
import { NoteValideeSyncError } from '@domain/errors/NoteValideeSyncError';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import type { GradeValidationStatus } from '@domain/types/enums';

export class GradeController {
  constructor(
    private readonly saisirNote: SaisirNoteUseCase,
    private readonly soumettreNote: SoumettreNoteUseCase,
    private readonly validerNote: ValiderNoteUseCase,
    private readonly rejeterNote: RejeterNoteUseCase,
    private readonly validerEnBloc: ValiderEnBlocUseCase,
  ) {}

  // POST /api/v2/grades
  saisir = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = validerSaisirNoteDto(req.body);
      const user = (req as any).user;

      const resultat = await this.saisirNote.execute({
        schoolId: user.schoolId,
        academicYearId: req.body.academicYearId,
        recordedById: user.userId,
        ...dto,
      });

      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // PATCH /api/v2/grades/:id/submit
  soumettre = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      await this.soumettreNote.execute({
        noteId: req.params.id as string,
        demandeurId: user.userId,
      });
      res.json({ success: true, message: 'Note soumise pour validation' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // PATCH /api/v2/grades/:id/validate
  valider = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const resultat = await this.validerNote.execute({
        noteId: req.params.id as string,
        validateurId: user.userId,
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // PATCH /api/v2/grades/:id/reject
  rejeter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { motif } = req.body;
      if (!motif) {
        res.status(400).json({ success: false, message: 'Le motif de rejet est obligatoire' });
        return;
      }
      const user = (req as any).user;
      await this.rejeterNote.execute({
        noteId: req.params.id as string,
        validateurId: user.userId,
        motif,
      });
      res.json({ success: true, message: 'Note rejetée — enseignant notifié' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/grades/bulk-validate
  validerTout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { classId, sequenceId } = req.body;
      if (!classId || !sequenceId) {
        res.status(400).json({ success: false, message: 'classId et sequenceId requis' });
        return;
      }
      const user = (req as any).user;
      const resultat = await this.validerEnBloc.execute({
        classId,
        sequenceId,
        validateurId: user.userId,
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/grades/draft — sauvegarde en masse (upsert)
  draftEnMasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { classId, subjectId, sequenceId, grades } = req.body;

      if (!classId || !subjectId || !sequenceId || !grades?.length) {
        res.status(400).json({ success: false, message: 'classId, subjectId, sequenceId et grades sont requis' });
        return;
      }

      if (user.role === 'TEACHER') {
        const assigned = await this.enseignantAssigneAMatiere(user.userId, subjectId);
        if (!assigned) {
          res.status(403).json({ success: false, message: "Tu n'es pas assigné à cette matière" });
          return;
        }
      }

      const sequence = await prisma.academicSequence.findUnique({
        where: { id: sequenceId },
        include: { academicPeriod: { select: { academicYearId: true } } },
      });
      const academicYearId = sequence?.academicPeriod?.academicYearId;
      if (!academicYearId) {
        res.status(400).json({
          success: false,
          message: `Séquence introuvable (id: ${sequenceId}) — impossible de déterminer l'année académique`,
        });
        return;
      }

      const results = [];
      for (const g of grades) {
        if (!g.studentId || g.value === undefined) continue;
        const existing = await prisma.grade.findFirst({
          where: { schoolId: user.schoolId, classId, subjectId, sequenceId, studentId: g.studentId },
        });
        if (existing) {
          const noteEntity = Note.reconstituer({
            id: existing.id,
            schoolId: existing.schoolId,
            studentId: existing.studentId,
            subjectId: existing.subjectId,
            classId: existing.classId,
            academicYearId: existing.academicYearId,
            sequenceId: existing.sequenceId,
            recordedById: existing.recordedById ?? undefined,
            sequenceScore: existing.sequenceScore ?? undefined,
            classTestScore: existing.classTestScore ?? undefined,
            terminalExamScore: existing.terminalExamScore ?? undefined,
            theoreticalScore: existing.theoreticalScore ?? undefined,
            practicalScore: existing.practicalScore ?? undefined,
            professionalAttitude: existing.professionalAttitude ?? undefined,
            oralScore: existing.oralScore ?? undefined,
            selfDevelopmentScore: existing.selfDevelopmentScore ?? undefined,
            coefficient: existing.coefficient,
            maxValue: existing.maxValue,
            sequenceAverage: existing.sequenceAverage ?? undefined,
            validationStatus: existing.validationStatus as GradeValidationStatus,
            validatedById: existing.validatedById ?? undefined,
            validatedAt: existing.validatedAt ?? undefined,
            rejectionReason: existing.rejectionReason ?? undefined,
            observation: existing.observation ?? undefined,
            isOfflineSync: existing.isOfflineSync,
            syncedAt: existing.syncedAt ?? undefined,
            createdAt: existing.createdAt,
          });
          if (!noteEntity.peutEtreModifiee()) continue;
          const updated = await prisma.grade.update({
            where: { id: existing.id },
            data: {
              sequenceScore: Number(g.value),
              sequenceAverage: Number(g.value),
              maxValue: 20,
              rejectionReason: null,
              observation: g.observation || null,
              validationStatus: 'DRAFT',
              recordedById: user.userId,
            } as any,
          });
          results.push(updated);
        } else {
          const created = await prisma.grade.create({
            data: {
              schoolId: user.schoolId,
              classId,
              subjectId,
              sequenceId,
              studentId: g.studentId,
              academicYearId,
              sequenceScore: Number(g.value),
              sequenceAverage: Number(g.value),
              maxValue: 20,
              observation: g.observation || null,
              validationStatus: 'DRAFT',
              recordedById: user.userId,
            } as any,
          });
          results.push(created);
        }
      }

      res.json({ success: true, data: results, count: results.length });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/grades/submit — soumettre en masse les brouillons
  soumettreEnMasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { classId, subjectId, sequenceId } = req.body;

      if (!classId || !subjectId || !sequenceId) {
        res.status(400).json({ success: false, message: 'classId, subjectId et sequenceId sont requis' });
        return;
      }

      if (user.role === 'TEACHER') {
        const assigned = await this.enseignantAssigneAMatiere(user.userId, subjectId);
        if (!assigned) {
          res.status(403).json({ success: false, message: "Tu n'es pas assigné à cette matière" });
          return;
        }
      }

      const result = await prisma.grade.updateMany({
        where: {
          schoolId: user.schoolId,
          classId,
          subjectId,
          sequenceId,
          validationStatus: { in: ['DRAFT', 'REJECTED'] },
          recordedById: user.userId,
        },
        data: { validationStatus: 'SUBMITTED', rejectionReason: null },
      });

      if (result.count === 0) {
        res.status(404).json({ success: false, message: 'Aucune note à soumettre (DRAFT ou REJECTED) trouvée pour cette classe/matière/séquence. Vérifie que les notes ont bien été sauvegardées.' });
        return;
      }

      res.json({ success: true, data: { count: result.count } });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/grades
  lister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { schoolId, userId, role } = { schoolId: user.schoolId, userId: user.userId, role: user.role };
      const { classId, subjectId, sequenceId, studentId, validationStatus, page = '1', limit = '50' } =
        req.query as Record<string, string>;

      const where: any = {
        schoolId,
        ...(classId ? { classId } : {}),
        ...(subjectId ? { subjectId } : {}),
        ...(sequenceId ? { sequenceId } : {}),
        ...(validationStatus ? { validationStatus } : {}),
      };

      if (role === 'STUDENT') {
        where.studentId = userId;
      } else if (role === 'TEACHER') {
        const teacherProfile = await prisma.teacherProfile.findUnique({
          where: { userId },
          include: { teacherSubjects: true },
        });
        const assignedSubjectIds = teacherProfile?.teacherSubjects.map((ts) => ts.subjectId) ?? [];
        if (assignedSubjectIds.length === 0) {
          res.json({ grades: [], pagination: { total: 0, page: 1, pages: 0 } });
          return;
        }
        if (subjectId) {
          if (!assignedSubjectIds.includes(subjectId)) {
            res.json({ grades: [], pagination: { total: 0, page: 1, pages: 0 } });
            return;
          }
        } else {
          where.subjectId = { in: assignedSubjectIds };
        }
      } else if (role === 'PARENT') {
        const parentProfile = await prisma.parentProfile.findUnique({
          where: { userId },
          include: { children: { include: { studentProfile: true } } },
        });
        const childIds =
          parentProfile?.children
            .map((c) => c.studentProfile?.userId)
            .filter((id): id is string => Boolean(id)) ?? [];
        if (childIds.length === 0) {
          res.json({ grades: [], pagination: { total: 0, page: 1, pages: 0 } });
          return;
        }
        where.studentId = studentId && childIds.includes(studentId) ? studentId : { in: childIds };
      } else if (studentId) {
        where.studentId = studentId;
      }

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

      const [total, grades] = await Promise.all([
        prisma.grade.count({ where }),
        prisma.grade.findMany({
          where,
          include: {
            subject: { select: { id: true, name: true, code: true, coefficient: true } },
            student: { select: { id: true, firstName: true, lastName: true } },
            validatedBy: { select: { id: true, firstName: true, lastName: true } },
            recordedBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: [{ classId: 'asc' }, { subjectId: 'asc' }, { studentId: 'asc' }],
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
      ]);

      res.json({ grades, pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum), limit: limitNum } });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/grades/pending
  listerEnAttente = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const permissions: string[] = user.permissions ?? [];

      if (user.role !== 'ADMIN' && !permissions.includes('VALIDATE_GRADES')) {
        res.status(403).json({ success: false, message: 'Permission VALIDATE_GRADES requise' });
        return;
      }

      const { classId, subjectId, sequenceId } = req.query as Record<string, string>;

      const where: any = {
        schoolId: user.schoolId,
        validationStatus: 'SUBMITTED',
        ...(classId ? { classId } : {}),
        ...(subjectId ? { subjectId } : {}),
        ...(sequenceId ? { sequenceId } : {}),
      };

      const grades = await prisma.grade.findMany({
        where,
        include: {
          subject: { select: { id: true, name: true, code: true } },
          student: { select: { id: true, firstName: true, lastName: true } },
          recordedBy: { select: { id: true, firstName: true, lastName: true } },
          class: { select: { id: true, name: true } },
        },
        orderBy: [{ classId: 'asc' }, { subjectId: 'asc' }],
      });

      const grouped: Record<string, Record<string, typeof grades>> = {};
      for (const grade of grades) {
        if (!grouped[grade.classId]) grouped[grade.classId] = {};
        if (!grouped[grade.classId][grade.subjectId]) grouped[grade.classId][grade.subjectId] = [];
        grouped[grade.classId][grade.subjectId].push(grade);
      }

      res.json({ grades, grouped, total: grades.length });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/grades/status/:classId
  statutParClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { classId } = req.params;
      const { sequenceId } = req.query as { sequenceId?: string };

      const where: any = {
        schoolId: user.schoolId,
        classId,
        ...(sequenceId ? { sequenceId } : {}),
      };

      const grades = await prisma.grade.findMany({
        where,
        select: {
          id: true,
          subjectId: true,
          studentId: true,
          validationStatus: true,
          sequenceAverage: true,
          subject: { select: { name: true } },
          student: { select: { firstName: true, lastName: true } },
        },
      });

      const stats = {
        total: grades.length,
        DRAFT: grades.filter((g) => g.validationStatus === 'DRAFT').length,
        SUBMITTED: grades.filter((g) => g.validationStatus === 'SUBMITTED').length,
        VALIDATED: grades.filter((g) => g.validationStatus === 'VALIDATED').length,
        LOCKED: grades.filter((g) => g.validationStatus === 'LOCKED').length,
        REJECTED: grades.filter((g) => g.validationStatus === 'REJECTED').length,
      };

      const bySubject: Record<string, { subjectName: string; grades: typeof grades }> = {};
      for (const grade of grades) {
        if (!bySubject[grade.subjectId]) {
          bySubject[grade.subjectId] = { subjectName: grade.subject.name, grades: [] };
        }
        bySubject[grade.subjectId].grades.push(grade);
      }

      const canGenerateReportCard =
        grades.length > 0 &&
        grades.every((g) => g.validationStatus === 'VALIDATED' || g.validationStatus === 'LOCKED');

      res.json({ classId, stats, bySubject, canGenerateReportCard, grades });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/grades/average/:studentId
  moyenneEleve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const studentId = req.params.studentId as string;
      const classId = req.query.classId as string | undefined;
      const sequenceId = req.query.sequenceId as string | undefined;

      if (!classId || !sequenceId) {
        res.status(400).json({ success: false, message: 'classId et sequenceId sont requis' });
        return;
      }

      const result = await this.calculerMoyenne(studentId, classId, sequenceId, user.schoolId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/v2/grades/:id
  modifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;

      const grade = await prisma.grade.findFirst({
        where: { id: req.params.id as string, schoolId: user.schoolId },
      });

      if (!grade) {
        res.status(404).json({ success: false, message: 'Note introuvable' });
        return;
      }

      if (grade.validationStatus !== 'DRAFT' && grade.validationStatus !== 'REJECTED') {
        res.status(409).json({
          success: false,
          message: `Impossible de modifier une note en statut ${grade.validationStatus}`,
        });
        return;
      }

      if (user.role === 'TEACHER') {
        const assigned = await this.enseignantAssigneAMatiere(user.userId, grade.subjectId);
        if (!assigned) {
          res.status(403).json({ success: false, message: "Tu n'es pas assigné à cette matière" });
          return;
        }
      }

      const schoolConfig = await prisma.schoolConfig.findUnique({
        where: { schoolId: user.schoolId },
        select: { sequenceCalculationMode: true },
      });
      const calcMode = (schoolConfig?.sequenceCalculationMode ?? 'single') as 'single' | 'triple' | 'weighted';

      const gradeData = {
        sequenceScore: req.body.sequenceScore !== undefined ? Number(req.body.sequenceScore) : grade.sequenceScore,
        classTestScore: req.body.classTestScore !== undefined ? Number(req.body.classTestScore) : grade.classTestScore,
        terminalExamScore: req.body.terminalExamScore !== undefined ? Number(req.body.terminalExamScore) : grade.terminalExamScore,
        theoreticalScore: req.body.theoreticalScore !== undefined ? Number(req.body.theoreticalScore) : grade.theoreticalScore,
        practicalScore: req.body.practicalScore !== undefined ? Number(req.body.practicalScore) : grade.practicalScore,
        professionalAttitude: req.body.professionalAttitude !== undefined ? Number(req.body.professionalAttitude) : grade.professionalAttitude,
        oralScore: req.body.oralScore !== undefined ? Number(req.body.oralScore) : grade.oralScore,
        selfDevelopmentScore: req.body.selfDevelopmentScore !== undefined ? Number(req.body.selfDevelopmentScore) : grade.selfDevelopmentScore,
        maxValue: req.body.maxValue !== undefined ? Number(req.body.maxValue) : Number(grade.maxValue),
      };

      const sequenceAverage = this.calculerMoyenneSequence(
        {
          ...gradeData,
          seq1Score: req.body.seq1Score !== undefined ? Number(req.body.seq1Score) : null,
          seq2Score: req.body.seq2Score !== undefined ? Number(req.body.seq2Score) : null,
          compositionScore: req.body.compositionScore !== undefined ? Number(req.body.compositionScore) : null,
        },
        calcMode,
      );

      const updated = await prisma.grade.update({
        where: { id: grade.id },
        data: { ...gradeData, sequenceAverage, validationStatus: 'DRAFT', rejectionReason: null, recordedById: user.userId },
        include: {
          subject: { select: { id: true, name: true } },
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      res.json({ success: true, grade: updated });
    } catch (error) {
      next(error);
    }
  };

  // ─── Helpers privés ───────────────────────────────────────────────────────────

  private calculerMoyenneSequence(
    grade: {
      sequenceScore?: number | null;
      classTestScore?: number | null;
      terminalExamScore?: number | null;
      theoreticalScore?: number | null;
      practicalScore?: number | null;
      maxValue: number;
      seq1Score?: number | null;
      seq2Score?: number | null;
      compositionScore?: number | null;
    },
    mode: 'single' | 'triple' | 'weighted' = 'single',
  ): number {
    const max = grade.maxValue || 20;

    if (mode === 'weighted' && grade.classTestScore != null && grade.terminalExamScore != null) {
      return Math.min(grade.classTestScore * 0.3 + grade.terminalExamScore * 0.7, max);
    }

    if (mode === 'triple') {
      const ds1 = grade.seq1Score ?? grade.sequenceScore;
      const ds2 = grade.seq2Score;
      const compo = grade.compositionScore;
      if (ds1 != null && ds2 != null && compo != null) {
        return Math.min((ds1 + ds2 + compo * 2) / 4, max);
      }
    }

    if (grade.sequenceScore != null) return Math.min(grade.sequenceScore, max);
    if (grade.theoreticalScore != null && grade.practicalScore != null) {
      return Math.min((grade.theoreticalScore + grade.practicalScore) / 2, max);
    }
    if (grade.classTestScore != null && grade.terminalExamScore != null) {
      return Math.min(grade.classTestScore * 0.3 + grade.terminalExamScore * 0.7, max);
    }

    return 0;
  }

  private async enseignantAssigneAMatiere(teacherUserId: string, subjectId: string): Promise<boolean> {
    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: teacherUserId },
      include: { teacherSubjects: { where: { subjectId } } },
    });
    return (teacherProfile?.teacherSubjects.length ?? 0) > 0;
  }

  private async calculerMoyenne(
    studentId: string,
    classId: string,
    sequenceId: string,
    schoolId: string,
  ): Promise<{ average: number; rank: number; totalStudents: number }> {
    const grades = await prisma.grade.findMany({
      where: { schoolId, studentId, classId, sequenceId, validationStatus: { in: ['VALIDATED', 'LOCKED'] } },
      include: { subject: { select: { coefficient: true } } },
    });

    if (!grades.length) return { average: 0, rank: 0, totalStudents: 0 };

    const totalWeighted = grades.reduce(
      (sum, g) => sum + (g.sequenceAverage ?? 0) * (g.coefficient ?? g.subject.coefficient ?? 1),
      0,
    );
    const totalCoeff = grades.reduce((sum, g) => sum + (g.coefficient ?? g.subject.coefficient ?? 1), 0);
    const average = totalCoeff > 0 ? totalWeighted / totalCoeff : 0;

    const classmatesAverages = await prisma.grade.groupBy({
      by: ['studentId'],
      where: { schoolId, classId, sequenceId, validationStatus: { in: ['VALIDATED', 'LOCKED'] } },
      _avg: { sequenceAverage: true },
      orderBy: { _avg: { sequenceAverage: 'desc' } },
    });

    const rank = classmatesAverages.findIndex((c) => c.studentId === studentId) + 1;

    return { average: Math.round(average * 100) / 100, rank: rank || 0, totalStudents: classmatesAverages.length };
  }

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof NoteValideeSyncError) {
      res.status(409).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof BulletinBloqueError) {
      res.status(422).json({ success: false, message: error.message, notesBloquantes: error.notesBloquantes });
      return;
    }
    if (error instanceof ConseilBloqueError) {
      res.status(422).json({ success: false, message: error.message, notesManquantes: error.notesManquantes });
      return;
    }
    if (error instanceof Error) {
      if (error.message.startsWith('Données invalides')) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('Permission')) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }
}
