/**
 * APPLICATION — Use case : Synchronisation paiements depuis cartescolaire.cm
 *
 * Pour tous les élèves avec matricule dans l'établissement,
 * vérifie le statut de paiement sur cartescolaire.cm et met à jour les PaiementMinesec.
 */
import type { PrismaClient, OperateurMinesec } from '@prisma/client';
import type { CarteScolaireService } from '@domain/ports/services/CarteScolaireService';

export interface SyncReport {
  totalEleves: number;
  elevesAvecMatricule: number;
  nouveauxPaiements: number;
  paiementsConfirmes: number;
  /** Impayés CONFIRMÉS par une vérification réussie — pas de simples échecs de requête. */
  elevesImpayes: number;
  /** Vérification impossible (site injoignable, circuit ouvert, page non reconnue) — statut réel inconnu. */
  verificationEchouee: number;
  errors: string[];
  syncedAt: Date;
}

export class SyncFromCarteScolaireUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly carteScolaireService: CarteScolaireService,
  ) {}

  async execute(schoolId: string, anneeScolaire: string): Promise<SyncReport> {
    const report: SyncReport = {
      totalEleves: 0,
      elevesAvecMatricule: 0,
      nouveauxPaiements: 0,
      paiementsConfirmes: 0,
      elevesImpayes: 0,
      verificationEchouee: 0,
      errors: [],
      syncedAt: new Date(),
    };

    // Récupérer tous les élèves actifs avec matricule
    const profiles = await this.prisma.studentProfile.findMany({
      where: {
        user: { schoolId },
        matricule: { not: null },
        studentStatus: 'ACTIVE',
      },
      select: { id: true, matricule: true },
    });

    report.totalEleves = await this.prisma.studentProfile.count({
      where: { user: { schoolId }, studentStatus: 'ACTIVE' },
    });
    report.elevesAvecMatricule = profiles.length;

    // Traiter par batch de 20
    const BATCH_SIZE = 20;
    for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
      const batch = profiles.slice(i, i + BATCH_SIZE);

      for (const profile of batch) {
        try {
          const paymentStatus = await this.carteScolaireService.checkPaiementStatus(
            profile.matricule!,
            anneeScolaire,
          );

          if (paymentStatus.paye) {
            // Chercher les PaiementMinesec IMPAYE pour cet élève
            const impayes = await this.prisma.paiementMinesec.findMany({
              where: {
                studentId: profile.id,
                anneeScolaire,
                status: 'IMPAYE',
              },
            });

            for (const impaye of impayes) {
              // Vérifier si le type de frais correspond
              await this.prisma.paiementMinesec.update({
                where: { id: impaye.id },
                data: {
                  status: 'VERIFIE',
                  recuVerifie: true,
                  recuVerifieAt: new Date(),
                  datePaiement: paymentStatus.datePaiement ?? new Date(),
                  montantPaye: paymentStatus.montant ?? impaye.montantAttendu,
                  // L'adaptateur cartescolaire.cm ne renseigne jamais ce champ à ce jour (opérateur
                  // affiché en logo image côté source, non extrait avec fiabilité — voir
                  // CarteScolaireScrapingAdapter). Cast conservé strictement informatif : ne
                  // valide rien de plus que ce que le port autorisait déjà avant le retrait du cast.
                  operateur: (paymentStatus.operateur as OperateurMinesec | undefined) ?? null,
                  dataSource: 'SYNC_NIGHTLY',
                },
              });
              report.nouveauxPaiements++;
            }

            if (impayes.length === 0) {
              // Déjà vérifié ou payé — rien à faire
              report.paiementsConfirmes++;
            }
          } else if (!paymentStatus.verified) {
            // Aucune information fiable obtenue (site injoignable, circuit ouvert, page non
            // reconnue) — surtout ne pas compter cet élève comme "impayé", on n'en sait rien.
            report.verificationEchouee++;
          } else {
            // Vérification réussie et confirmée : réellement impayé sur cartescolaire.cm.
            report.elevesImpayes++;
          }
        } catch (err: any) {
          report.errors.push(`${profile.matricule}: ${err.message}`);
        }
      }

      // Pause entre les batches (rate limiting)
      if (i + BATCH_SIZE < profiles.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    return report;
  }
}
