/**
 * DOMAIN LAYER — Port Repository ClassCouncil (minimal)
 * Utilisé par GenererBulletinUseCase pour enforcer Loi 5b :
 * le conseil doit être LOCKED avant toute génération de bulletins.
 */
export interface ClassCouncilRepository {
  /**
   * Retourne true si une session de conseil verrouillée (LOCKED)
   * existe pour cette classe et cette période.
   */
  sessionVerrouilleeExiste(classId: string, academicPeriodId: string): Promise<boolean>;
}
