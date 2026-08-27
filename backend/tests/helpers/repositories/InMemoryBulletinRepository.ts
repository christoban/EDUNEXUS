import { Bulletin } from '@domain/entities/Bulletin';
import type { BulletinRepository } from '@domain/ports/repositories/BulletinRepository';

export class InMemoryBulletinRepository implements BulletinRepository {
  private store = new Map<string, Bulletin>();
  private periodeStore = new Map<string, Bulletin>(); // key: studentId:academicPeriodId
  private classesParEleve = new Map<string, string>();

  ajouter(b: Bulletin): void {
    this.store.set(b.id, b);
    const props = b.toObject();
    this.periodeStore.set(`${props.studentId}:${props.academicPeriodId}`, b);
  }

  compter(): number {
    return this.store.size;
  }

  definirClasseEleve(studentId: string, classId: string): void {
    this.classesParEleve.set(studentId, classId);
  }

  async findById(id: string): Promise<Bulletin | null> {
    return this.store.get(id) ?? null;
  }

  async findByEleve(studentId: string, _academicYearId: string): Promise<Bulletin[]> {
    return [...this.store.values()].filter(b => b.studentId === studentId);
  }

  async findByEleveEtPeriode(studentId: string, academicPeriodId: string): Promise<Bulletin | null> {
    return this.periodeStore.get(`${studentId}:${academicPeriodId}`) ?? null;
  }

  async findByClasse(classId: string, academicPeriodId: string): Promise<Bulletin[]> {
    return [...this.store.values()].filter(
      bulletin =>
        this.classesParEleve.get(bulletin.studentId) === classId &&
        bulletin.academicPeriodId === academicPeriodId
    );
  }

  async findBySchool(schoolId: string, academicYearId: string): Promise<Bulletin[]> {
    return [...this.store.values()].filter(
      bulletin =>
        bulletin.schoolId === schoolId &&
        bulletin.academicYearId === academicYearId
    );
  }

  async getMoyennesClasse(
    classId: string,
    academicPeriodId: string
  ): Promise<{ studentId: string; generalAverage: number }[]> {
    return [...this.store.values()]
      .filter(
        bulletin =>
          this.classesParEleve.get(bulletin.studentId) === classId &&
          bulletin.academicPeriodId === academicPeriodId &&
          bulletin.generalAverage !== undefined
      )
      .map(bulletin => ({
        studentId: bulletin.studentId,
        generalAverage: bulletin.generalAverage!,
      }));
  }

  async save(b: Bulletin): Promise<void> {
    this.store.set(b.id, b);
    const props = b.toObject();
    this.periodeStore.set(`${props.studentId}:${props.academicPeriodId}`, b);
  }

  async update(b: Bulletin): Promise<void> {
    this.store.set(b.id, b);
    const props = b.toObject();
    this.periodeStore.set(`${props.studentId}:${props.academicPeriodId}`, b);
  }

  async updatePdfUrl(bulletinId: string, pdfUrl: string): Promise<void> {
    const bulletin = this.store.get(bulletinId);
    if (!bulletin) {
      throw new Error('Bulletin introuvable');
    }

    if (!bulletin.isGenerated) {
      bulletin.marquerGenere(pdfUrl);
    } else {
      const props = bulletin.toObject();
      this.store.set(
        bulletinId,
        Bulletin.reconstituer({ ...props, pdfUrl, isGenerated: true })
      );
    }
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async findTableauHonneur(params: { classId: string; schoolId: string; academicPeriodId: string; top: number }): Promise<{ student: { firstName: string; lastName: string }; generalAverage: number; mention: string | null }[]> {
    // InMemory: no student name store — return empty to keep simple; tests override if needed
    return [];
  }

  async findForAnnual(params: { classId: string; schoolId: string; periodIds: string[] }): Promise<{ studentId: string; student: { firstName: string; lastName: string }; generalAverage: number | null }[]> {
    return [];
  }

  async upsertBulletin(data: { schoolId: string; studentId: string; academicYearId: string; academicPeriodId: string; generalAverage: number; rank: number | null; mention: string; absenceCount: number }): Promise<{ id: string }> {
    const existing = this.periodeStore.get(`${data.studentId}:${data.academicPeriodId}`);
    if (existing) {
      const props = existing.toObject();
      const updated = Bulletin.reconstituer({ ...props, generalAverage: data.generalAverage, rank: data.rank ?? undefined, mention: data.mention, absenceCount: data.absenceCount, isGenerated: true, validationStatus: props.validationStatus ?? 'GENERATED' as any });
      this.store.set(props.id, updated);
      this.periodeStore.set(`${data.studentId}:${data.academicPeriodId}`, updated);
      return { id: props.id };
    }
    const persisted = Bulletin.reconstituer({
      id: crypto.randomUUID(),
      schoolId: data.schoolId,
      studentId: data.studentId,
      academicYearId: data.academicYearId,
      academicPeriodId: data.academicPeriodId,
      template: 'FR_SECONDARY' as any,
      validationStatus: 'GENERATED' as any,
      generalAverage: data.generalAverage,
      rank: data.rank ?? undefined,
      mention: data.mention,
      absenceCount: data.absenceCount,
      isGenerated: true,
      createdAt: new Date(),
      lignesMatiere: [],
    });
    this.store.set(persisted.id, persisted);
    this.periodeStore.set(`${data.studentId}:${data.academicPeriodId}`, persisted);
    return { id: persisted.id };
  }

  async upsertLigneMatiere(reportCardId: string, ligne: { subjectId: string; subjectName: string; coefficient: number; seq1Score: number | null; seq2Score: number | null; subjectAverage: number }): Promise<void> {
    const bulletin = this.store.get(reportCardId);
    if (!bulletin) return;
    const props = bulletin.toObject();
    const existingIdx = props.lignesMatiere.findIndex(l => l.subjectId === ligne.subjectId);
    const newLine: any = { id: crypto.randomUUID(), subjectId: ligne.subjectId, subjectName: ligne.subjectName, coefficient: ligne.coefficient, seq1Score: ligne.seq1Score ?? undefined, seq2Score: ligne.seq2Score ?? undefined, subjectAverage: ligne.subjectAverage };
    if (existingIdx >= 0) props.lignesMatiere[existingIdx] = { ...props.lignesMatiere[existingIdx], ...newLine, id: props.lignesMatiere[existingIdx].id };
    else props.lignesMatiere.push(newLine);
    this.store.set(reportCardId, Bulletin.reconstituer(props));
    this.periodeStore.set(`${props.studentId}:${props.academicPeriodId}`, Bulletin.reconstituer(props));
  }
}
