import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { ImporterMatriculesUseCase } from '@application/matricule/ImporterMatriculesUseCase';
import { VerifierMatriculeUseCase } from '@application/matricule/VerifierMatriculeUseCase';
import { SyncFromCarteScolaireUseCase } from '@application/matricule/SyncFromCarteScolaireUseCase';
import { VerifierRecuUseCase } from '@application/matricule/VerifierRecuUseCase';
import { ConfirmerCorrespondanceFuzzyUseCase } from '@application/matricule/ConfirmerCorrespondanceFuzzyUseCase';
import { SignalerErreurCarteScolaireUseCase } from '@application/matricule/SignalerErreurCarteScolaireUseCase';
import { parseMatriculeExcel } from '@application/matricule/parserMatriculeExcel';
import { journaliserActionIA } from '@infrastructure/services/AIActionAuditLogger';
import XLSX from 'xlsx';

export class MatriculeController {
  constructor(
    private readonly _importerMatricules: ImporterMatriculesUseCase,
    private readonly _verifierMatricule: VerifierMatriculeUseCase,
    private readonly _syncFromCarteScolaire: SyncFromCarteScolaireUseCase,
    private readonly _verifierRecu: VerifierRecuUseCase,
    private readonly _confirmerFuzzy: ConfirmerCorrespondanceFuzzyUseCase,
    private readonly _signalerErreur: SignalerErreurCarteScolaireUseCase,
    private readonly prisma: PrismaClient,
  ) {}

  // POST /api/v2/matricules/import
  importMatricules = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const uploadedBy = req.user!.userId;
      const file = req.file as Express.Multer.File;
      if (!file) {
        res.status(400).json({ success: false, message: 'Fichier requis' });
        return;
      }

      const wb = XLSX.read(file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });

      const { format, data, errors: parseErrors } = parseMatriculeExcel(rows);
      if (data.length === 0 && parseErrors.length > 0) {
        res.status(400).json({ success: false, message: parseErrors.join('; ') });
        return;
      }

      const result = await this._importerMatricules.execute(schoolId, data, uploadedBy, file.originalname);
      res.json({ success: true, data: { ...result, format, parseErrors } });
    } catch (err) { next(err); }
  };

  // GET /api/v2/matricules/import-jobs/:schoolId
  listJobs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const jobs = await this.prisma.matriculeImportJob.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      res.json({ success: true, data: jobs });
    } catch (err) { next(err); }
  };

  // GET /api/v2/matricules/import-jobs/:id
  getJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jobId = String(req.params['id']);
      // findFirst et non findUnique : `where` de findUnique n'accepte que des champs uniques,
      // or schoolId ne l'est pas. Un job d'une autre école doit être introuvable, pas seulement
      // interdit — le 404 existant ci-dessous s'en charge, sans message distinct.
      const job = await this.prisma.matriculeImportJob.findFirst({
        where: { id: jobId, schoolId: req.user!.schoolId },
      });
      if (!job) {
        res.status(404).json({ success: false, message: 'Job introuvable' });
        return;
      }
      res.json({ success: true, data: job });
    } catch (err) { next(err); }
  };

  // PATCH /api/v2/students/:id/matricule
  updateMatricule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const studentId = String(req.params['id']);
      const { matricule } = req.body as { matricule: string };
      if (!matricule) {
        res.status(400).json({ success: false, message: 'matricule requis' });
        return;
      }

      const profile = await this.prisma.studentProfile.findFirst({
        where: { id: studentId, user: { schoolId } },
      });
      if (!profile) {
        res.status(404).json({ success: false, message: 'Élève introuvable' });
        return;
      }

      await this.prisma.studentProfile.update({
        where: { id: studentId },
        data: { matricule, matriculeSource: 'MANUAL' },
      });

      res.json({ success: true, message: 'Matricule mis à jour' });
    } catch (err) { next(err); }
  };

  // POST /api/v2/matricules/manual-match
  manualMatch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const { studentProfileId, matricule } = req.body as { studentProfileId: string; matricule: string };
      if (!studentProfileId || !matricule) {
        res.status(400).json({ success: false, message: 'studentProfileId et matricule requis' });
        return;
      }

      const profile = await this.prisma.studentProfile.findFirst({
        where: { id: studentProfileId, user: { schoolId } },
      });
      if (!profile) {
        res.status(404).json({ success: false, message: 'Élève introuvable' });
        return;
      }

      await this.prisma.studentProfile.update({
        where: { id: studentProfileId },
        data: { matricule, matriculeSource: 'MANUAL' },
      });

      res.json({ success: true, message: 'Matricule associé' });
    } catch (err) { next(err); }
  };

  // POST /api/v2/matricules/fuzzy-matches/:jobId/:ligne/confirm
  confirmerFuzzy = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const jobId = String(req.params['jobId']);
      const ligne = Number(req.params['ligne']);
      const result = await this._confirmerFuzzy.execute({ schoolId, jobId, ligne });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // POST /api/v2/matricules/fuzzy-matches/:jobId/:ligne/flag
  signalerErreurFuzzy = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const jobId = String(req.params['jobId']);
      const ligne = Number(req.params['ligne']);
      const result = await this._signalerErreur.execute({ schoolId, jobId, ligne });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // POST /api/v2/matricules/verify/:studentId
  verifierMatricule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const studentId = String(req.params['studentId']);
      const result = await this._verifierMatricule.execute(schoolId, studentId);
      journaliserActionIA(this.prisma, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'verifier_matricule_eleve', targetType: 'User', targetId: studentId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { studentId },
      });
      res.json({ success: true, data: result });
    } catch (err) {
      journaliserActionIA(this.prisma, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'verifier_matricule_eleve', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined, parametersSummary: req.params,
      });
      next(err);
    }
  };

  // POST /api/v2/paiements-minesec/sync/:schoolId
  syncCarteScolaire = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const { anneeScolaire } = req.body as { anneeScolaire: string };
      if (!anneeScolaire) {
        res.status(400).json({ success: false, message: 'anneeScolaire requis' });
        return;
      }
      const report = await this._syncFromCarteScolaire.execute(schoolId, anneeScolaire);
      res.json({ success: true, data: report });
    } catch (err) { next(err); }
  };

  // POST /api/v2/paiements-minesec/:id/verify-recu
  verifierRecu = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const paiementId = String(req.params['id']);
      const { numeroRecu, verifyOnline } = req.body as { numeroRecu: string; verifyOnline?: boolean };
      if (!numeroRecu) {
        res.status(400).json({ success: false, message: 'numeroRecu requis' });
        return;
      }
      const result = await this._verifierRecu.execute(schoolId, paiementId, numeroRecu, verifyOnline);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };
}
