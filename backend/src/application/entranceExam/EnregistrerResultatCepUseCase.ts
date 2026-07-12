import type { PrismaClient } from '@prisma/client';
import type { EnregistrerResultatCepCommande } from './types';
import { CreerSqueletteOnboardingUseCase } from '../eleveOnboarding/CreerSqueletteOnboardingUseCase';

/**
 * Phase 5 de la spec onboarding auto-service élève (spec-onboarding-eleve-autoservice.md
 * section 6) : la branche REUSSI ne crée plus de compte directement (mot de passe
 * hardcodé 'ZEKOULABIA2024', sans email/téléphone, classe devinée par
 * Class.level.contains('6') et imposée) — elle délègue à CreerSqueletteOnboardingUseCase,
 * le même mécanisme de lien sécurisé/validation humaine que l'onboarding classique. La
 * classe suggérée devient EntranceExamSession.targetClassId si configuré, sinon retombe
 * sur l'ancienne heuristique par niveau — mais dans les deux cas ce n'est plus qu'une
 * SUGGESTION modifiable par le responsable au moment de valider, jamais une assignation
 * automatique. recipientType=PARENT forcé : un admis en 6e est quasi systématiquement
 * mineur (règle métier n°3 de la spec).
 */
export class EnregistrerResultatCepUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly creerSqueletteOnboarding: CreerSqueletteOnboardingUseCase,
  ) {}

  async execute(cmd: EnregistrerResultatCepCommande): Promise<{
    status: string; onboardingCreated: boolean; candidateName: string; parentPhone: string | null;
    onboarding?: { id: string; token: string; tokenExpiresAt: Date; contactEmail: string | null; contactTelephone: string | null };
  }> {
    const candidate = await (this.prisma as any).entranceExamCandidate.findUnique({
      where: { id: cmd.candidateId },
      include: { session: true },
    });
    if (!candidate) throw new Error('Candidat introuvable');
    if (candidate.session.schoolId !== cmd.schoolId) throw new Error('Accès refusé');
    if (candidate.admissionStatus !== 'ADMIS_PROVISOIRE') {
      throw new Error('Seuls les candidats ADMIS_PROVISOIRE peuvent recevoir un résultat CEP');
    }

    const now = new Date();
    const candidateName = `${candidate.firstName} ${candidate.lastName}`;
    const parentPhone: string | null = candidate.parentPhone ?? null;

    if (cmd.cepResult === 'REUSSI') {
      await (this.prisma as any).entranceExamCandidate.update({
        where: { id: cmd.candidateId },
        data: {
          cepResult: 'REUSSI',
          cepResultDate: now,
          admissionStatus: 'CONFIRME',
        },
      });

      // Suggestion de classe — targetClassId si configuré sur la session (déterministe),
      // sinon repli sur l'heuristique par niveau (comportement historique, mais désormais
      // seulement une suggestion éditable, jamais une assignation directe).
      let classId: string | undefined = candidate.session.targetClassId ?? undefined;
      if (!classId) {
        const classes6e = await this.prisma.class.findMany({
          where: { schoolId: cmd.schoolId, level: { contains: '6' } },
          orderBy: { name: 'asc' },
          take: 1,
        });
        classId = classes6e[0]?.id;
      }

      // L'admission est déjà confirmée ci-dessus — la création du squelette d'onboarding est
      // volontairement best-effort : si elle échoue (ex. aucun téléphone parent renseigné),
      // l'admission ne doit pas rester bloquée ni le candidat coincé en CONFIRME sans dossier
      // (la garde ADMIS_PROVISOIRE plus haut empêcherait alors tout nouvel essai). L'admin est
      // notifié via onboardingCreated=false et peut créer le squelette manuellement une fois
      // les coordonnées du parent corrigées.
      let onboarding: { id: string; token: string; tokenExpiresAt: Date; contactEmail: string | null; contactTelephone: string | null } | undefined;
      try {
        onboarding = await this.creerSqueletteOnboarding.execute({
          schoolId: candidate.session.schoolId,
          createdById: cmd.enregistreParId,
          nomProvisoire: candidateName,
          classId,
          contactTelephone: parentPhone,
          recipientType: 'PARENT',
          sourceType: 'CONCOURS',
          examCandidateId: candidate.id,
        });
      } catch (err: any) {
        console.error('[EnregistrerResultatCepUseCase] Échec création squelette onboarding:', err?.message);
      }

      return { status: 'CONFIRME', onboardingCreated: Boolean(onboarding), candidateName, parentPhone, onboarding };
    } else {
      await (this.prisma as any).entranceExamCandidate.update({
        where: { id: cmd.candidateId },
        data: {
          cepResult: 'ECHOUE',
          cepResultDate: now,
          admissionStatus: 'ANNULE',
        },
      });
      return { status: 'ANNULE', onboardingCreated: false, candidateName, parentPhone };
    }
  }
}
