import type { Request, Response, NextFunction } from 'express';
import type { VerrouillerNoteUseCase } from '@application/grade/VerrouillerNoteUseCase';
import type { VerrouillerNotesEnMasseUseCase } from '@application/grade/VerrouillerNotesEnMasseUseCase';
import { logActivity } from '../../../services/audit/ActivityLogService';
import { inngest } from '../../../inngest/client/index.ts';
import { gererErreurGrade } from './gradeErrors';

export class GradeValidationController {
  constructor(
    private readonly verrouillerNote: VerrouillerNoteUseCase,
    private readonly verrouillerNotesEnMasse: VerrouillerNotesEnMasseUseCase,
  ) {}

  // PATCH /api/v2/grades/:id/lock
  verrouiller = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const resultat = await this.verrouillerNote.execute({
        noteId: req.params.id as string,
        demandeurId: user.userId,
        schoolId: user.schoolId,
      });

      const { prisma } = await import('@infrastructure/persistence/prisma/prisma.client');
      const grade = await prisma.grade.findUnique({
        where: { id: req.params.id as string },
        select: { studentId: true, subjectId: true, schoolId: true, sequenceId: true },
      }).catch(() => null);
      if (grade) {
        void inngest.send({
          name: 'grade/locked',
          data: { gradeId: req.params.id as string, ...grade },
        }).catch((err) => console.error('[GradeValidationController] Échec envoi grade/locked:', err?.message));
      }

      void logActivity({ userId: user.userId, schoolId: user.schoolId, action: 'Note verrouillée', details: `Note ${req.params.id} verrouillée` });

      res.json({ success: true, data: resultat });
    } catch (error) {
      gererErreurGrade(error, res, next);
    }
  };

  // POST /api/v2/grades/bulk-lock
  verrouillerEnMasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { classId, sequenceId } = req.body;
      if (!classId || !sequenceId) {
        res.status(400).json({ success: false, message: 'classId et sequenceId requis' });
        return;
      }
      const user = req.user;
      const resultat = await this.verrouillerNotesEnMasse.execute({
        classId,
        sequenceId,
        demandeurId: user.userId,
        schoolId: user.schoolId,
      });

      if (resultat.gradesVerrouilles.length > 0) {
        void inngest.send({
          name: 'grade/locked-batch',
          data: {
            schoolId: resultat.gradesVerrouilles[0]!.schoolId,
            grades: resultat.gradesVerrouilles.map((g) => ({ studentId: g.studentId, subjectId: g.subjectId, sequenceId: g.sequenceId })),
          },
        }).catch((err) => console.error('[GradeValidationController] Échec envoi grade/locked-batch:', err?.message));
      }

      void logActivity({ userId: user.userId, schoolId: user.schoolId, action: 'Notes verrouillées en masse', details: `Classe ${classId}, séquence ${sequenceId} : ${resultat.notesVerrouillees} notes` });

      res.json({ success: true, data: resultat });
    } catch (error) {
      gererErreurGrade(error, res, next);
    }
  };
}
