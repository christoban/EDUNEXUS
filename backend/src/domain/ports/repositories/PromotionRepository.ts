/**
 * DOMAIN LAYER — Port Repository Promotion
 * Gère classPromotion (mapping classe→classe suivante)
 * et studentPromotion (audit des promotions individuelles).
 */
export interface ClassPromotionMapping {
  fromClassId: string;
  toClassId: string;
}

export interface PromotionEleveParams {
  schoolId: string;
  studentId: string;
  fromClassId: string;
  toClassId: string;
  academicYearId: string;
  promotedById: string;
}

export interface DecisionConseil {
  studentId: string;
  fromClassId: string;
  decision: 'PASS' | 'REPEAT' | 'DELIBERATION';
}

export interface PromotionRepository {
  /**
   * Retourne le mapping classe source → classe destination pour une école.
   * Configuré par l'Admin avant la clôture.
   */
  findMappingsPromotion(
    schoolId: string,
    academicYearId: string
  ): Promise<ClassPromotionMapping[]>;

  /**
   * Retourne toutes les décisions de conseil pour une année.
   * Source : classCouncilDecision (tous les periodes de l'année).
   */
  findDecisionsEleves(
    schoolId: string,
    academicYearId: string
  ): Promise<DecisionConseil[]>;

  /**
   * Déplace un élève vers sa nouvelle classe + enregistre l'audit.
   * Upsert avec clé (studentId, academicYearId).
   */
  promouvoirEleve(params: PromotionEleveParams): Promise<void>;

  /**
   * Met à jour la classId d'un élève dans son profil.
   */
  mettreAJourClasseEleve(studentId: string, newClassId: string): Promise<void>;

  /**
   * Compte les promotions enregistrées pour le rapport de clôture.
   */
  countPromotions(
    schoolId: string,
    academicYearId: string
  ): Promise<{ promus: number; redoublants: number }>;
}
