import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { CYCLE2_LEVELS, parseSerie } from '@application/school/SubjectAssignmentHelper';

export class TeachingAssignmentController {
  constructor(private readonly prisma: PrismaClient) {}

  // GET /api/v2/teaching-assignments?classId=:id
  getByClass = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { classId } = req.query as { classId?: string };

      if (!classId) {
        res.status(400).json({ success: false, message: 'classId requis' });
        return;
      }

      const cls = await this.prisma.class.findFirst({
        where: { id: classId, schoolId },
        select: { id: true, name: true, level: true, serie: true, filiere: true },
      });
      if (!cls) {
        res.status(404).json({ success: false, message: 'Classe introuvable' });
        return;
      }

      // Résoudre le code série/filière : Class.serie (2nd cycle), ou Class.filiere (1er cycle), ou parser depuis le nom
      const resolvedSerie: string | null =
        cls.serie ??
        cls.filiere ??
        ((cls.level && (CYCLE2_LEVELS as string[]).includes(cls.level))
          ? parseSerie(cls.name, cls.level)
          : null);

      // Matières du programme de cette classe : SubjectCoefficient (niveau) + ClassSubjectOverride (classe)
      const [coefficients, overrides] = await Promise.all([
        this.prisma.subjectCoefficient.findMany({
          where: {
            schoolId,
            classLevel: cls.level ?? undefined,
            OR: resolvedSerie
              ? [{ serieCode: resolvedSerie }, { serieCode: null }]
              : [{ serieCode: null }],
          },
          include: { subject: { select: { id: true, name: true } } },
          orderBy: { subject: { name: 'asc' } },
        }),
        this.prisma.classSubjectOverride.findMany({
          where: { classId, schoolId },
          include: { subject: { select: { id: true, name: true } } },
          orderBy: { subject: { name: 'asc' } },
        }),
      ]);

      // Les overrides prennent priorité : on exclut les matières déjà couvertes
      const overrideSubjectIds = new Set(overrides.map(o => o.subjectId));
      const seenSubjectIds = new Set<string>();
      const sharedCoeffs = coefficients.filter(c => {
        if (overrideSubjectIds.has(c.subjectId)) return false;
        if (seenSubjectIds.has(c.subjectId)) return false;
        seenSubjectIds.add(c.subjectId);
        return true;
      });

      // Fusionner les matières partagées et les overrides
      const allSubjects = [
        ...sharedCoeffs.map(c => ({
          subjectId: c.subjectId,
          subjectName: c.subject.name,
          coefficient: c.coefficient,
        })),
        ...overrides.map(o => ({
          subjectId: o.subjectId,
          subjectName: o.subject.name,
          coefficient: o.coefficient,
        })),
      ];

      // Affectations existantes pour cette classe
      const assignments = await this.prisma.teachingAssignment.findMany({
        where: { classId, schoolId },
        include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
      });
      const assignmentMap = new Map(assignments.map(a => [a.subjectId, a]));

      // Pour chaque matière : enseignants éligibles (qui ont déclaré cette matière)
      const data = await Promise.all(
        allSubjects.map(async s => {
          const assignment = assignmentMap.get(s.subjectId);
          const eligibleTeachers = await this.prisma.user.findMany({
            where: {
              schoolId,
              role: 'TEACHER',
              teacherProfile: { teacherSubjects: { some: { subjectId: s.subjectId } } },
            },
            select: { id: true, firstName: true, lastName: true },
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          });

          return {
            subjectId: s.subjectId,
            subjectName: s.subjectName,
            coefficient: s.coefficient,
            currentTeacherId: assignment?.teacherId ?? null,
            currentTeacherName: assignment?.teacher
              ? `${assignment.teacher.firstName} ${assignment.teacher.lastName}`
              : null,
            eligibleTeachers: eligibleTeachers.map(t => ({
              id: t.id,
              name: `${t.firstName} ${t.lastName}`,
            })),
          };
        }),
      );

      const assigned = data.filter(d => d.currentTeacherId !== null).length;
      res.json({ success: true, data, meta: { total: data.length, assigned } });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/teaching-assignments
  assign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { classId, subjectId, teacherId } = req.body as {
        classId?: string;
        subjectId?: string;
        teacherId?: string | null;
      };

      if (!classId || !subjectId) {
        res.status(400).json({ success: false, message: 'classId et subjectId requis' });
        return;
      }

      // Vérifier que la classe appartient à cette école
      const cls = await this.prisma.class.findFirst({
        where: { id: classId, schoolId },
        select: { id: true, academicYearId: true },
      });
      if (!cls) {
        res.status(404).json({ success: false, message: 'Classe introuvable' });
        return;
      }

      if (!teacherId) {
        // Désaffecter
        await this.prisma.teachingAssignment.deleteMany({
          where: { classId, subjectId, schoolId },
        });
        res.json({ success: true, message: 'Affectation supprimée' });
        return;
      }

      // Vérifier que c'est bien un enseignant de cette école
      const teacher = await this.prisma.user.findFirst({
        where: { id: teacherId, schoolId, role: 'TEACHER' },
        select: { id: true },
      });
      if (!teacher) {
        res.status(400).json({ success: false, message: 'Enseignant introuvable' });
        return;
      }

      await this.prisma.teachingAssignment.upsert({
        where: { classId_subjectId: { classId, subjectId } },
        // academicYearId repris de la classe elle-même (source de vérité year-scoped) plutôt que
        // d'une résolution séparée de "l'année courante" — l'affectation est pour CETTE classe,
        // qui porte déjà son année.
        create: { classId, subjectId, teacherId, schoolId, academicYearId: cls.academicYearId },
        update: { teacherId },
      });

      res.json({ success: true, message: 'Affectation enregistrée' });
    } catch (error) {
      next(error);
    }
  };
}
