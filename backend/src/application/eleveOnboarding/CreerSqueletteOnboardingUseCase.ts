/**
 * APPLICATION — Use case : Créer le squelette d'un onboarding élève auto-service
 *
 * Génère un lien sécurisé à token unique que l'élève/parent utilisera pour compléter
 * son dossier. Ne crée AUCUN compte — uniquement le squelette + le token. La création
 * du compte n'a lieu qu'après validation humaine explicite (voir ValiderOnboardingUseCase).
 * L'envoi effectif de l'email/SMS est délégué au contrôleur (pas de dépendance infra ici,
 * cohérent avec EntranceExamController/PebsExamController qui notifient après coup).
 */
import type { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { logActivity } from '../../utils/activitieslog';
import { determinerRecipientType } from './rules';
import type { CreerSqueletteOnboardingCommande, CreerSqueletteOnboardingResultat } from './types';

export class CreerSqueletteOnboardingUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: CreerSqueletteOnboardingCommande): Promise<CreerSqueletteOnboardingResultat> {
    const sourceType = cmd.sourceType ?? 'AUTOSERVICE';

    const settings = await (this.prisma as any).schoolOnboardingSettings.findUnique({ where: { schoolId: cmd.schoolId } });

    // L'auto-service classique peut être désactivé par établissement, mais JAMAIS le flux
    // CONCOURS — sinon un candidat admis n'aurait plus aucun moyen d'obtenir un compte
    // correctement rempli (c'est justement la faille que ce module corrige).
    if (sourceType !== 'CONCOURS' && !settings?.selfServiceEnabled) {
      throw new Error("L'auto-service des inscriptions n'est pas activé pour cet établissement");
    }

    if (!cmd.contactEmail && !cmd.contactTelephone) {
      throw new Error('Un email ou un numéro de téléphone de contact est requis pour envoyer le lien');
    }

    const recipientType = determinerRecipientType({
      sourceType,
      recipientTypeExplicite: cmd.recipientType,
      defaultRecipient: settings?.defaultRecipient,
    });

    const token = randomBytes(32).toString('hex');
    const tokenExpiryDays = settings?.tokenExpiryDays ?? 14;
    const tokenExpiresAt = new Date(Date.now() + tokenExpiryDays * 24 * 60 * 60 * 1000);

    const onboarding = await (this.prisma as any).studentOnboarding.create({
      data: {
        schoolId: cmd.schoolId,
        nomProvisoire: cmd.nomProvisoire,
        classId: cmd.classId ?? null,
        contactEmail: cmd.contactEmail ?? null,
        contactTelephone: cmd.contactTelephone ?? null,
        recipientType,
        sourceType,
        examCandidateId: cmd.examCandidateId ?? null,
        token,
        tokenExpiresAt,
        status: 'LINK_SENT',
      },
    });

    await logActivity({
      userId: cmd.createdById,
      schoolId: cmd.schoolId,
      action: 'ONBOARDING_LINK_CREATED',
      details: `Dossier créé pour "${cmd.nomProvisoire}" (source ${sourceType}, destinataire ${recipientType})`,
    });

    return {
      id: onboarding.id,
      token,
      tokenExpiresAt,
      status: onboarding.status,
      recipientType,
      contactEmail: onboarding.contactEmail,
      contactTelephone: onboarding.contactTelephone,
    };
  }
}
