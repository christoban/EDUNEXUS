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
}
