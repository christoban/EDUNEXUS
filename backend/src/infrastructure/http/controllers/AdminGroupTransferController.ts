import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { ListerDemandesTransfertEntrantesUseCase } from '../../../application/schoolGroup/ListerDemandesTransfertEntrantesUseCase';
import { AccepterTransfertEleveUseCase } from '../../../application/schoolGroup/AccepterTransfertEleveUseCase';
import { AccepterTransfertEnseignantUseCase } from '../../../application/schoolGroup/AccepterTransfertEnseignantUseCase';
import { RejeterTransfertGroupeUseCase } from '../../../application/schoolGroup/RejeterTransfertGroupeUseCase';
import { notifierOnboardingLienCree } from '../../../utils/onboardingNotifications';
import { sendTransactionalEmail } from '../../services/email/EmailService.ts';

export class AdminGroupTransferController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly listerEntrantesUseCase: ListerDemandesTransfertEntrantesUseCase,
    private readonly accepterEleveUseCase: AccepterTransfertEleveUseCase,
    private readonly accepterEnseignantUseCase: AccepterTransfertEnseignantUseCase,
    private readonly rejeterUseCase: RejeterTransfertGroupeUseCase,
  ) {}

  listerEntrantes = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const data = await this.listerEntrantesUseCase.execute(schoolId);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Erreur' });
    }
  };

  accepter = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const demandeId = String(req.params.id);

      const demande = await this.prisma.groupTransferRequest.findUnique({ where: { id: demandeId } });
      if (!demande) { res.status(404).json({ success: false, message: 'Demande introuvable' }); return; }

      if (demande.type === 'STUDENT') {
        const onboarding = await this.accepterEleveUseCase.execute({
          demandeId, targetSchoolId: schoolId, acceptedById: req.user!.userId,
        });
        res.json({ success: true, data: onboarding });
        void notifierOnboardingLienCree(this.prisma, schoolId, onboarding.nomProvisoire, onboarding).catch((err) =>
          console.error('[AdminGroupTransfer] notification onboarding:', err?.message));
      } else {
        const resultat = await this.accepterEnseignantUseCase.execute({ demandeId, targetSchoolId: schoolId });
        res.json({ success: true, data: resultat });

        const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } });
        const schoolName = school?.name ?? 'votre nouvel établissement';
        const frontendUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
        const jwt = await import('jsonwebtoken');
        const inviteToken = jwt.default.sign(
          { sub: resultat.userId, email: resultat.email, schoolId, type: 'user_invite' },
          process.env.JWT_SECRET!,
          { expiresIn: '7d' },
        );
        const inviteUrl = `${frontendUrl}/invite/set-password?token=${inviteToken}`;
        void sendTransactionalEmail({
          recipientEmail: resultat.email,
          subject: `ZekoulABia — Créez votre mot de passe · ${schoolName}`,
          html: `<p>Bonjour ${resultat.firstName},</p><p>Suite à votre transfert, vous rejoignez <strong>${schoolName}</strong> sur ZekoulABia. Cliquez sur le lien ci-dessous pour créer votre mot de passe :</p><p><a href="${inviteUrl}">${inviteUrl}</a></p><p>Ce lien expire dans 7 jours.</p>`,
          template: 'user_invitation',
          eventType: 'user_invite',
          metadata: { schoolId },
        }).catch((err) => console.error('[AdminGroupTransfer] invite email enseignant:', err?.message));
      }
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Erreur' });
    }
  };

  rejeter = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const demandeId = String(req.params.id);
      const data = await this.rejeterUseCase.execute({ demandeId, targetSchoolId: schoolId });
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Erreur' });
    }
  };
}
