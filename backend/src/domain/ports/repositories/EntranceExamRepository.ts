export type EntranceExamStatus = 'DRAFT' | 'RESULTS_PENDING' | 'CLOSED';
export type EntranceAdmissionStatus = 'PENDING' | 'ADMIS_PROVISOIRE' | 'CONFIRME' | 'ANNULE';
export type EntranceCepResult = 'NON_PASSE' | 'REUSSI' | 'ECHOUE';

export interface EntranceSessionData {
  id: string;
  schoolId: string;
  name: string;
  examDate: Date;
  academicYearId: string;
  admissionThreshold: number | null;
  availableSeats: number | null;
  status: EntranceExamStatus;
  targetClassId: string | null;
}

export interface EntranceCandidateData {
  id: string;
  sessionId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  originSchool: string | null;
  examScore: number | null;
  parentPhone: string | null;
  admissionStatus: EntranceAdmissionStatus;
  cepResult: EntranceCepResult | null;
  cepResultDate: Date | null;
  studentProfileId: string | null;
  session?: EntranceSessionData | null;
}

export interface EntranceExamRepository {
  listerSessions(schoolId: string): Promise<EntranceSessionData[]>;
  trouverSession(sessionId: string): Promise<EntranceSessionData | null>;
  creerSession(data: {
    schoolId: string;
    name: string;
    examDate: Date;
    academicYearId: string;
    admissionThreshold?: number | null;
    availableSeats?: number | null;
  }): Promise<EntranceSessionData>;
  mettreAJourStatutSession(sessionId: string, status: EntranceExamStatus): Promise<void>;
  compterCandidatsEnAttente(sessionId: string): Promise<number>;
  creerCandidat(data: {
    sessionId: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: Date | null;
    originSchool?: string | null;
    examScore?: number | null;
    parentPhone?: string | null;
  }): Promise<{ id: string }>;
  listerCandidats(sessionId: string, options?: { avecNote?: boolean; orderBy?: 'score' | 'nom' }): Promise<EntranceCandidateData[]>;
  trouverCandidatAvecSession(candidateId: string): Promise<EntranceCandidateData | null>;
  mettreAJourResultatCEP(candidateId: string, data: { cepResult: EntranceCepResult; admissionStatus: EntranceAdmissionStatus }): Promise<void>;
  mettreAJourStatutAdmission(candidateId: string, admissionStatus: EntranceAdmissionStatus): Promise<void>;
  trouverClasseNiveau(schoolId: string, niveau: string): Promise<{ id: string } | null>;
}