/**
 * DOMAIN LAYER — Port Repository Examen (Exam)
 */
export interface ExamenProps {
  id: string;
  schoolId: string;
  title: string;
  subjectId: string;
  classId: string;
  academicYearId: string;
  scheduledAt?: Date;
  duration?: number; // en minutes
  content?: Record<string, unknown>; // JSON
  isPublished: boolean;
  createdAt: Date;
}

export interface SoumissionProps {
  id: string;
  examId: string;
  studentId: string;
  schoolId: string;
  answers?: Record<string, unknown>;
  score?: number;
  submittedAt: Date;
}

export interface ExamenRepository {
  findById(id: string): Promise<ExamenProps | null>;
  findByClasse(classId: string, academicYearId: string): Promise<ExamenProps[]>;
  findByEnseignant(teacherId: string, schoolId: string): Promise<ExamenProps[]>;
  save(examen: ExamenProps): Promise<void>;
  update(examen: ExamenProps): Promise<void>;
  delete(id: string): Promise<void>;

  // Soumissions
  findSoumission(examId: string, studentId: string): Promise<SoumissionProps | null>;
  saveSoumission(soumission: SoumissionProps): Promise<void>;
  deleteSoumissions(examId: string): Promise<void>;
}
