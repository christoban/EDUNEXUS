/**
 * DOMAIN LAYER — Port Repository Import Utilisateurs
 * Lectures/écritures de l'import massif d'utilisateurs (élèves + enseignants).
 */

export interface ImportContexte {
  schoolName: string;
  hasPEBS: boolean;
  classes: { id: string; name: string }[];
  lv2Subjects: { id: string; name: string }[];
}

export interface AffectationPedagogiqueData {
  classId: string;
  subjectId: string;
  teacherId: string;
  schoolId: string;
  academicYearId: string;
}

export interface ImportUtilisateursRepository {
  chargerContexte(schoolId: string): Promise<ImportContexte>;

  findParentParEmail(schoolId: string, email: string): Promise<string | null>;
  findStudentProfileId(userId: string): Promise<string | null>;
  updatePeBSFiliere(userId: string, pebsFiliere: string): Promise<void>;
  updateLv2Subject(userId: string, lv2SubjectId: string): Promise<void>;

  findSubjectsParNoms(schoolId: string, noms: string[]): Promise<{ id: string; name: string }[]>;

  findClassePourPP(schoolId: string, name: string): Promise<{ id: string; professorPrincipalId: string | null } | null>;
  findNomProfesseurPrincipal(userId: string): Promise<string | null>;
  findAutreClasseDePP(teacherId: string, schoolId: string, excludeClassId: string): Promise<{ name: string } | null>;
  assignerProfesseurPrincipal(classId: string, teacherId: string): Promise<void>;

  findClasseProgramme(schoolId: string, name: string): Promise<{ id: string; level: string | null; serie: string | null; filiere: string | null; academicYearId: string } | null>;
  findSubjectsDuProgramme(schoolId: string, level: string | null, codeSerie: string | null, classId: string): Promise<string[]>;
  creerAffectations(assignments: AffectationPedagogiqueData[]): Promise<number>;
}
