/**
 * DOMAIN — Port ClasseCoefficientRepository
 * Abstrait `classSubjectOverride` (override par classe) et `subjectCoefficient` (coefficient partagé par niveau/série).
 */

export interface ClassSubjectOverrideRecord {
  id: string;
  schoolId: string;
  classId: string;
  subjectId: string;
  coefficient: number;
}

export interface SubjectCoefficientRecord {
  id: string;
  schoolId: string;
  subjectId: string;
  classLevel: string;
  serieCode: string | null;
  coefficient: number;
}

export interface ClasseCoefficientRepository {
  findOverride(classId: string, subjectId: string): Promise<ClassSubjectOverrideRecord | null>;
  upsertOverride(params: {
    schoolId: string;
    classId: string;
    subjectId: string;
    coefficient: number;
  }): Promise<ClassSubjectOverrideRecord>;
  deleteOverride(classId: string, subjectId: string): Promise<void>;
  upsertCoefficient(params: {
    schoolId: string;
    subjectId: string;
    classLevel: string;
    serieCode: string | null;
    coefficient: number;
  }): Promise<SubjectCoefficientRecord>;
  deleteCoefficientsForSubject(params: {
    schoolId: string;
    subjectId: string;
    classLevel: string;
    serieCode: string | null;
  }): Promise<number>;
}
