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

  // Inngest — upsert direct (reportCards inngest historique)
  upsertBulletin(data: { schoolId: string; studentId: string; academicYearId: string; academicPeriodId: string; generalAverage: number; rank: number | null; mention: string; absenceCount: number }): Promise<{ id: string }>;
  upsertLigneMatiere(reportCardId: string, ligne: { subjectId: string; subjectName: string; coefficient: number; seq1Score: number | null; seq2Score: number | null; subjectAverage: number }): Promise<void>;
}
