/**
 * DOMAIN LAYER — Port Repository Bulletin (ReportCard)
 */
import type { Bulletin } from '@domain/entities/Bulletin';
import type { BulletinTemplate } from '@domain/types/enums';

export interface BulletinRepository {
  // Lecture
  findById(id: string): Promise<Bulletin | null>;
  findByEleve(studentId: string, academicYearId: string): Promise<Bulletin[]>;
  findByEleveEtPeriode(studentId: string, academicPeriodId: string): Promise<Bulletin | null>;
  findByClasse(classId: string, academicPeriodId: string): Promise<Bulletin[]>;
  findBySchool(schoolId: string, academicYearId: string): Promise<Bulletin[]>;

  // Stats pour le classement
  getMoyennesClasse(
    classId: string,
    academicPeriodId: string
  ): Promise<{ studentId: string; generalAverage: number }[]>;

  // Écriture
  save(bulletin: Bulletin): Promise<void>;
  update(bulletin: Bulletin): Promise<void>;
  updatePdfUrl(bulletinId: string, pdfUrl: string): Promise<void>;
  delete(id: string): Promise<void>;
}
