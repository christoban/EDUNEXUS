import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { PrepareExamDossierUseCase } from '@application/examen/PrepareExamDossierUseCase';

export class ExamenController {
  constructor(
    private readonly _prepareDossier: PrepareExamDossierUseCase,
    private readonly prisma: PrismaClient,
  ) {}

  // POST /api/v2/examens/register
  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const { studentUserId, typeExamen, anneeScolaire } = req.body as {
        studentUserId: string; typeExamen: string; anneeScolaire: string;
      };
      if (!studentUserId || !typeExamen || !anneeScolaire) {
        res.status(400).json({ success: false, message: 'studentUserId, typeExamen, anneeScolaire requis' });
        return;
      }
      const result = await this._prepareDossier.execute({ schoolId, studentUserId, typeExamen, anneeScolaire });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // GET /api/v2/examens/:studentId
  listByStudent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const studentId = String(req.params['studentId']);

      const profile = await (this.prisma as any).studentProfile.findFirst({
        where: { id: studentId, user: { schoolId } },
      });
      if (!profile) {
        res.status(404).json({ success: false, message: 'Élève introuvable' });
        return;
      }

      const registrations = await (this.prisma as any).examRegistration.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ success: true, data: registrations });
    } catch (err) { next(err); }
  };

  // PATCH /api/v2/examens/:id/set-candidate-number
  setCandidateNumber = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const examId = String(req.params['id']);
      const { numeroCandidatExamen } = req.body as { numeroCandidatExamen: string };
      if (!numeroCandidatExamen) {
        res.status(400).json({ success: false, message: 'numeroCandidatExamen requis' });
        return;
      }

      await (this.prisma as any).examRegistration.update({
        where: { id: examId },
        data: { numeroCandidatExamen, status: 'CONFIRMED' },
      });

      res.json({ success: true, message: 'Numéro candidat enregistré' });
    } catch (err) { next(err); }
  };

  // PATCH /api/v2/examens/:id/result
  setResult = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const examId = String(req.params['id']);
      const { resultatStatus, resultatMention, resultatScore, resultatSource } = req.body as {
        resultatStatus: string; resultatMention?: string; resultatScore?: number; resultatSource?: string;
      };
      if (!resultatStatus) {
        res.status(400).json({ success: false, message: 'resultatStatus requis' });
        return;
      }

      await (this.prisma as any).examRegistration.update({
        where: { id: examId },
        data: {
          resultatStatus,
          resultatMention: resultatMention ?? null,
          resultatScore: resultatScore ?? null,
          resultatSource: resultatSource ?? 'MANUAL_IMPORT',
          resultatVerifiedAt: new Date(),
          status: 'RESULT_AVAILABLE',
        },
      });

      res.json({ success: true, message: 'Résultat enregistré' });
    } catch (err) { next(err); }
  };
}
