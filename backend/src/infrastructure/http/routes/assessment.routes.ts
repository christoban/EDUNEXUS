import { Router } from 'express';
import type { CreerAssessmentScopeUseCase } from '@application/assessment/CreerAssessmentScopeUseCase';
import type { PlanifierAssessmentSessionUseCase } from '@application/assessment/PlanifierAssessmentSessionUseCase';
import type { EnregistrerParticipationUseCase } from '@application/assessment/EnregistrerParticipationUseCase';
import type { EnregistrerParticipationEnLotUseCase } from '@application/assessment/EnregistrerParticipationEnLotUseCase';
import { requireAuth } from '../middlewares/auth.ts';

export function creerAssessmentRoutes(
  creerScope: CreerAssessmentScopeUseCase,
  planifierSession: PlanifierAssessmentSessionUseCase,
  enregistrerParticipation: EnregistrerParticipationUseCase,
  enregistrerParticipationEnLot: EnregistrerParticipationEnLotUseCase,
): Router {
  const router = Router();

  router.post('/scopes', requireAuth, async (req, res, next) => {
    try {
      const result = await creerScope.execute({
        schoolId: req.user!.schoolId,
        academicYearId: req.body.academicYearId,
        name: req.body.name,
        sequenceType: req.body.sequenceType,
        subjectIds: req.body.subjectIds,
        classIds: req.body.classIds,
      });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/sessions', requireAuth, async (req, res, next) => {
    try {
      const result = await planifierSession.execute({
        schoolId: req.user!.schoolId,
        assessmentScopeId: req.body.assessmentScopeId,
        subjectId: req.body.subjectId,
        classId: req.body.classId,
        academicSequenceId: req.body.academicSequenceId,
        scheduledDate: new Date(req.body.scheduledDate),
        durationMinutes: req.body.durationMinutes,
      });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/participations', requireAuth, async (req, res, next) => {
    try {
      const result = await enregistrerParticipation.execute({
        schoolId: req.user!.schoolId,
        sessionId: req.body.sessionId,
        studentId: req.body.studentId,
        status: req.body.status,
        recordedById: req.user!.userId,
      });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/participations/batch', requireAuth, async (req, res, next) => {
    try {
      const result = await enregistrerParticipationEnLot.execute({
        schoolId: req.user!.schoolId,
        sessionId: req.body.sessionId,
        participations: req.body.participations,
        recordedById: req.user!.userId,
      });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
