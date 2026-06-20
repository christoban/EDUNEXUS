import type { Request, Response, NextFunction } from 'express';
import type { CreerPlanFraisUseCase } from '@application/finance/CreerPlanFraisUseCase';
import type { GenererFactureUseCase } from '@application/finance/GenererFactureUseCase';
import type { GenererFacturesEnMasseUseCase } from '@application/finance/GenererFacturesEnMasseUseCase';
import type { InitierPaiementMobileMoneyUseCase } from '@application/finance/InitierPaiementMobileMoneyUseCase';
import type { TraiterWebhookCampayUseCase } from '@application/finance/TraiterWebhookCampayUseCase';
import type { RembourserCautionUseCase } from '@application/finance/RembourserCautionUseCase';
import type { EnregistrerDepenseUseCase } from '@application/finance/EnregistrerDepenseUseCase';
import type { EnregistrerPaiementCashUseCase } from '@application/finance/EnregistrerPaiementCashUseCase';
import { SeuilLegalDepasseError } from '@domain/errors/SeuilLegalDepasseError';
import { SeparationOrdonnateurError } from '@domain/errors/SeparationOrdonnateurError';
import type { PaymentMethod } from '@domain/types/enums';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { notifyPaymentSms } from '@infrastructure/services/SmsNotificationService';

export class FinanceController {
  constructor(
    private readonly creerPlanFrais: CreerPlanFraisUseCase,
    private readonly genererFacture: GenererFactureUseCase,
    private readonly genererFacturesEnMasse: GenererFacturesEnMasseUseCase,
    private readonly initierPaiement: InitierPaiementMobileMoneyUseCase,
    private readonly traiterWebhook: TraiterWebhookCampayUseCase,
    private readonly rembourserCaution: RembourserCautionUseCase,
    private readonly enregistrerDepense: EnregistrerDepenseUseCase,
    private readonly enregistrerPaiementCash: EnregistrerPaiementCashUseCase,
  ) {}

  // POST /api/v2/finance/fee-plans
  creerPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const resultat = await this.creerPlanFrais.execute({
        schoolId: user.schoolId,
        demandeurRole: user.role,
        ...req.body,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/finance/invoices
  creerFacture = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { studentId, feePlanId, description } = req.body;

      if (!studentId || !feePlanId) {
        res.status(400).json({ success: false, message: 'studentId et feePlanId requis' });
        return;
      }

      const resultat = await this.genererFacture.execute({
        schoolId: user.schoolId,
        studentId,
        feePlanId,
        description,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/finance/invoices/bulk
  creerFacturesEnMasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { feePlanId, classId, studentIds } = req.body;

      if (!feePlanId) {
        res.status(400).json({ success: false, message: 'feePlanId requis' });
        return;
      }

      const resultat = await this.genererFacturesEnMasse.execute({
        schoolId: user.schoolId,
        feePlanId,
        classId,
        studentIds,
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/finance/payments/mobile
  initierPaiementMobile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { factureId, studentId, phoneNumber, method } = req.body;

      if (!factureId || !phoneNumber || !method) {
        res.status(400).json({
          success: false,
          message: 'factureId, phoneNumber et method requis',
        });
        return;
      }

      const digits = phoneNumber.replace(/[\s+]/g, '');
      const numeroNormalise = digits.startsWith('237') ? digits : `237${digits}`;

      const resultat = await this.initierPaiement.execute({
        schoolId: user.schoolId,
        factureId,
        studentId,
        phoneNumber: numeroNormalise,
        method: method as PaymentMethod,
      });

      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/finance/payments/webhook/campay
  // Pas de middleware auth — appelée directement par Campay
  webhookCampay = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { reference, status, amount, operator, phone_number } = req.body;

      if (!reference) {
        res.status(400).json({ success: false, message: 'reference manquante' });
        return;
      }

      await this.traiterWebhook.execute({
        campayRef: reference,
        statut: status === 'SUCCESSFUL' ? 'SUCCESS' : 'FAILED',
        montant: amount ?? 0,
        telephone: phone_number ?? '',
        operateurRef: operator,
        donneesRaw: req.body,
      });

      // Campay attend un 200 pour ne pas retenter l'envoi
      res.status(200).json({ success: true });

      // Fire-and-forget SMS confirmation paiement — jamais bloquant
      if (status === 'SUCCESSFUL') {
        void (async () => {
          try {
            const payment = await prisma.payment.findFirst({
              where: { campayRef: reference },
              include: { student: { select: { id: true, firstName: true, lastName: true } } },
            })
            if (!payment) return
            await notifyPaymentSms({
              schoolId: payment.schoolId,
              studentId: payment.studentId,
              studentName: `${payment.student?.firstName ?? ''} ${payment.student?.lastName ?? ''}`.trim(),
              amount: payment.amount,
              parentPhone: phone_number ?? payment.phoneNumber ?? undefined,
            })
          } catch (err) {
            console.error('[SMS Payment fire-and-forget]', err)
          }
        })()
      }
    } catch (error) {
      console.error('[Webhook Campay]', error);
      res.status(200).json({ success: false });
    }
  };

  // POST /api/v2/finance/payments/caution/:id/rembourser
  rembourserCautionEleve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { action } = req.body;

      if (!action) {
        res.status(400).json({
          success: false,
          message: 'action requise : REMBOURSER ou RETENIR_DEFINITIVEMENT',
        });
        return;
      }

      await this.rembourserCaution.execute({
        paiementId: req.params.id as string,
        rembourseurId: user.userId,
        schoolId: user.schoolId,
        action,
      });

      res.json({ success: true, message: `Caution : ${action}` });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/finance/expenses
  creerDepense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { label, amount, category, date, ordonnateurId } = req.body;

      if (!label || !amount) {
        res.status(400).json({ success: false, message: 'label et amount requis' });
        return;
      }

      const resultat = await this.enregistrerDepense.execute({
        schoolId: user.schoolId,
        label,
        amount,
        category,
        date: date ? new Date(date) : undefined,
        createdById: user.userId,
        ordonnateurId,
      });

      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/finance/payments/cash
  creerPaiementCash = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { factureId, studentId, montant } = req.body;

      if (!factureId || !studentId || montant == null) {
        res.status(400).json({
          success: false,
          message: 'factureId, studentId et montant requis',
        });
        return;
      }

      const resultat = await this.enregistrerPaiementCash.execute({
        schoolId: user.schoolId,
        factureId,
        studentId,
        montant: Number(montant),
        enregistreurId: user.userId,
      });

      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof SeuilLegalDepasseError) {
      res.status(422).json({
        success: false,
        code: 'SEUIL_LEGAL_DEPASSE',
        message: error.message,
      });
      return;
    }
    if (error instanceof SeparationOrdonnateurError) {
      res.status(403).json({
        success: false,
        code: 'SEPARATION_ORDONNATEUR',
        message: error.message,
      });
      return;
    }
    if (error instanceof Error) {
      if (error.message.includes('déjà en cours')) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('ne peut plus être payée')) {
        res.status(422).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('Permission')) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }
}
