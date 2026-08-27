import { Presence } from '@domain/entities/Presence';
import type { PresenceRepository, StatistiquesPresence, PresenceSmsRecord } from '@domain/ports/repositories/PresenceRepository';
import type { AttendancePeriod } from '@domain/types/enums';

export class InMemoryPresenceRepository implements PresenceRepository {
  private store = new Map<string, Presence>();

  ajouter(p: Presence): void {
    this.store.set(p.id, p);
  }

  compter(): number {
    return this.store.size;
  }

  async findById(id: string): Promise<Presence | null> {
    return this.store.get(id) ?? null;
  }

  async findByEleve(studentId: string, academicPeriodId: string): Promise<Presence[]> {
    return [...this.store.values()].filter(
      p => p.studentId === studentId && p.toObject().academicPeriodId === academicPeriodId
    );
  }

  async findByClasse(
    classId: string,
    date: Date,
    period: AttendancePeriod
  ): Promise<Presence[]> {
    const debut = new Date(date);
    debut.setHours(0, 0, 0, 0);

    const fin = new Date(date);
    fin.setHours(23, 59, 59, 999);

    return [...this.store.values()].filter(
      presence =>
        presence.classId === classId &&
        presence.period === period &&
        presence.date >= debut &&
        presence.date <= fin
    );
  }

  async findByClasseEtPeriode(
    classId: string,
    academicPeriodId: string
  ): Promise<Presence[]> {
    return [...this.store.values()].filter(
      presence =>
        presence.classId === classId &&
        presence.toObject().academicPeriodId === academicPeriodId
    );
  }

  async countAbsencesNonJustifiees(
    studentId: string,
    academicPeriodId: string
  ): Promise<number> {
    return [...this.store.values()].filter(
      presence =>
        presence.studentId === studentId &&
        presence.toObject().academicPeriodId === academicPeriodId &&
        presence.status === 'ABSENT'
    ).length;
  }

  async countAbsencesEtRetards(schoolId: string, studentId: string, academicPeriodId: string): Promise<number> {
    return [...this.store.values()].filter(p => p.schoolId === schoolId && p.studentId === studentId && p.toObject().academicPeriodId === academicPeriodId && (p.status === 'ABSENT' || p.status === 'LATE')).length;
  }

  async countAbsencesConsecutives(studentId: string): Promise<number> {
    const dernieres = [...this.store.values()]
      .filter(presence => presence.studentId === studentId)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 10);

    let consecutives = 0;

    for (const presence of dernieres) {
      if (presence.status === 'ABSENT') {
        consecutives++;
      } else {
        break;
      }
    }

    return consecutives;
  }

  async getStatistiquesEleve(
    studentId: string,
    academicPeriodId: string
  ): Promise<StatistiquesPresence> {
    const presences = [...this.store.values()].filter(
      presence =>
        presence.studentId === studentId &&
        presence.toObject().academicPeriodId === academicPeriodId
    );

    const total = presences.length;
    const presents = presences.filter(p => p.status === 'PRESENT').length;
    const absents = presences.filter(p => p.status === 'ABSENT').length;
    const retards = presences.filter(p => p.status === 'LATE').length;

    return {
      totalJours: total,
      joursPresent: presents,
      joursAbsent: absents,
      joursRetard: retards,
      tauxPresence: total > 0 ? Math.round((presents / total) * 100) : 100,
    };
  }

  async existeDeja(studentId: string, date: Date, period: AttendancePeriod): Promise<boolean> {
    return [...this.store.values()].some(
      p =>
        p.studentId === studentId &&
        p.date.toDateString() === date.toDateString() &&
        p.period === period
    );
  }

  async save(p: Presence): Promise<void> {
    this.store.set(p.id, p);
  }

  async saveMany(presences: Presence[]): Promise<void> {
    for (const p of presences) {
      this.store.set(p.id, p);
    }
  }

  async update(p: Presence): Promise<void> {
    this.store.set(p.id, p);
  }

  async synchroniserPresencesSms(_records: PresenceSmsRecord[]): Promise<void> {}

  async findPresencesHorsLigneEnAttente(userId: string): Promise<Presence[]> {
    return [...this.store.values()].filter(
      presence =>
        presence.toObject().recordedById === userId &&
        presence.isOfflineSync
    );
  }
}
