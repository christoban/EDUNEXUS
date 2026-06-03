/**
 * APPLICATION LAYER — Use Case : Calculer l'indice de santé scolaire
 *
 * 5 composantes pondérées (source : EduNexus spec) :
 * - Notes        : 35% — moyenne générale normalisée (0-20 → 0-100)
 * - Assiduité    : 25% — (jours présent / jours total) × 100
 * - Tendance     : 20% — évolution sur 3 dernières périodes
 * - Comportement : 10% — sanctions / nombre de périodes
 * - Paiements    : 10% — frais réglés / frais totaux
 *
 * Niveaux : 0-30 CRITIQUE | 31-50 ELEVE | 51-70 MOYEN | 71-85 STABLE | 86-100 PROGRESSION
 */
import type { IAService, ResultatIndiceSante } from '@domain/ports/services/IAService';
import type { SanteEleveRepository } from '@domain/ports/repositories/SanteEleveRepository';

export interface CalculerIndiceSanteCommande {
  studentId: string;
  schoolId: string;
  academicYearId: string;
  sauvegarderScore?: boolean; // Si true → persiste le score dans studentProfile
}

export class CalculerIndiceSanteUseCase {
  constructor(
    private readonly santeRepository: SanteEleveRepository,
    private readonly iaService: IAService,
  ) {}

  async execute(commande: CalculerIndiceSanteCommande): Promise<ResultatIndiceSante> {
    // 1. Récupérer les données
    const donnees = await this.santeRepository.getDonneesSante(
      commande.studentId,
      commande.schoolId,
      commande.academicYearId
    );

    if (!donnees) {
      throw new Error(`Données de santé introuvables pour l'élève : ${commande.studentId}`);
    }

    // 2. Calculer chaque composante (0-100)
    const scoreNotes = Math.min(100, (donnees.moyenneGenerale / 20) * 100);

    const tauxPresence = donnees.joursTotaux > 0
      ? (donnees.joursPresent / donnees.joursTotaux) * 100
      : 100;

    const scoreTendance = this.calculerTendance(donnees.moyennesPrecedentes);

    const scoreComportement = donnees.nombrePeriodes > 0
      ? Math.max(0, 100 - (donnees.nombreSanctions / donnees.nombrePeriodes) * 20)
      : 100;

    const scorePaiements = donnees.fraisTotaux > 0
      ? (donnees.fraisRegles / donnees.fraisTotaux) * 100
      : 100;

    // 3. Score pondéré global
    const score = Math.round(
      scoreNotes * 0.35 +
      tauxPresence * 0.25 +
      scoreTendance * 0.20 +
      scoreComportement * 0.10 +
      scorePaiements * 0.10
    );

    // 4. Déléguer l'analyse narrative et les recommandations à l'IA
    const resultat = await this.iaService.calculerIndiceSante({
      moyenneGenerale: donnees.moyenneGenerale,
      tauxPresence,
      tendanceMoyennes: donnees.moyennesPrecedentes,
      nombreSanctions: donnees.nombreSanctions,
      tauxPaiement: scorePaiements,
    });

    // 5. Sauvegarder si demandé
    if (commande.sauvegarderScore) {
      await this.santeRepository.sauvegarderScore(commande.studentId, score);
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      niveau: resultat.niveau,
      recommandations: resultat.recommandations,
    };
  }

  /**
   * Calcule un score de tendance basé sur l'évolution des moyennes.
   * Hausse régulière = bon score, baisse = mauvais score.
   */
  private calculerTendance(moyennes: number[]): number {
    if (moyennes.length < 2) return 50; // Neutre si pas assez de données

    const dernieres = moyennes.slice(-3); // Max 3 dernières périodes
    let tendance = 50; // Point de départ neutre

    for (let i = 1; i < dernieres.length; i++) {
      const diff = dernieres[i]! - dernieres[i - 1]!;
      if (diff >= 2) tendance += 25;        // Hausse significative ≥ 2 pts → +25
      else if (diff >= 0.5) tendance += 10; // Légère hausse → +10
      else if (diff <= -2) tendance -= 25;  // Baisse significative → -25
      else if (diff < 0) tendance -= 10;    // Légère baisse → -10
    }

    return Math.max(0, Math.min(100, tendance));
  }
}
