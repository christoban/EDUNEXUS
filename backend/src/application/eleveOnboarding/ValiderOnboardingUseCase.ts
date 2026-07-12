/**
 * APPLICATION — Use case : Valider un onboarding élève (dernière étape avant création de compte)
 *
 * Seule action qui crée réellement le(s) compte(s) — jamais avant, jamais automatiquement
 * (règle métier n°1). La classe reste modifiable ici (classId en override), pas imposée
 * par le squelette initial : c'est la correction directe de la faille "classe assignée
 * automatiquement" du flux concours (voir spec section 6). Les mots de passe sont
 * aléatoires et jamais révélés — chaque compte est activé via un lien "configurez votre
 * mot de passe" qui réutilise le mécanisme resetPasswordToken déjà en place
 * (UserController.forgotPassword), pas un mot de passe par défaut en clair comme dans
 * l'ancien flux concours.
 *
 * Crée le compte élève (User role STUDENT + StudentProfile) systématiquement — un
 * StudentProfile exige toujours un User. En plus, selon recipientType :
 *   - ELEVE     : seul le compte élève reçoit les coordonnées de contact + un lien de
 *                 configuration de mot de passe.
 *   - PARENT    : le compte élève n'a pas de coordonnées propres (email/phone null) ;
 *                 un compte PARENT (User + ParentProfile + ParentStudent) est créé et
 *                 reçoit les coordonnées + le lien de configuration.
 *   - LES_DEUX  : les deux comptes reçoivent les coordonnées (mêmes contactEmail/
 *                 contactTelephone — le modèle StudentOnboarding n'a qu'un seul couple
 *                 de coordonnées, pas un par destinataire) et un lien chacun.
 * Le lien parent↔élève (ParentStudent) est indispensable au-delà du simple accès :
 * tout le système de notifications (SMS absences, paiements, bulletins...) résout le
 * téléphone à contacter via ParentStudent → ParentProfile → User.phone, JAMAIS via le
 * téléphone propre de l'élève (voir SmsNotificationService.getParentPhones) — sans ce
 * lien, un élève onboardé via CONCOURS (recipientType=PARENT forcé) ne recevrait plus
 * aucune notification, silencieusement. C'est la même classe de faille que celle que ce
 * chantier corrige déjà (compte injoignable), donc traitée ici plutôt que laissée de côté.
 *
 * Si un compte PARENT existe déjà pour ce contact dans l'école (cas fréquent : un autre
 * enfant déjà scolarisé), il est réutilisé — pas de doublon, pas de nouveau mot de passe
 * à configurer (contrainte @@unique([schoolId, email/phone]) sur User de toute façon).
 */
import type { PrismaClient } from '@prisma/client';
import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { parseDateFR } from '../../utils/dateParsing';
import { logActivity } from '../../utils/activitieslog';
import { peutTransitionnerDepuisPendingValidation } from './rules';
import type { ValiderOnboardingCommande, ValiderOnboardingResultat, ValiderOnboardingCompteResultat } from './types';

const RESET_TOKEN_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours pour configurer le mot de passe

function genererIdentifiants() {
  const resetToken = randomBytes(32).toString('hex');
  const resetTokenHash = createHash('sha256').update(resetToken).digest('hex');
  return { resetToken, resetTokenHash, resetTokenExpiry: new Date(Date.now() + RESET_TOKEN_VALIDITY_MS) };
}

export class ValiderOnboardingUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: ValiderOnboardingCommande): Promise<ValiderOnboardingResultat> {
    const onboarding = await (this.prisma as any).studentOnboarding.findFirst({
      where: { id: cmd.onboardingId, schoolId: cmd.schoolId },
    });
    if (!onboarding) throw new Error('Dossier introuvable');
    if (!peutTransitionnerDepuisPendingValidation(onboarding.status)) {
      throw new Error(`Ce dossier ne peut pas être validé depuis son statut actuel (${onboarding.status}) — seul PENDING_VALIDATION peut passer à VALIDATED`);
    }

    const settings = await (this.prisma as any).schoolOnboardingSettings.findUnique({ where: { schoolId: cmd.schoolId } });
    const responsableRole = settings?.responsableRole ?? 'ADMIN';
    if (cmd.validatorRole !== responsableRole) {
      throw new Error(`Seul un utilisateur avec le rôle ${responsableRole} peut valider ce dossier`);
    }

    const classId = cmd.classId ?? onboarding.classId;
    if (!classId) throw new Error('Aucune classe définie pour ce dossier — précisez-en une avant de valider');

    const submitted = (onboarding.submittedData ?? {}) as Record<string, any>;
    const nom = String(submitted.nom || onboarding.nomProvisoire);
    const prenom = String(submitted.prenom || '');
    const dateOfBirth = typeof submitted.dateNaissance === 'string' ? parseDateFR(submitted.dateNaissance) : null;
    const gender = typeof submitted.gender === 'string' ? submitted.gender : null;

    const recipientType = onboarding.recipientType as 'ELEVE' | 'PARENT' | 'LES_DEUX';
    // StudentOnboarding n'a qu'UN SEUL couple contactEmail/contactTelephone (pas un par
    // destinataire), et User a une contrainte @@unique([schoolId, email/phone]) — deux
    // comptes de rôles différents ne peuvent donc JAMAIS partager le même contact dans
    // la même école (l'un des deux create() violerait la contrainte). Pour LES_DEUX, le
    // compte PARENT reçoit le contact (priorité aux notifications, voir le commentaire
    // de tête) et le compte élève n'a pas de coordonnées propres, comme pour PARENT seul.
    // Distinction PARENT vs LES_DEUX à affiner si le formulaire collecte un jour deux
    // contacts séparés (un pour l'élève, un pour le parent).
    const eleveRecoitContact = recipientType === 'ELEVE';
    const parentRecoitContact = recipientType === 'PARENT' || recipientType === 'LES_DEUX';

    const studentPassword = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
    const studentReset = eleveRecoitContact ? genererIdentifiants() : null;

    const { studentProfile, comptesCrees } = await this.prisma.$transaction(async (tx) => {
      const studentUser = await (tx as any).user.create({
        data: {
          schoolId: cmd.schoolId,
          role: 'STUDENT',
          firstName: prenom,
          lastName: nom,
          email: eleveRecoitContact ? onboarding.contactEmail : null,
          phone: eleveRecoitContact ? onboarding.contactTelephone : null,
          passwordHash: studentPassword,
          resetPasswordToken: studentReset?.resetTokenHash ?? null,
          resetPasswordTokenExpiry: studentReset?.resetTokenExpiry ?? null,
          isActive: true,
        },
      });

      const studentProfile = await (tx as any).studentProfile.create({
        data: {
          userId: studentUser.id,
          classId,
          studentStatus: 'ACTIVE',
          dateOfBirth,
          gender,
        },
      });

      const comptesCrees: ValiderOnboardingCompteResultat[] = [{
        role: 'STUDENT',
        userId: studentUser.id,
        resetToken: studentReset?.resetToken ?? null,
        contactEmail: eleveRecoitContact ? onboarding.contactEmail : null,
        contactTelephone: eleveRecoitContact ? onboarding.contactTelephone : null,
        compteExistant: false,
      }];

      if (parentRecoitContact) {
        const contactFilters = [
          onboarding.contactEmail ? { email: onboarding.contactEmail } : null,
          onboarding.contactTelephone ? { phone: onboarding.contactTelephone } : null,
        ].filter(Boolean) as Record<string, string>[];

        const existingParentUser = contactFilters.length > 0
          ? await (tx as any).user.findFirst({ where: { schoolId: cmd.schoolId, role: 'PARENT', OR: contactFilters } })
          : null;

        let parentProfileId: string;
        let parentUserId: string;
        let parentReset: ReturnType<typeof genererIdentifiants> | null;
        let compteExistant: boolean;

        if (existingParentUser) {
          const existingProfile = await (tx as any).parentProfile.findUnique({ where: { userId: existingParentUser.id } });
          parentProfileId = existingProfile.id;
          parentUserId = existingParentUser.id;
          parentReset = null;
          compteExistant = true;
        } else {
          parentReset = genererIdentifiants();
          const parentPassword = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
          const parentUser = await (tx as any).user.create({
            data: {
              schoolId: cmd.schoolId,
              role: 'PARENT',
              firstName: 'Parent de',
              lastName: nom,
              email: onboarding.contactEmail,
              phone: onboarding.contactTelephone,
              passwordHash: parentPassword,
              resetPasswordToken: parentReset.resetTokenHash,
              resetPasswordTokenExpiry: parentReset.resetTokenExpiry,
              isActive: true,
            },
          });
          const parentProfile = await (tx as any).parentProfile.create({ data: { userId: parentUser.id } });
          parentProfileId = parentProfile.id;
          parentUserId = parentUser.id;
          compteExistant = false;
        }

        await (tx as any).parentStudent.create({
          data: { parentProfileId, studentProfileId: studentProfile.id },
        });

        comptesCrees.push({
          role: 'PARENT',
          userId: parentUserId,
          resetToken: parentReset?.resetToken ?? null,
          contactEmail: onboarding.contactEmail,
          contactTelephone: onboarding.contactTelephone,
          compteExistant,
        });
      }

      await (tx as any).studentOnboarding.update({
        where: { id: onboarding.id },
        data: {
          status: 'ACTIVATED',
          validatedById: cmd.validatedById,
          validatedAt: new Date(),
          createdStudentId: studentProfile.id,
          classId,
        },
      });

      if (onboarding.examCandidateId) {
        await (tx as any).entranceExamCandidate.update({
          where: { id: onboarding.examCandidateId },
          data: { studentProfileId: studentProfile.id },
        });
      }

      return { studentProfile, comptesCrees };
    });

    await logActivity({
      userId: cmd.validatedById,
      schoolId: cmd.schoolId,
      action: 'ONBOARDING_VALIDATED',
      details: `Compte(s) créé(s) pour ${nom} ${prenom} (dossier ${onboarding.id}, source ${onboarding.sourceType}, ${comptesCrees.length} compte(s))`,
    });

    return {
      onboardingId: onboarding.id,
      studentProfileId: studentProfile.id,
      recipientType,
      comptesCrees,
    };
  }
}
