export interface VerifierRattachementOptions {
  /**
   * true  : un professeur principal de la classe est aussi autorisé, même sans assignation sur
   *         cette matière précise (présences, rattrapage sans matière précisée — l'usage réel).
   * false : seule une assignation classe+matière (TeachingAssignment) compte — pour tout ce qui
   *         est intrinsèquement lié à UNE matière (notes, cahier de texte).
   */
  autoriserProfesseurPrincipal: boolean;
}

export interface RattachementEnseignantRepository {
  /**
   * Vérifie qu'un enseignant est réellement rattaché à une classe (et matière optionnelle).
   * Source unique de vérité pour notes, présences, cahier de texte, rattrapage.
   */
  estRattacheALaClasse(
    teacherId: string,
    classId: string,
    subjectId: string | undefined,
    options: VerifierRattachementOptions,
  ): Promise<boolean>;
}