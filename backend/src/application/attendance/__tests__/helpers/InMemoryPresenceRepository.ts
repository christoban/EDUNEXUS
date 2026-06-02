import { Presence } from '@domain/entities/Presence';
import type { PresenceRepository, StatistiquesPresence } from '@domain/ports/repositories/PresenceRepository';
import type { AttendancePeriod } from '@domain/types/enums';

export class InMemoryPresenceRepository implements PresenceRepository {
  private store = new Map<string, Presence>();

  ajouter(p: Presence): void { this.store.set(p.id, p); }
  compter(): number { return this.store.size; }

  async findById(id: string): Promise<Presence | null> {
    return this.store.get(id) ?? null;
  }

  async findByEleve(studentId: string, academicPeriodId: string): Promise<Presence[]> {
    return [...this.store.values()].filter(
      p => p.studentId === studentId && p.toObject().academicPeriodId === academicPeriodId
    );
  }

  async findByClasse(): Promise<Presence[]> { return []; }
  async findByClasseEtPeriode(): Promise<Presence[]> { return []; }
  async countAbsencesNonJustifiees(): Promise<number> { return 0; }
  async countAbsencesConsecutives(): Promise<number> { return 0; }

  async getStatistiquesEleve(): Promise<StatistiquesPresence> {
    return { totalJours: 0, joursPresent: 0, joursAbsent: 0, joursRetard: 0, tauxPresence: 100 };
  }

  async existeDeja(studentId: string, date: Date, period: AttendancePeriod): Promise<boolean> {
    return [...this.store.values()].some(
      p =>
        p.studentId === studentId &&
        p.date.toDateString() === date.toDateString() &&
        p.period === period
    );
  }

  async save(p: Presence): Promise<void> { this.store.set(p.id, p); }

  async saveMany(presences: Presence[]): Promise<void> {
    for (const p of presences) this.store.set(p.id, p);
  }

  async update(p: Presence): Promise<void> { this.store.set(p.id, p); }
  async findPresencesHorsLigneEnAttente(): Promise<Presence[]> { return []; }
}
