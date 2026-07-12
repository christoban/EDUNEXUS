/**
 * APPLICATION — Use case : Dashboard paiements consolidé par élève
 *
 * Retourne toutes les infos de paiement (MINESEC + établissement) pour un élève.
 */
import type { PrismaClient } from '@prisma/client';
import type { StudentPaymentDashboard } from './types';

export class GetStudentPaymentDashboardUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(schoolId: string, studentUserId: string): Promise<StudentPaymentDashboard> {
    // Récupérer le profil élève
    const profile = await (this.prisma as any).studentProfile.findFirst({
      where: { user: { id: studentUserId, schoolId } },
      include: {
        user: { select: { firstName: true, lastName: true } },
        class: { select: { name: true } },
      },
    });
    if (!profile) throw new Error('Élève introuvable');

    // Récupérer l'enrollment actif
    const enrollment = await (this.prisma as any).enrollment.findFirst({
      where: { studentId: profile.id, schoolId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    // Paiements MINESEC
    const paiementsMinesec = enrollment
      ? await (this.prisma as any).paiementMinesec.findMany({
          where: { enrollmentId: enrollment.id },
          orderBy: { typeFrais: 'asc' },
        })
      : [];

    // Paiements établissement
    const paiementsEtablissement = enrollment
      ? await (this.prisma as any).paiementEtablissement.findMany({
          where: { enrollmentId: enrollment.id },
          orderBy: { typeFrais: 'asc' },
        })
      : [];

    // Calcul totaux
    const totalAttenduMinesec = paiementsMinesec.reduce((s: number, p: any) => s + p.montantAttendu, 0);
    const totalPayeMinesec = paiementsMinesec.reduce((s: number, p: any) => s + (p.montantPaye ?? 0), 0);
    const totalAttenduEtab = paiementsEtablissement.reduce((s: number, p: any) => s + p.montantAttendu, 0);
    const totalPayeEtab = paiementsEtablissement.reduce((s: number, p: any) => s + p.montantPaye, 0);

    const totalAttendu = totalAttenduMinesec + totalAttenduEtab;
    const totalPaye = totalPayeMinesec + totalPayeEtab;
    const totalRestant = totalAttendu - totalPaye;

    // Statut global
    let statutGlobal: 'A_JOUR' | 'PARTIELLEMENT_PAYE' | 'EN_RETARD' = 'A_JOUR';
    if (totalRestant > 0) {
      const hasOverdue = paiementsMinesec.some((p: any) => p.status === 'IMPAYE' && p.dateEcheance && new Date(p.dateEcheance) < new Date())
        || paiementsEtablissement.some((p: any) => p.status === 'IMPAYE');
      statutGlobal = hasOverdue ? 'EN_RETARD' : 'PARTIELLEMENT_PAYE';
    }

    return {
      student: {
        id: profile.id,
        nom: profile.user.lastName,
        prenom: profile.user.firstName,
        classe: profile.class?.name ?? '',
        matriculeNational: profile.matricule,
      },
      enrollment: enrollment ? {
        id: enrollment.id,
        status: enrollment.status,
        anneeScolaire: enrollment.anneeScolaire,
      } : { id: '', status: 'NONE', anneeScolaire: '' },
      paiementsMinesec: paiementsMinesec.map((p: any) => ({
        id: p.id,
        typeFrais: p.typeFrais,
        montantAttendu: p.montantAttendu,
        montantPaye: p.montantPaye,
        status: p.status,
        dateEcheance: p.dateEcheance,
        operateur: p.operateur,
        recuVerifie: p.recuVerifie,
      })),
      paiementsEtablissement: paiementsEtablissement.map((p: any) => ({
        id: p.id,
        label: p.typeFrais,
        montantAttendu: p.montantAttendu,
        montantPaye: p.montantPaye,
        status: p.status,
        recu: p.recu,
      })),
      totaux: {
        totalAttendu,
        totalPaye,
        totalRestant,
        statutGlobal,
      },
    };
  }
}
