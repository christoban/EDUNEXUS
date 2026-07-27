/**
 * Calcule les KPIs agrégés d'UNE école — jamais un enregistrement individuel ne sort d'ici.
 * Partagé par ObtenirKpisGroupeUseCase (boucle multi-écoles) et ObtenirDetailEcoleGroupeUseCase
 * (une seule école) — voir Plan_Groupe_Scolaire_ZekoulABia.md Section 4.
 */
import type { PrismaClient } from '@prisma/client';

export type SchoolKpis = {
  effectifs: number;
  tauxReussite: number;
  revenus: number;
  tauxAbsenteisme: number;
};

export async function calculerKpisEcole(prisma: PrismaClient, schoolId: string): Promise<SchoolKpis> {
  const effectifs = await prisma.studentProfile.count({
    where: { studentStatus: 'ACTIVE', user: { schoolId } },
  });

  const anneeCourante = await prisma.academicYear.findFirst({
    where: { schoolId, isCurrent: true },
    select: { id: true },
  });

  let tauxReussite = 0;
  if (anneeCourante) {
    const bulletins = await prisma.reportCard.findMany({
      where: { schoolId, academicYearId: anneeCourante.id, generalAverage: { not: null } },
      select: { generalAverage: true },
    });
    if (bulletins.length > 0) {
      const reussis = bulletins.filter((b) => (b.generalAverage ?? 0) >= 10).length;
      tauxReussite = Math.round((reussis / bulletins.length) * 100);
    }
  }

  const paiements = await prisma.payment.aggregate({
    where: { schoolId, status: 'SUCCESS' },
    _sum: { amount: true },
  });
  const revenus = paiements._sum.amount ?? 0;

  const totalPresences = await prisma.attendance.count({ where: { schoolId } });
  let tauxAbsenteisme = 0;
  if (totalPresences > 0) {
    const absences = await prisma.attendance.count({ where: { schoolId, status: 'ABSENT' } });
    tauxAbsenteisme = Math.round((absences / totalPresences) * 100);
  }

  return { effectifs, tauxReussite, revenus, tauxAbsenteisme };
}
