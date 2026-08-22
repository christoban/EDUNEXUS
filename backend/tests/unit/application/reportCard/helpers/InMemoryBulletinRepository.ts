import { Bulletin } from '@domain/entities/Bulletin';
import type { BulletinRepository } from '@domain/ports/repositories/BulletinRepository';

export class InMemoryBulletinRepository implements BulletinRepository {
  private store = new Map<string, Bulletin>();
  private periodeStore = new Map<string, Bulletin>(); // key: studentId:academicPeriodId

  ajouter(b: Bulletin): void {
    this.store.set(b.id, b);
    const props = b.toObject();
    this.periodeStore.set(`${props.studentId}:${props.academicPeriodId}`, b);
  }

  compter(): number { return this.store.size; }

  async findById(id: string): Promise<Bulletin | null> { return this.store.get(id) ?? null; }

  async findByEleve(studentId: string, _academicYearId: string): Promise<Bulletin[]> {
    return [...this.store.values()].filter(b => b.studentId === studentId);
  }

  async findByEleveEtPeriode(studentId: string, academicPeriodId: string): Promise<Bulletin | null> {
    return this.periodeStore.get(`${studentId}:${academicPeriodId}`) ?? null;
  }

  async findByClasse(_classId: string, _academicPeriodId: string): Promise<Bulletin[]> { return []; }
  async findBySchool(_schoolId: string, _academicYearId: string): Promise<Bulletin[]> { return []; }

  async getMoyennesClasse(_classId: string, _academicPeriodId: string): Promise<{ studentId: string; generalAverage: number }[]> {
    return [];
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

  async updatePdfUrl(_bulletinId: string, _pdfUrl: string): Promise<void> {}
  async delete(id: string): Promise<void> { this.store.delete(id); }
}
