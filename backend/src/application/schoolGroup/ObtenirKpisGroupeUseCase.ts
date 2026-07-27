/**
 * APPLICATION LAYER — KPIs consolidés d'un groupe scolaire, agrégés par école et au total.
 * Principe non négociable (Plan_Groupe_Scolaire_ZekoulABia.md Section 4) : chaque école est
 * interrogée séparément puis agrégée — jamais un `schoolId IN (...)` sur une table individuelle.
 */
import type { PrismaClient } from '@prisma/client';
import { calculerKpisEcole } from './calculerKpisEcole';

export class ObtenirKpisGroupeUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(groupId: string) {
    const schools = await this.prisma.school.findMany({ where: { groupId } });

    const parEcole = await Promise.all(
      schools.map(async (school) => ({
        schoolId: school.id,
        schoolName: school.name,
        ...(await calculerKpisEcole(this.prisma, school.id)),
      })),
    );

    const effectifsTotal = parEcole.reduce((s, e) => s + e.effectifs, 0);
    const revenusCumules = parEcole.reduce((s, e) => s + e.revenus, 0);

    const moyennePonderee = (valeurs: { poids: number; valeur: number }[]) => {
      const poidsTotal = valeurs.reduce((s, v) => s + v.poids, 0);
      if (poidsTotal === 0) return 0;
      return Math.round(valeurs.reduce((s, v) => s + v.valeur * v.poids, 0) / poidsTotal);
    };

    const tauxReussiteGlobal = moyennePonderee(
      parEcole.map((e) => ({ poids: e.effectifs, valeur: e.tauxReussite })),
    );
    const tauxAbsenteismeGlobal = moyennePonderee(
      parEcole.map((e) => ({ poids: e.effectifs, valeur: e.tauxAbsenteisme })),
    );

    return {
      parEcole,
      totaux: {
        effectifsTotal,
        tauxReussiteGlobal,
        revenusCumules,
        tauxAbsenteismeGlobal,
      },
    };
  }
}
