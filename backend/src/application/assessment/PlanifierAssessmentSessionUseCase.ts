import type { HarmonizedAssessmentSessionRepository } from '@domain/ports/repositories/HarmonizedAssessmentSessionRepository';
import { HarmonizedAssessmentSession } from '@domain/entities/HarmonizedAssessmentSession';

export interface PlanifierAssessmentSessionCommande {
  schoolId: string;
  assessmentScopeId: string;
  subjectId: string;
  classId: string;
  academicSequenceId?: string;
  scheduledDate: Date;
  durationMinutes?: number;
}

export class PlanifierAssessmentSessionUseCase {
  constructor(private readonly sessionRepository: HarmonizedAssessmentSessionRepository) {}

  async execute(commande: PlanifierAssessmentSessionCommande): Promise<{ sessionId: string }> {
    const session = HarmonizedAssessmentSession.create({
      schoolId: commande.schoolId,
      assessmentScopeId: commande.assessmentScopeId,
      subjectId: commande.subjectId,
      classId: commande.classId,
      academicSequenceId: commande.academicSequenceId,
      scheduledDate: commande.scheduledDate,
      durationMinutes: commande.durationMinutes,
      status: 'PLANNED',
    });

    await this.sessionRepository.save(session);

    return { sessionId: session.id };
  }
}
