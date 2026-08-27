import type { HealthJobsRepository } from '@domain/ports/repositories/HealthJobsRepository';
import type { SanteEleveRepository } from '@domain/ports/repositories/SanteEleveRepository';
import type { IAService } from '@domain/ports/services/IAService';
import { CalculerIndiceSanteUseCase } from '@application/ai/CalculerIndiceSanteUseCase';
import { inngest } from '@infrastructure/inngest/client/index.ts';

export class CalculerScoresSanteUseCase {
  private readonly calculerIndice: CalculerIndiceSanteUseCase;

  constructor(
    private readonly healthJobsRepository: HealthJobsRepository,
    santeRepository: SanteEleveRepository,
    iaService: IAService,
  ) {
    this.calculerIndice = new CalculerIndiceSanteUseCase(santeRepository, iaService);
  }

  async execute(): Promise<{ computed: boolean }> {
    const schools = await this.healthJobsRepository.findActiveSchools();

    for (const school of schools) {
      const config = await this.healthJobsRepository.getSchoolConfig(school.id);
      const alertsEnabled = (config as any)?.aiAlertsEnabled ?? true;
      const warningThreshold = (config as any)?.aiRiskThreshold ?? 50;
      const criticalThreshold = (config as any)?.aiRiskThresholdCritical ?? 30;

      const currentYear = await this.healthJobsRepository.findCurrentAcademicYear(school.id);
      if (!currentYear) continue;

      const students = await this.healthJobsRepository.findStudentIdsForSchool(school.id);

      for (const student of students) {
        try {
          const { score, tendancePositive } = await this.calculerIndice.calculerScoreSeulement(
            student.userId,
            school.id,
            currentYear.id,
          );

          if (!alertsEnabled) continue;

          if (score <= criticalThreshold) {
            await inngest.send({ name: "ai/alert.critical", data: { studentId: student.userId, schoolId: school.id, healthScore: score } });
          } else if (score <= warningThreshold) {
            await inngest.send({ name: "ai/alert.warning", data: { studentId: student.userId, schoolId: school.id, healthScore: score } });
          }

          if (tendancePositive) {
            await inngest.send({ name: "ai/alert.positive", data: { studentId: student.userId, schoolId: school.id, healthScore: score } });
          }
        } catch (err) {
          console.error(`Health score error for student ${student.userId}:`, err);
        }
      }
    }

    return { computed: true };
  }
}
