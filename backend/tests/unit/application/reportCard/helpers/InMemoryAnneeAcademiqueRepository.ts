import type {
  AnneeAcademiqueRepository,
  AnneeAcademiqueProps,
  PeriodeAcademiqueProps,
  SequenceAcademiqueProps,
  CalendrierPeriode,
} from '@domain/ports/repositories/AnneeAcademiqueRepository';

export class InMemoryAnneeAcademiqueRepository implements AnneeAcademiqueRepository {
  private annees = new Map<string, AnneeAcademiqueProps>();
  private periodes = new Map<string, PeriodeAcademiqueProps>();
  private sequences = new Map<string, SequenceAcademiqueProps>();

  ajouterAnnee(a: AnneeAcademiqueProps): void { this.annees.set(a.id, a); }
  ajouterPeriode(p: PeriodeAcademiqueProps): void { this.periodes.set(p.id, p); }
  ajouterSequence(s: SequenceAcademiqueProps): void { this.sequences.set(s.id, s); }

  async findById(id: string): Promise<AnneeAcademiqueProps | null> { return this.annees.get(id) ?? null; }

  async findBySchool(schoolId: string): Promise<AnneeAcademiqueProps[]> {
    return [...this.annees.values()].filter(a => a.schoolId === schoolId);
  }

  async findCourante(schoolId: string): Promise<AnneeAcademiqueProps | null> {
    return [...this.annees.values()].find(a => a.schoolId === schoolId && a.isCurrent) ?? null;
  }

  async existsByName(schoolId: string, name: string): Promise<boolean> {
    return [...this.annees.values()].some(a => a.schoolId === schoolId && a.name === name);
  }

  async save(a: AnneeAcademiqueProps): Promise<void> { this.annees.set(a.id, a); }
  async update(a: AnneeAcademiqueProps): Promise<void> { this.annees.set(a.id, a); }

  async archiver(anneeId: string): Promise<void> {
    const a = this.annees.get(anneeId);
    if (a) this.annees.set(anneeId, { ...a, status: 'ARCHIVED', isCurrent: false });
  }

  async desactiverToutesAnneesEcole(schoolId: string): Promise<void> {
    for (const [id, a] of this.annees) {
      if (a.schoolId === schoolId) this.annees.set(id, { ...a, isCurrent: false });
    }
  }

  // _schoolId non utilisé : voir InMemoryAnneeAcademiqueRepository de academicYear.
  async findPeriodeById(id: string, _schoolId: string): Promise<PeriodeAcademiqueProps | null> { return this.periodes.get(id) ?? null; }

  async findPeriodesByAnnee(academicYearId: string): Promise<PeriodeAcademiqueProps[]> {
    return [...this.periodes.values()].filter(p => p.academicYearId === academicYearId);
  }

  async findPeriodeCourante(_schoolId: string): Promise<PeriodeAcademiqueProps | null> { return null; }

  async findDernierePeriode(academicYearId: string): Promise<PeriodeAcademiqueProps | null> {
    const periodes = [...this.periodes.values()]
      .filter(p => p.academicYearId === academicYearId)
      .sort((a, b) => b.orderIndex - a.orderIndex);
    return periodes[0] ?? null;
  }

  async savePeriode(p: PeriodeAcademiqueProps): Promise<void> { this.periodes.set(p.id, p); }

  async desactiverToutesPeriodes(academicYearId: string): Promise<void> {
    for (const [id, p] of this.periodes) {
      if (p.academicYearId === academicYearId) this.periodes.set(id, { ...p, isCurrent: false });
    }
  }

  async activerPeriode(periodeId: string): Promise<void> {
    const p = this.periodes.get(periodeId);
    if (p) this.periodes.set(periodeId, { ...p, isCurrent: true });
  }

  async findSequenceById(id: string, schoolId: string): Promise<SequenceAcademiqueProps | null> {
    const seq = this.sequences.get(id);
    return seq && seq.schoolId === schoolId ? seq : null;
  }
  async findSequencesByPeriode(academicPeriodId: string): Promise<SequenceAcademiqueProps[]> {
    return [...this.sequences.values()].filter(s => s.academicPeriodId === academicPeriodId);
  }
  async findSequenceCourante(schoolId: string): Promise<SequenceAcademiqueProps | null> {
    return [...this.sequences.values()].find(s => s.schoolId === schoolId && s.isCurrent) ?? null;
  }
  async saveSequence(s: SequenceAcademiqueProps): Promise<void> { this.sequences.set(s.id, s); }
  async desactiverToutesSequences(academicPeriodId: string): Promise<void> {
    for (const [id, s] of this.sequences) {
      if (s.academicPeriodId === academicPeriodId) this.sequences.set(id, { ...s, isCurrent: false });
    }
  }
  async activerSequence(sequenceId: string): Promise<void> {
    const s = this.sequences.get(sequenceId);
    if (s) this.sequences.set(sequenceId, { ...s, isCurrent: true });
  }
  async upsertCalendrier(_academicYearId: string, _schoolId: string, _periodes: CalendrierPeriode[]): Promise<void> {}
  async countNotesNonValidees(_academicYearId: string): Promise<number> { return 0; }
  async getClassesAvecBulletinsManquants(_academicYearId: string) { return []; }
  async getClassesSansConseilVerrouille(_academicYearId: string) { return []; }
}
