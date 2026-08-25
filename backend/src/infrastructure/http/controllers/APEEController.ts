import type { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import type { PrismaClient } from '@prisma/client';
import { CreerTransactionAPEEUseCase } from '@application/apee/CreerTransactionAPEEUseCase';
import { ValiderDepenseAPEEUseCase } from '@application/apee/ValiderDepenseAPEEUseCase';
import { journaliserActionIA } from '@infrastructure/services/ai/AIActionAuditLogger';
import { PrismaApeeRepository } from '@infrastructure/persistence/prisma/PrismaApeeRepository';
import { generateRapportAPEEPdf } from '../../pdf/apee/ApeeReportPdfRenderer';

const JUSTIFICATIFS_DIR = path.resolve(process.cwd(), 'storage', 'apee-justificatifs');

/**
 * Préfixe /api/v2/apee (MODULE 7/11, chantier Transparence APEE — Juillet 2026). Registre
 * consultable par l'Intendant (saisie + upload + validation) et par le Parent (lecture seule,
 * anonymisée : le parent ne voit jamais qui a créé/validé une transaction, seulement les
 * montants/catégories/dates — voir `list` et `solde` ci-dessous).
 */
export class APEEController {
  private readonly creerTransaction: CreerTransactionAPEEUseCase;
  private readonly validerDepense: ValiderDepenseAPEEUseCase;

  constructor(private readonly prisma: PrismaClient) {
    const apeeRepository = new PrismaApeeRepository(prisma);
    this.creerTransaction = new CreerTransactionAPEEUseCase(apeeRepository);
    this.validerDepense = new ValiderDepenseAPEEUseCase(apeeRepository);
  }

  // POST /api/v2/apee/transactions
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const body = req.body as { type?: 'COLLECTE' | 'DEPENSE'; montant?: number; categorie?: string; description?: string; date?: string };

      if (!body.type || !['COLLECTE', 'DEPENSE'].includes(body.type)) {
        res.status(400).json({ success: false, message: 'type doit être COLLECTE ou DEPENSE' });
        return;
      }
      if (typeof body.montant !== 'number' || body.montant <= 0) {
        res.status(400).json({ success: false, message: 'montant doit être un nombre strictement positif' });
        return;
      }

      const transaction = await this.creerTransaction.execute({
        schoolId,
        creeParId: req.user!.userId,
        type: body.type,
        montant: body.montant,
        categorie: body.categorie,
        description: body.description,
        date: body.date ? new Date(body.date) : undefined,
      });

      journaliserActionIA(this.prisma, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'enregistrer_transaction_apee', targetType: 'APEETransaction', targetId: transaction.id,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: body,
      });
      res.status(201).json({ success: true, data: transaction });
    } catch (error) {
      journaliserActionIA(this.prisma, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'enregistrer_transaction_apee', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      next(error);
    }
  };

  // GET /api/v2/apee/transactions
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const isParent = req.user!.role === 'PARENT';

      const transactions = await this.prisma.aPEETransaction.findMany({
        where: { schoolId },
        orderBy: { date: 'desc' },
        include: isParent ? undefined : {
          creePar: { select: { firstName: true, lastName: true } },
          validePar: { select: { firstName: true, lastName: true } },
        },
      });

      // Vue parent anonymisée : jamais l'identité de qui a créé/validé, seulement l'opération.
      const data = isParent
        ? transactions.map((t: any) => ({
            id: t.id, type: t.type, montant: t.montant, categorie: t.categorie,
            description: t.description, date: t.date, valide: t.valide,
          }))
        : transactions;

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/apee/transactions/:id/justificatif (multipart, champ "file")
  uploadJustificatif = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const transactionId = String(req.params['id']);
      const file = req.file as Express.Multer.File | undefined;

      if (!file) { res.status(400).json({ success: false, message: 'Aucun fichier reçu' }); return; }

      const transaction = await this.prisma.aPEETransaction.findFirst({ where: { id: transactionId, schoolId } });
      if (!transaction) { res.status(404).json({ success: false, message: 'Transaction introuvable' }); return; }
      if (transaction.type !== 'DEPENSE') {
        res.status(400).json({ success: false, message: 'Seule une dépense peut recevoir un justificatif' });
        return;
      }

      const schoolDir = path.join(JUSTIFICATIFS_DIR, schoolId);
      fs.mkdirSync(schoolDir, { recursive: true });
      const safeExt = path.extname(file.originalname).toLowerCase();
      const fileName = `${transactionId}-${Date.now()}${safeExt}`;
      const filePath = path.join(schoolDir, fileName);
      fs.writeFileSync(filePath, file.buffer);

      const updated = await this.prisma.aPEETransaction.update({
        where: { id: transactionId },
        data: { justificatifUrl: filePath },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/apee/transactions/:id/valider
  valider = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const transactionId = String(req.params['id']);

      const transaction = await this.validerDepense.execute({
        schoolId,
        transactionId,
        valideParId: req.user!.userId,
      });

      journaliserActionIA(this.prisma, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'valider_depense_apee', targetType: 'APEETransaction', targetId: transactionId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { transactionId },
      });
      res.json({ success: true, data: transaction });
    } catch (error) {
      journaliserActionIA(this.prisma, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'valider_depense_apee', targetType: 'APEETransaction', targetId: String(req.params['id']),
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.params,
      });
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  // GET /api/v2/apee/solde
  solde = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;

      const [collectes, depensesValidees, depensesEnAttente] = await Promise.all([
        this.prisma.aPEETransaction.aggregate({ where: { schoolId, type: 'COLLECTE' }, _sum: { montant: true } }),
        this.prisma.aPEETransaction.aggregate({ where: { schoolId, type: 'DEPENSE', valide: true }, _sum: { montant: true } }),
        this.prisma.aPEETransaction.count({ where: { schoolId, type: 'DEPENSE', valide: false } }),
      ]);

      const totalCollectes = collectes._sum.montant ?? 0;
      const totalDepenses = depensesValidees._sum.montant ?? 0;

      journaliserActionIA(this.prisma, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'solde_apee', origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: {},
      });
      res.json({
        success: true,
        data: {
          totalCollectes,
          totalDepenses,
          solde: totalCollectes - totalDepenses,
          depensesEnAttenteDeJustificatifOuValidation: depensesEnAttente,
        },
      });
    } catch (error) {
      journaliserActionIA(this.prisma, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'solde_apee', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: {},
      });
      next(error);
    }
  };

  // GET /api/v2/apee/rapport.pdf
  rapportPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } });

      const transactions = await this.prisma.aPEETransaction.findMany({
        where: { schoolId },
        orderBy: { date: 'asc' },
      });

      const totalCollectes = transactions.filter((t: any) => t.type === 'COLLECTE').reduce((s: number, t: any) => s + t.montant, 0);
      const totalDepenses = transactions.filter((t: any) => t.type === 'DEPENSE' && t.valide).reduce((s: number, t: any) => s + t.montant, 0);

      const pdf = await generateRapportAPEEPdf({
        schoolName: school?.name ?? 'ZekoulABia',
        periodeLabel: `Année scolaire ${new Date().getFullYear()}`,
        transactions,
        totalCollectes,
        totalDepenses,
        solde: totalCollectes - totalDepenses,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="rapport-apee.pdf"');
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  };
}
