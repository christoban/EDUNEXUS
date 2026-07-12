export type OnboardingRecipient = 'ELEVE' | 'PARENT' | 'LES_DEUX';
export type OnboardingSource = 'IMPORT_MASSE' | 'AUTOSERVICE' | 'CONCOURS';
export type OnboardingStatus =
  | 'DRAFT' | 'LINK_SENT' | 'SUBMITTED' | 'PENDING_VALIDATION'
  | 'VALIDATED' | 'ACTIVATED' | 'REJECTED' | 'EXPIRED';

export interface CreerSqueletteOnboardingCommande {
  schoolId: string;
  createdById: string;
  nomProvisoire: string;
  classId?: string | null;
  contactEmail?: string | null;
  contactTelephone?: string | null;
  recipientType?: OnboardingRecipient;
  sourceType?: OnboardingSource;
  examCandidateId?: string | null;
}

export interface CreerSqueletteOnboardingResultat {
  id: string;
  token: string;
  tokenExpiresAt: Date;
  status: string;
  recipientType: string;
  contactEmail: string | null;
  contactTelephone: string | null;
}

export interface SoumettreFormulaireOnboardingCommande {
  token: string;
  nom: string;
  prenom: string;
  /** DD/MM/AAAA ou ISO — parsé via parseDateFR. Sans elle, le matching ne peut pas s'exécuter (verrou dur). */
  dateNaissance?: string;
  /** Reste du formulaire (genre, école d'origine...), stocké tel quel dans submittedData. */
  donneesComplementaires?: Record<string, unknown>;
}

export interface SoumettreFormulaireOnboardingResultat {
  id: string;
  status: string;
  matchScore: number | null;
  matchedStudentId: string | null;
}

export interface ValiderOnboardingCommande {
  schoolId: string;
  onboardingId: string;
  validatedById: string;
  /** Rôle de l'utilisateur qui valide — vérifié contre SchoolOnboardingSettings.responsableRole. */
  validatorRole: string;
  /** Override de la suggestion de classe, si le responsable la change au moment de valider. */
  classId?: string | null;
}

/** Un compte (élève et/ou parent) créé ou réutilisé pendant la validation, à notifier par le contrôleur. */
export interface ValiderOnboardingCompteResultat {
  role: 'STUDENT' | 'PARENT';
  userId: string;
  /** Token EN CLAIR pour le lien "configurez votre mot de passe" — null si compte existant réutilisé (rien à configurer). */
  resetToken: string | null;
  contactEmail: string | null;
  contactTelephone: string | null;
  /** true si un compte PARENT existant a été réutilisé (autre enfant déjà scolarisé) plutôt que recréé. */
  compteExistant: boolean;
}

export interface ValiderOnboardingResultat {
  onboardingId: string;
  studentProfileId: string;
  recipientType: string;
  /** 1 compte (STUDENT) si recipientType=ELEVE, 1 (PARENT) si PARENT, 2 si LES_DEUX. */
  comptesCrees: ValiderOnboardingCompteResultat[];
}

export interface RejeterOnboardingCommande {
  schoolId: string;
  onboardingId: string;
  rejectedById: string;
  validatorRole: string;
  rejectionReason: string;
}

export interface RejeterOnboardingResultat {
  onboardingId: string;
  status: string;
}
