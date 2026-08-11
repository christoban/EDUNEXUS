import type { ClassRoomAssignmentRepository } from '@domain/ports/repositories/ClassRoomAssignmentRepository';

export class RetirerAssignationSalleUseCase {
  constructor(private readonly classRoomAssignmentRepository: ClassRoomAssignmentRepository) {}

  async execute(params: { classId: string; academicYearId: string; schoolId: string; demandeurRole: string }): Promise<void> {
    if (params.demandeurRole !== 'ADMIN') {
      throw new Error('Seul un Admin peut retirer l\'assignation de salle d\'une classe');
    }

    const existante = await this.classRoomAssignmentRepository.findByClasseAndAnnee(
      params.classId, params.academicYearId
    );
    if (!existante) throw new Error('Aucune assignation de salle trouvée pour cette classe');
    if (existante.schoolId !== params.schoolId) {
      throw new Error('Accès refusé : assignation hors de votre établissement');
    }

    await this.classRoomAssignmentRepository.delete(params.classId, params.academicYearId);
  }
}
