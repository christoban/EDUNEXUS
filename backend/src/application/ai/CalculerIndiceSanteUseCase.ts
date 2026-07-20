/**
 * APPLICATION LAYER — Use Case : Calculer l'indice de santé scolaire
 *
 * 5 composantes pondérées (source : ZekoulABia spec) :
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
  langue?: 'fr' | 'en';       // langue des recommandations IA (résolue par l'appelant via resolveLanguage)
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

    // 2. Composantes + score pondéré (partagé avec calculerScoreSeulement, source unique)
    const composantes = this.calculerComposantes(donnees);

    // 3. Déléguer l'analyse narrative et les recommandations à l'IA
    const resultat = await this.iaService.calculerIndiceSante({
      moyenneGenerale: donnees.moyenneGenerale,
      tauxPresence: composantes.tauxPresence,
      tendanceMoyennes: donnees.moyennesPrecedentes,
      nombreSanctions: donnees.nombreSanctions,
      tauxPaiement: composantes.scorePaiements,
      langue: commande.langue,
    });

    // 4. Sauvegarder si demandé
    if (commande.sauvegarderScore) {
      await this.santeRepository.sauvegarderScore(commande.studentId, composantes.score);
    }

    return {
      score: composantes.score,
      niveau: resultat.niveau,
      recommandations: resultat.recommandations,
    };
  }

  /**
   * Calcule et persiste le score numérique SEUL, sans appel IA — pour le job nocturne qui
   * recalcule des centaines d'élèves : un appel Groq par élève chaque nuit serait coûteux et
   * inutile (la narration n'a de valeur que pour un élève qu'un humain regarde réellement,
   * via execute() ci-dessus, ex. detectRisk). Seule source de vérité du calcul numérique —
   * remplace l'ancienne logique dupliquée dans inngest/functions.ts.
   */
  async calculerScoreSeulement(
    studentId: string,
    schoolId: string,
    academicYearId: string,
  ): Promise<{ score: number; niveau: string; tendancePositive: boolean }> {
    const donnees = await this.santeRepository.getDonneesSante(studentId, schoolId, academicYearId);
    if (!donnees) {
      throw new Error(`Données de santé introuvables pour l'élève : ${studentId}`);
    }

    const composantes = this.calculerComposantes(donnees);
    await this.santeRepository.sauvegarderScore(studentId, composantes.score);

    // Hausse significative et non compensée par une baisse ailleurs dans la fenêtre — cf.
    // calculerTendance (75 = au moins un +25 net, sans redescendre sous la neutralité 50).
    const tendancePositive = composantes.scoreTendance >= 75;

    return { score: composantes.score, niveau: this.niveauDepuisScore(composantes.score), tendancePositive };
  }

  private calculerComposantes(donnees: {
    moyenneGenerale: number;
    joursPresent: number;
    joursTotaux: number;
    moyennesPrecedentes: number[];
    nombreSanctions: number;
    nombrePeriodes: number;
    fraisRegles: number;
    fraisTotaux: number;
  }) {
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

    const scoreBrut = Math.round(
      scoreNotes * 0.35 +
      tauxPresence * 0.25 +
      scoreTendance * 0.20 +
      scoreComportement * 0.10 +
      scorePaiements * 0.10
    );

    return {
      scoreNotes, tauxPresence, scoreTendance, scoreComportement, scorePaiements,
      score: Math.max(0, Math.min(100, scoreBrut)),
    };
  }

  private niveauDepuisScore(score: number): string {
    if (score <= 30) return 'CRITIQUE';
    if (score <= 50) return 'ELEVE';
    if (score <= 70) return 'MOYEN';
    if (score <= 85) return 'STABLE';
    return 'PROGRESSION';
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
