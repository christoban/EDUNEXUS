import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';

export class PublierEmploiDuTempsUseCase {
  constructor(private readonly timetableRepository: TimetableRepository) {}

  async execute(params: { timetableId: string; schoolId: string }): Promise<void> {
    const emploiDuTemps = await this.timetableRepository.findById(params.timetableId);
    if (!emploiDuTemps) throw new Error(`EDT introuvable : ${params.timetableId}`);
    if (emploiDuTemps.schoolId !== params.schoolId) {
      throw new Error('Accès refusé : EDT hors de votre établissement');
    }

    const nombreCreneaux = await this.timetableRepository.countCreneaux(params.timetableId);

    emploiDuTemps.publier(nombreCreneaux);
    await this.timetableRepository.update(emploiDuTemps);
  }
}
