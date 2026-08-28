/**
 * DOMAIN LAYER — Port Repository Onboarding Élève
 * Persistance du flux d'onboarding auto-service (squelette → soumission → validation/rejet).
 */
import type { OnboardingRecipient, OnboardingSource, OnboardingStatus } from '@domain/types/enums';

export interface OnboardingSettings {
  selfServiceEnabled: boolean;
  defaultRecipient: OnboardingRecipient;
  ageThresholdForParent: number;
  tokenExpiryDays: number;
  reminderDelayDays?: number[];
  escalationDelayDays?: number;
  responsableRole: string;
}

export interface OnboardingRecord {
  id: string;
  schoolId: string;
  nomProvisoire: string;
  classId: string | null;
  contactEmail: string | null;
  contactTelephone: string | null;
  parentContactEmail: string | null;
  parentContactTelephone: string | null;
  recipientType: OnboardingRecipient;
  eleveADispositif: boolean | null;
  eleveDispositifOS: string | null;
  parentADispositif: boolean | null;
  parentDispositifOS: string | null;
  sourceType: OnboardingSource;
  examCandidateId: string | null;
  token: string;
  tokenExpiresAt: Date;
  tokenUsedAt: Date | null;
  submittedData: unknown;
  matchScore: number | null;
  matchedStudentId: string | null;
  status: OnboardingStatus;
}

export interface OnboardingProfileMatch {
  id: string;
  lastName: string;
  firstName: string;
}

export interface ValiderOnboardingCompteResultat {
  role: 'STUDENT' | 'PARENT';
  userId: string;
  resetToken: string | null;
  contactEmail: string | null;
  contactTelephone: string | null;
  compteExistant: boolean;
  accessMode: 'FULL_ACCESS' | 'SMS_ONLY';
}

export interface ValiderOnboardingInput {
  schoolId: string;
  onboardingId: string;
  validatedById: string;
  classId: string;
  nom: string;
  prenom: string;
  dateOfBirth: Date | null;
  gender: string | null;
  eleveContactEmail: string | null;
  eleveContactTelephone: string | null;
  parentContactEmail: string | null;
  parentContactTelephone: string | null;
  parentRecoitContact: boolean;
  eleveAccessMode: 'FULL_ACCESS' | 'SMS_ONLY';
  parentAccessMode: 'FULL_ACCESS' | 'SMS_ONLY';
  studentPasswordHash: string;
  studentResetTokenHash: string | null;
  studentResetTokenExpiry: Date | null;
  studentResetToken: string | null;
  examCandidateId: string | null;
}

export interface EleveOnboardingRepository {
  // Lectures
  findSettings(schoolId: string): Promise<OnboardingSettings | null>;
  upsertSettings(schoolId: string, data: Partial<OnboardingSettings>): Promise<OnboardingSettings>;
  findOnboardingById(id: string, schoolId: string): Promise<OnboardingRecord | null>;
  findOnboardingByToken(token: string): Promise<OnboardingRecord | null>;
  findOnboardingByTokenWithClasse(token: string): Promise<(OnboardingRecord & { classe?: { name: string; level: string } | null }) | null>;
  listOnboardings(schoolId: string, status?: string): Promise<OnboardingRecord[]>;
  findOnboardingForPdf(id: string, schoolId: string): Promise<(OnboardingRecord & { classe?: { name: string } | null; school?: { name: string } | null }) | null>;
  findClassOnboardingInfo(classId: string): Promise<{ level: string; templateCode: string | null } | null>;
  findProfilesParDateNaissance(schoolId: string, dateOfBirth: Date): Promise<OnboardingProfileMatch[]>;
  findGroupTransferRequestByOnboarding(onboardingId: string): Promise<{ sourceUserId: string } | null>;

  // Écritures simples
  createSquelette(data: {
    schoolId: string;
    nomProvisoire: string;
    classId: string | null;
    contactEmail: string | null;
    contactTelephone: string | null;
    parentContactEmail: string | null;
    parentContactTelephone: string | null;
    recipientType: OnboardingRecipient;
    sourceType: OnboardingSource;
    examCandidateId: string | null;
    eleveADispositif: boolean | null;
    eleveDispositifOS: string | null;
    parentADispositif: boolean | null;
    parentDispositifOS: string | null;
    token: string;
    tokenExpiresAt: Date;
  }): Promise<OnboardingRecord>;
  marquerOnboardingExpire(id: string): Promise<void>;
  soumettreFormulaire(id: string, data: {
    submittedData: Record<string, unknown>;
    submittedAt: Date;
    tokenUsedAt: Date;
    matchScore: number | null;
    matchedStudentId: string | null;
    eleveADispositif?: boolean;
    parentADispositif?: boolean;
  }): Promise<void>;
  rejeterOnboarding(id: string, data: { rejectionReason: string; rejectedById: string; rejectedAt: Date }): Promise<void>;
  reactiverStudentProfilesTransferes(sourceUserId: string): Promise<void>;

  // Écriture atomique — ValiderOnboarding (tx multi-tables unique)
  validerOnboarding(input: ValiderOnboardingInput): Promise<{ studentProfileId: string; comptesCrees: ValiderOnboardingCompteResultat[] }>;
}
