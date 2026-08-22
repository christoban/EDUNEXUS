import { Presence } from '@domain/entities/Presence';
import type { PresenceRepository, StatistiquesPresence } from '@domain/ports/repositories/PresenceRepository';
import type { AttendancePeriod } from '@domain/types/enums';

export class InMemoryPresenceRepository implements PresenceRepository {
  async findById(_id: string): Promise<Presence | null> { return null; }
  async findByEleve(_studentId: string, _academicPeriodId: string): Promise<Presence[]> { return []; }
  async findByClasse(_classId: string, _date: Date, _period: AttendancePeriod): Promise<Presence[]> { return []; }
  async findByClasseEtPeriode(_classId: string, _academicPeriodId: string): Promise<Presence[]> { return []; }
  async countAbsencesNonJustifiees(_studentId: string, _academicPeriodId: string): Promise<number> { return 0; }
  async countAbsencesConsecutives(_studentId: string): Promise<number> { return 0; }

  async getStatistiquesEleve(_studentId: string, _academicPeriodId: string): Promise<StatistiquesPresence> {
    return { totalJours: 20, joursPresent: 20, joursAbsent: 0, joursRetard: 0, tauxPresence: 100 };
  }

  async existeDeja(_studentId: string, _date: Date, _period: AttendancePeriod): Promise<boolean> { return false; }
  async save(_p: Presence): Promise<void> {}
  async saveMany(_presences: Presence[]): Promise<void> {}
  async update(_p: Presence): Promise<void> {}
  async findPresencesHorsLigneEnAttente(_userId: string): Promise<Presence[]> { return []; }
}
