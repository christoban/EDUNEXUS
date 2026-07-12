import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { CreerSqueletteOnboardingUseCase } from '@application/eleveOnboarding/CreerSqueletteOnboardingUseCase';
import { SoumettreFormulaireOnboardingUseCase } from '@application/eleveOnboarding/SoumettreFormulaireOnboardingUseCase';
import { ValiderOnboardingUseCase } from '@application/eleveOnboarding/ValiderOnboardingUseCase';
import { RejeterOnboardingUseCase } from '@application/eleveOnboarding/RejeterOnboardingUseCase';
import { notifierOnboardingLienCree, notifierOnboardingValidation } from '../../../utils/onboardingNotifications';

/**
 * Préfixe /api/v2/eleve-onboarding — distinct de /api/v2/onboarding (déjà pris par
 * l'onboarding d'établissement, sans rapport). Voir spec-onboarding-eleve-autoservice.md
 * section 0, point 4.
 *
 * Les deux endpoints publics (token) renvoient des messages d'erreur explicites (400/404/410)
 * au lieu de next(err) — même esprit que InviteOnboardingController pour son propre flux à
 * token public : un parent qui tombe sur un lien expiré doit voir "lien expiré", pas une
 * erreur générique. Les endpoints authentifiés suivent la convention next(err) déjà en place
 * partout ailleurs dans le projet (générique, mais cohérent avec l'existant).
 *
 * Notifications (email/SMS) envoyées directement depuis le contrôleur, fire-and-forget,
 * après la réponse HTTP — même pattern que EntranceExamController/PebsExamController
 * (void notifyXxxSms(...) après res.json), pas via un événement Inngest : ce sont des
 * envois ponctuels déclenchés par une action utilisateur, pas un traitement récurrent.
 * Seule la relance quotidienne (J+3/J+7/escalade/expiration) est un vrai job Inngest,
 * car c'est la seule partie de ce module qui doit tourner sans déclencheur utilisateur
 * (voir backend/src/inngest/eleveOnboardingJobs.ts).
 */
export class EleveOnboardingController {
  constructor(
    private readonly _creerSquelette: CreerSqueletteOnboardingUseCase,
    private readonly _soumettreFormulaire: SoumettreFormulaireOnboardingUseCase,
    private readonly _valider: ValiderOnboardingUseCase,
    private readonly _rejeter: RejeterOnboardingUseCase,
    private readonly prisma: PrismaClient,
  ) {}

  // POST /api/v2/eleve-onboarding
  creer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const createdById = req.user!.userId;
      const { nomProvisoire, classId, contactEmail, contactTelephone, recipientType, sourceType, examCandidateId } = req.body as {
        nomProvisoire?: string; classId?: string; contactEmail?: string; contactTelephone?: string;
        recipientType?: 'ELEVE' | 'PARENT' | 'LES_DEUX'; sourceType?: 'IMPORT_MASSE' | 'AUTOSERVICE' | 'CONCOURS'; examCandidateId?: string;
      };
      if (!nomProvisoire?.trim()) {
        res.status(400).json({ success: false, message: 'nomProvisoire requis' });
        return;
      }

      const result = await this._creerSquelette.execute({
        schoolId, createdById, nomProvisoire, classId, contactEmail, contactTelephone, recipientType, sourceType, examCandidateId,
      });
      res.json({ success: true, data: result });
      void notifierOnboardingLienCree(this.prisma, schoolId, nomProvisoire, result);
    } catch (err) { next(err); }
  };

  // GET /api/v2/eleve-onboarding/token/:token — public, protégé par le token lui-même
  getByToken = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const token = String(req.params['token']);
      const onboarding = await (this.prisma as any).studentOnboarding.findUnique({
        where: { token },
        include: { classe: { select: { name: true, level: true } } },
      });

      if (!onboarding) {
        res.status(404).json({ success: false, message: 'Lien invalide' });
        return;
      }
      if (onboarding.tokenUsedAt) {
        res.status(410).json({ success: false, message: 'Ce lien a déjà été utilisé' });
        return;
      }
      if (onboarding.tokenExpiresAt.getTime() < Date.now()) {
        if (onboarding.status !== 'EXPIRED') {
          await (this.prisma as any).studentOnboarding.update({ where: { id: onboarding.id }, data: { status: 'EXPIRED' } });
        }
        res.status(410).json({ success: false, message: 'Ce lien a expiré — demandez à votre établissement de le renvoyer' });
        return;
      }
      if (onboarding.status !== 'LINK_SENT') {
        res.status(409).json({ success: false, message: `Ce dossier n'est plus en attente de saisie (statut : ${onboarding.status})` });
        return;
      }

      res.json({
        success: true,
        data: {
          nomProvisoire: onboarding.nomProvisoire,
          classeSuggeree: onboarding.classe ? { name: onboarding.classe.name, level: onboarding.classe.level } : null,
          recipientType: onboarding.recipientType,
          sourceType: onboarding.sourceType,
        },
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Lien invalide' });
    }
  };

  // POST /api/v2/eleve-onboarding/token/:token/submit — public, protégé par le token lui-même
  soumettre = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const token = String(req.params['token']);
      const { nom, prenom, dateNaissance, ...donneesComplementaires } = req.body as {
        nom?: string; prenom?: string; dateNaissance?: string; [key: string]: unknown;
      };
      if (!nom?.trim() || !prenom?.trim()) {
        res.status(400).json({ success: false, message: 'nom et prénom requis' });
        return;
      }

      const result = await this._soumettreFormulaire.execute({ token, nom, prenom, dateNaissance, donneesComplementaires });
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Soumission impossible' });
    }
  };

  // GET /api/v2/eleve-onboarding?status=PENDING_VALIDATION
  lister = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const status = req.query['status'] as string | undefined;
      const dossiers = await (this.prisma as any).studentOnboarding.findMany({
        where: { schoolId, ...(status ? { status } : {}) },
        include: { classe: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      res.json({ success: true, data: dossiers });
    } catch (err) { next(err); }
  };

  // POST /api/v2/eleve-onboarding/:id/validate
  valider = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const validatedById = req.user!.userId;
      const validatorRole = req.user!.role;
      const onboardingId = String(req.params['id']);
      const { classId } = req.body as { classId?: string };

      const result = await this._valider.execute({ schoolId, onboardingId, validatedById, validatorRole, classId });
      res.json({ success: true, data: result });
      void notifierOnboardingValidation(this.prisma, schoolId, result);
    } catch (err) { next(err); }
  };

  // POST /api/v2/eleve-onboarding/:id/reject
  rejeter = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const rejectedById = req.user!.userId;
      const validatorRole = req.user!.role;
      const onboardingId = String(req.params['id']);
      const { rejectionReason } = req.body as { rejectionReason?: string };
      if (!rejectionReason?.trim()) {
        res.status(400).json({ success: false, message: 'rejectionReason requis' });
        return;
      }

      const result = await this._rejeter.execute({ schoolId, onboardingId, rejectedById, validatorRole, rejectionReason });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // GET /api/v2/eleve-onboarding/settings
  getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const settings = await (this.prisma as any).schoolOnboardingSettings.findUnique({ where: { schoolId } });
      res.json({
        success: true,
        data: settings ?? {
          schoolId, selfServiceEnabled: false, defaultRecipient: 'ELEVE', ageThresholdForParent: 15,
          tokenExpiryDays: 14, reminderDelayDays: [3, 7], escalationDelayDays: 10, responsableRole: 'ADMIN',
        },
      });
    } catch (err) { next(err); }
  };

  // PATCH /api/v2/eleve-onboarding/settings
  updateSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const { selfServiceEnabled, defaultRecipient, ageThresholdForParent, tokenExpiryDays, reminderDelayDays, escalationDelayDays, responsableRole } = req.body as {
        selfServiceEnabled?: boolean; defaultRecipient?: 'ELEVE' | 'PARENT' | 'LES_DEUX'; ageThresholdForParent?: number;
        tokenExpiryDays?: number; reminderDelayDays?: number[]; escalationDelayDays?: number; responsableRole?: 'ADMIN' | 'STAFF';
      };

      const data = {
        ...(selfServiceEnabled !== undefined && { selfServiceEnabled }),
        ...(defaultRecipient !== undefined && { defaultRecipient }),
        ...(ageThresholdForParent !== undefined && { ageThresholdForParent }),
        ...(tokenExpiryDays !== undefined && { tokenExpiryDays }),
        ...(reminderDelayDays !== undefined && { reminderDelayDays }),
        ...(escalationDelayDays !== undefined && { escalationDelayDays }),
        ...(responsableRole !== undefined && { responsableRole }),
      };

      const settings = await (this.prisma as any).schoolOnboardingSettings.upsert({
        where: { schoolId },
        create: { schoolId, ...data },
        update: data,
      });
      res.json({ success: true, data: settings });
    } catch (err) { next(err); }
  };

  // POST /api/v2/eleve-onboarding/:id/resend-link
  renvoyerLien = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const createdById = req.user!.userId;
      const onboardingId = String(req.params['id']);

      const existing = await (this.prisma as any).studentOnboarding.findFirst({ where: { id: onboardingId, schoolId } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'Dossier introuvable' });
        return;
      }
      if (!['LINK_SENT', 'EXPIRED'].includes(existing.status)) {
        res.status(409).json({ success: false, message: `Impossible de renvoyer un lien pour un dossier au statut ${existing.status}` });
        return;
      }

      // Invalide l'ancien dossier et en recrée un neuf avec un nouveau token (même
      // squelette) — plus simple et plus sûr qu'une mutation en place du token existant.
      await (this.prisma as any).studentOnboarding.update({ where: { id: existing.id }, data: { status: 'EXPIRED' } });
      const result = await this._creerSquelette.execute({
        schoolId, createdById,
        nomProvisoire: existing.nomProvisoire,
        classId: existing.classId,
        contactEmail: existing.contactEmail,
        contactTelephone: existing.contactTelephone,
        recipientType: existing.recipientType,
        sourceType: existing.sourceType,
        examCandidateId: existing.examCandidateId,
      });
      res.json({ success: true, data: result });
      void notifierOnboardingLienCree(this.prisma, schoolId, existing.nomProvisoire, result);
    } catch (err) { next(err); }
  };
}
