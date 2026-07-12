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
import PDFDocument from 'pdfkit';
import { sendTransactionalEmail } from '../../../services/emailService';

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  MTN_MOMO: 'MTN Mobile Money',
  ORANGE_MONEY: 'Orange Money',
  BANK_TRANSFER: 'Virement bancaire',
  EXPRESS_UNION: 'Express Union',
};

async function buildRecuPdf(payment: {
  id: string;
  amount: number;
  method: string;
  paidAt: Date | null;
  createdAt: Date;
  campayRef?: string | null;
  operatorRef?: string | null;
  school?: { name: string } | null;
  student?: {
    firstName: string;
    lastName: string;
    studentProfile?: { matricule?: string | null; class?: { name: string } | null } | null;
  } | null;
  invoice?: {
    amount: number;
    description?: string | null;
    feePlan?: { name: string } | null;
    payments?: { amount: number }[];
  } | null;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const fmt = (v: number) => new Intl.NumberFormat('fr-FR').format(v) + ' XAF';

    const schoolName = payment.school?.name ?? 'ZEKOULABIA';
    const studentName = `${payment.student?.firstName ?? ''} ${payment.student?.lastName ?? ''}`.trim();
    const matricule = payment.student?.studentProfile?.matricule ?? '-';
    const className = payment.student?.studentProfile?.class?.name ?? '-';
    const invoiceLabel = payment.invoice?.feePlan?.name ?? payment.invoice?.description ?? 'Facture';
    const invoiceTotal = payment.invoice?.amount ?? payment.amount;
    const totalPaid = (payment.invoice?.payments ?? []).reduce((s, p) => s + p.amount, 0);
    const soldeRestant = Math.max(0, invoiceTotal - totalPaid);
    const methodLabel = METHOD_LABELS[payment.method] ?? payment.method;

    const shortId = payment.id.slice(-8).toUpperCase();
    const year = new Date(payment.paidAt ?? payment.createdAt).getFullYear();
    const receiptNum = `REC-${year}-${shortId}`;
    const dateStr = new Date(payment.paidAt ?? payment.createdAt).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    doc.fontSize(9).font('Helvetica')
      .text('République du Cameroun  |  Republic of Cameroon', { align: 'center' })
      .text('Paix – Travail – Patrie  |  Peace – Work – Fatherland', { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(14).font('Helvetica-Bold').text(schoolName.toUpperCase(), { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(16).text('REÇU DE PAIEMENT', { align: 'center' });
    doc.fontSize(11).font('Helvetica').text('PAYMENT RECEIPT', { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica-Bold').text(`N° ${receiptNum}`, { align: 'right' });
    doc.font('Helvetica').text(`Date : ${dateStr}`, { align: 'right' });
    doc.moveDown(1);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.7);

    doc.fontSize(10).font('Helvetica-Bold').text('ÉLÈVE / STUDENT');
    doc.font('Helvetica')
      .text(`Nom et prénom : ${studentName}`)
      .text(`Matricule : ${matricule}`)
      .text(`Classe : ${className}`);
    doc.moveDown(1);

    doc.font('Helvetica-Bold').text('OBJET / PURPOSE');
    doc.font('Helvetica')
      .text(`Facture : ${invoiceLabel}`)
      .text(`Mode de paiement : ${methodLabel}`);
    if (payment.campayRef) doc.text(`Réf. Campay : ${payment.campayRef}`);
    if (payment.operatorRef) doc.text(`Réf. Opérateur : ${payment.operatorRef}`);
    doc.moveDown(1);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.7);

    doc.font('Helvetica-Bold').text('MONTANTS / AMOUNTS');
    doc.font('Helvetica').text(`Total facture :              ${fmt(invoiceTotal)}`);
    doc.font('Helvetica-Bold').text(`Montant payé ce jour :       ${fmt(payment.amount)}`);

    if (soldeRestant === 0) {
      doc.fillColor('green').text(`Solde restant :              ${fmt(0)}`);
      doc.moveDown(0.5);
      doc.fontSize(12).text('✓ PAYÉ INTÉGRALEMENT — FULLY PAID', { align: 'center' });
    } else {
      doc.fillColor('red').text(`Solde restant :              ${fmt(soldeRestant)}`);
    }
    doc.fillColor('black').font('Helvetica').fontSize(10);

    doc.moveDown(4);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(9)
      .text('Ce document tient lieu de reçu officiel de paiement.', { align: 'center' })
      .text('This document serves as an official payment receipt.', { align: 'center' });
    doc.moveDown(3);
    doc.fontSize(10).text('Le Responsable financier / Finance Officer', { align: 'right' });
    doc.moveDown(3);
    doc.text('___________________________', { align: 'right' });

    doc.end();
  });
}

async function envoyerRecuParEmail(paymentId: string): Promise<void> {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        student: {
          select: {
            firstName: true, lastName: true, email: true,
            studentProfile: {
              select: { matricule: true, class: { select: { name: true } } },
            },
          },
        },
        invoice: {
          include: {
            feePlan: { select: { name: true } },
            payments: { where: { status: 'SUCCESS' }, select: { amount: true } },
          },
        },
        school: { select: { name: true } },
      },
    });
    if (!payment || !payment.student?.email) return;

    const pdfBuffer = await buildRecuPdf(payment as any);
    const shortId = payment.id.slice(-8).toUpperCase();
    const year = new Date(payment.paidAt ?? payment.createdAt).getFullYear();
    const receiptNum = `REC-${year}-${shortId}`;
    const amountStr = new Intl.NumberFormat('fr-FR').format(payment.amount);
    const schoolName = payment.school?.name ?? 'ZekoulABia';

    await sendTransactionalEmail({
      recipientEmail: payment.student.email,
      subject: `Reçu de paiement ${receiptNum} — ${schoolName}`,
      html: `<p>Bonjour ${payment.student.firstName},</p><p>Veuillez trouver ci-joint votre reçu de paiement de <b>${amountStr} XAF</b>.</p><p>Merci de votre confiance.</p><p><i>${schoolName}</i></p>`,
      text: `Reçu de paiement ${receiptNum} — ${amountStr} XAF`,
      template: 'payment_receipt',
      eventType: 'payment_receipt',
      attachments: [{ filename: `${receiptNum}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
      metadata: { schoolId: payment.schoolId },
    });
  } catch (err) {
    console.error('[Reçu PDF email]', err);
  }
}

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

  // GET /api/v2/finance/payments/:paymentId/receipt
  genererRecu = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const paymentId = req.params.paymentId as string;

      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          student: {
            select: {
              firstName: true, lastName: true, email: true,
              studentProfile: {
                select: { matricule: true, class: { select: { name: true } } },
              },
            },
          },
          invoice: {
            include: {
              feePlan: { select: { name: true } },
              payments: { where: { status: 'SUCCESS' }, select: { amount: true } },
            },
          },
          school: { select: { name: true } },
        },
      });

      if (!payment) {
        res.status(404).json({ success: false, message: 'Paiement introuvable' });
        return;
      }
      if (payment.schoolId !== user.schoolId) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }

      const pdfBuffer = await buildRecuPdf(payment as any);
      const shortId = payment.id.slice(-8).toUpperCase();
      const year = new Date(payment.paidAt ?? payment.createdAt).getFullYear();
      const receiptNum = `REC-${year}-${shortId}`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="recu-${receiptNum}.pdf"`);
      res.end(pdfBuffer);
    } catch (error) {
      next(error);
    }
  };

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

      // Fire-and-forget SMS + reçu PDF — jamais bloquant
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
              parentPhone: phone_number ?? (payment as any).phoneNumber ?? undefined,
            })
            void envoyerRecuParEmail(payment.id)
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

      // Fire-and-forget : envoyer reçu PDF par email
      void envoyerRecuParEmail(resultat.paiementId);
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
