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
import { getTemplateMeta } from '../school/schoolTemplateConfig';
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

    const aucunContact = !cmd.contactEmail && !cmd.contactTelephone && !cmd.parentContactEmail && !cmd.parentContactTelephone;
    if (aucunContact && !cmd.aucunContactDisponible) {
      throw new Error('Un email ou un numéro de téléphone de contact est requis pour envoyer le lien (ou confirmer explicitement qu\'aucun contact n\'est disponible)');
    }

    // Deux comptes distincts (LES_DEUX) exigent des contacts distincts — sinon @@unique
    // ([schoolId, email/phone]) sur User ferait échouer la création du second compte, au
    // moment de la validation seulement. On le vérifie ici, tout de suite, avec un message clair.
    if (cmd.contactEmail && cmd.parentContactEmail && cmd.contactEmail === cmd.parentContactEmail) {
      throw new Error('Le contact élève et le contact parent doivent utiliser des emails différents');
    }
    if (cmd.contactTelephone && cmd.parentContactTelephone && cmd.contactTelephone === cmd.parentContactTelephone) {
      throw new Error('Le contact élève et le contact parent doivent utiliser des numéros de téléphone différents');
    }

    // Signal structurel prioritaire (maternelle/primaire) : il n'existe aucun champ "cycle" par
    // classe ou par section dans le schéma (Section n'a que code/gradingSystem) — le seul signal
    // fiable actuellement disponible est le template de l'ÉCOLE (School.templateCode →
    // getTemplateMeta().isPrimaire, déjà utilisé ailleurs pour StaffPermissionRules). Limite
    // connue : pour un établissement COMPLEXE_SCOLAIRE (primaire + secondaire mélangés dans la
    // même école), ce signal école-entière ne distingue pas les classes primaire des classes
    // secondaire en son sein — seul un vrai champ par classe résoudrait ça correctement.
    let sectionCycle: 'primaire' | 'secondaire' | null = null;
    if (cmd.classId) {
      const classe = await this.prisma.class.findUnique({
        where: { id: cmd.classId },
        select: { school: { select: { templateCode: true } } },
      });
      if (classe?.school) {
        sectionCycle = getTemplateMeta(classe.school.templateCode).isPrimaire ? 'primaire' : 'secondaire';
      }
    }

    const recipientType = determinerRecipientType({
      sourceType,
      recipientTypeExplicite: cmd.recipientType,
      defaultRecipient: settings?.defaultRecipient,
      sectionCycle,
      eleveADispositif: cmd.eleveADispositif,
      parentADispositif: cmd.parentADispositif,
      ageThresholdForParent: settings?.ageThresholdForParent,
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
        parentContactEmail: cmd.parentContactEmail ?? null,
        parentContactTelephone: cmd.parentContactTelephone ?? null,
        recipientType,
        sourceType,
        examCandidateId: cmd.examCandidateId ?? null,
        eleveADispositif: cmd.eleveADispositif ?? null,
        eleveDispositifOS: cmd.eleveDispositifOS ?? null,
        parentADispositif: cmd.parentADispositif ?? null,
        parentDispositifOS: cmd.parentDispositifOS ?? null,
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
