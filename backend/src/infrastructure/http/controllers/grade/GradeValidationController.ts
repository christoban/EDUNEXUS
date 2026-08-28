import type { Request, Response, NextFunction } from 'express';
import type { SoumettreNoteUseCase } from '@application/grade/SoumettreNoteUseCase';
import type { ValiderNoteUseCase } from '@application/grade/ValiderNoteUseCase';
import type { RejeterNoteUseCase } from '@application/grade/RejeterNoteUseCase';
import type { ValiderEnBlocUseCase } from '@application/grade/ValiderEnBlocUseCase';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import { logActivity } from '../../../services/audit/ActivityLogService';
import { resolveLanguage } from '@domain/policies/LanguagePolicy';
import { inngest } from '../../../inngest/client/index.ts';
import { gererErreurGrade } from './gradeErrors';

export class GradeValidationController {
  constructor(
    private readonly soumettreNote: SoumettreNoteUseCase,
    private readonly validerNote: ValiderNoteUseCase,
    private readonly rejeterNote: RejeterNoteUseCase,
    private readonly validerEnBloc: ValiderEnBlocUseCase,
    private readonly schoolRepository: SchoolRepository,
  ) {}

  // PATCH /api/v2/grades/:id/submit
  soumettre = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.soumettreNote.execute({
        noteId: req.params.id as string,
        demandeurId: user.userId,
        schoolId: user.schoolId,
      });
      res.json({ success: true, message: 'Note soumise pour validation' });
    } catch (error) {
      gererErreurGrade(error, res, next);
    }
  };

  // POST /api/v2/grades/submit — soumettre en masse les brouillons
  // ponytail: non extrait en use case — conflit detection + bulk update restent ici
  // en attendant un SoumettreEnMasseUseCase dédié.
  soumettreEnMasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { classId, subjectId, sequenceId, grades: gradesWithVersion, forcerEcrasement } = req.body;

      if (!classId || !subjectId || !sequenceId) {
        res.status(400).json({ success: false, message: 'classId, subjectId et sequenceId sont requis' });
        return;
      }

      const { prisma } = await import('@infrastructure/persistence/prisma/prisma.client');

      // Si gradesWithVersion est fourni (sync offline avec détection de conflit V1 §12),
      // vérifier les conflits de version avant de soumettre — SAUF si forcerEcrasement est vrai
      if (Array.isArray(gradesWithVersion) && gradesWithVersion.length > 0 && !forcerEcrasement) {
        const conflicts: {
          studentId: string;
          versionServeur: { updatedAt: string; sequenceScore: number | null };
          versionLocale: { updatedAt: string | null; value: number | null; observation: string | null };
        }[] = [];

        const existingGrades = await prisma.grade.findMany({
          where: {
            schoolId: user.schoolId,
            classId,
            subjectId,
            sequenceId,
            validationStatus: { in: ['DRAFT', 'REJECTED'] },
            recordedById: user.userId,
          },
          select: { id: true, studentId: true, updatedAt: true, sequenceScore: true },
        });

        const existingByStudent = new Map(existingGrades.map(g => [g.studentId, g]));

        for (const gwv of gradesWithVersion) {
          if (!gwv.studentId) continue;
          const existing = existingByStudent.get(gwv.studentId);
          const baseUpdatedAt = gwv.baseUpdatedAt ? new Date(gwv.baseUpdatedAt).getTime() : null;

          if (existing && baseUpdatedAt !== null && existing.updatedAt.getTime() !== baseUpdatedAt) {
            conflicts.push({
              studentId: gwv.studentId,
              versionServeur: { updatedAt: existing.updatedAt.toISOString(), sequenceScore: existing.sequenceScore },
              versionLocale: { updatedAt: gwv.baseUpdatedAt, value: gwv.value ?? null, observation: gwv.observation ?? null },
            });
          }
        }

        if (conflicts.length > 0) {
          res.status(409).json({
            success: false,
            code: 'CONFLIT_VERSION',
            message: 'Conflit de version détecté — une tierce personne a modifié ces notes',
            conflicts,
          });
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

      void logActivity({ userId: user.userId, schoolId: user.schoolId, action: 'Notes soumises en masse', details: `Classe ${classId}, matière ${subjectId}, séquence ${sequenceId} : ${result.count} notes` });

      res.json({ success: true, data: { count: result.count } });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/v2/grades/:id/validate
  valider = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const resultat = await this.validerNote.execute({
        noteId: req.params.id as string,
        validateurId: user.userId,
        schoolId: user.schoolId,
      });

      // Déclenche la détection de chute par matière (Phase 3) — fire-and-forget, ne bloque
      // jamais la réponse de validation même si l'envoi de l'événement échoue.
      const { prisma } = await import('@infrastructure/persistence/prisma/prisma.client');
      const grade = await prisma.grade.findUnique({
        where: { id: req.params.id as string },
        select: { studentId: true, subjectId: true, schoolId: true, sequenceId: true },
      }).catch(() => null);
      if (grade) {
        void inngest.send({
          name: 'grade/validated',
          data: { gradeId: req.params.id as string, ...grade },
        }).catch((err) => console.error('[GradeValidationController] Échec envoi grade/validated:', err?.message));
      }

      void logActivity({ userId: user.userId, schoolId: user.schoolId, action: 'Note validée', details: `Note ${req.params.id} validée` });

      res.json({ success: true, data: resultat });
    } catch (error) {
      gererErreurGrade(error, res, next);
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
      const user = req.user;
      const school = await this.schoolRepository.findById(user.schoolId);
      const lang = resolveLanguage(school?.subsystem);
      await this.rejeterNote.execute({
        noteId: req.params.id as string,
        validateurId: user.userId,
        motif,
        lang,
        schoolId: user.schoolId,
      });
      void logActivity({ userId: user.userId, schoolId: user.schoolId, action: 'Note rejetée', details: `Note ${req.params.id} rejetée : ${motif}` });
      res.json({ success: true, message: 'Note rejetée — enseignant notifié' });
    } catch (error) {
      gererErreurGrade(error, res, next);
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
      const user = req.user;
      const resultat = await this.validerEnBloc.execute({
        classId,
        sequenceId,
        validateurId: user.userId,
      });

      if (resultat.gradesValidees.length > 0) {
        void inngest.send({
          name: 'grade/validated-batch',
          data: {
            schoolId: resultat.gradesValidees[0]!.schoolId,
            grades: resultat.gradesValidees.map((g) => ({ studentId: g.studentId, subjectId: g.subjectId, sequenceId: g.sequenceId })),
          },
        }).catch((err) => console.error('[GradeValidationController] Échec envoi grade/validated-batch:', err?.message));
      }

      void logActivity({ userId: user.userId, schoolId: user.schoolId, action: 'Notes validées en masse', details: `Classe ${classId}, séquence ${sequenceId} : ${resultat.gradesValidees.length} notes` });

      res.json({ success: true, data: resultat });
    } catch (error) {
      gererErreurGrade(error, res, next);
    }
  };
}
