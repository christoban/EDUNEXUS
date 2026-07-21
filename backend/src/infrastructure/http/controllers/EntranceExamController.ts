import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { CreerSessionConcoursUseCase } from '@application/entranceExam/CreerSessionConcoursUseCase';
import { AjouterCandidatsConcoursUseCase } from '@application/entranceExam/AjouterCandidatsConcoursUseCase';
import { CalculerAdmissionConcoursUseCase } from '@application/entranceExam/CalculerAdmissionConcoursUseCase';
import { EnregistrerResultatCepUseCase } from '@application/entranceExam/EnregistrerResultatCepUseCase';
import { ResumeSessionConcoursUseCase } from '@application/entranceExam/ResumeSessionConcoursUseCase';
import { ScannerListeCandidatsUseCase } from '@application/entranceExam/ScannerListeCandidatsUseCase';
import { DetecterAnomaliesConcoursUseCase } from '@application/entranceExam/DetecterAnomaliesConcoursUseCase';
import { notifyAdmissionProvisoireSms, notifyCepResultSms } from '@infrastructure/services/SmsNotificationService';
import { notifierOnboardingLienCree } from '../../../utils/onboardingNotifications';
import { parseDateFR } from '../../../utils/dateParsing';
import XLSX from 'xlsx';

export class EntranceExamController {
  constructor(
    private readonly _creerSession: CreerSessionConcoursUseCase,
    private readonly _ajouterCandidats: AjouterCandidatsConcoursUseCase,
    private readonly _calculerAdmission: CalculerAdmissionConcoursUseCase,
    private readonly _enregistrerCep: EnregistrerResultatCepUseCase,
    private readonly _resumeSession: ResumeSessionConcoursUseCase,
    private readonly _scannerListe: ScannerListeCandidatsUseCase,
    private readonly _detecterAnomalies: DetecterAnomaliesConcoursUseCase,
    private readonly prisma: PrismaClient,
  ) {}

  // GET /api/v2/entrance-exams — liste des sessions de l'établissement, toutes années/statuts
  lister = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessions = await (this.prisma as any).entranceExamSession.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, data: sessions });
    } catch (err) { next(err); }
  };

  // POST /api/v2/entrance-exams
  creer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const { name, examDate, academicYearId, admissionThreshold, availableSeats } = req.body as any;
      if (!name || !examDate || !academicYearId) {
        res.status(400).json({ success: false, message: 'name, examDate, academicYearId requis' });
        return;
      }
      const result = await this._creerSession.execute({
        schoolId, name, examDate: new Date(examDate), academicYearId,
        admissionThreshold: admissionThreshold ?? undefined,
        availableSeats: availableSeats ?? undefined,
      });
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // POST /api/v2/entrance-exams/:id/candidates
  ajouterCandidats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const { candidats } = req.body as { candidats: any[] };
      if (!candidats || !Array.isArray(candidats)) {
        res.status(400).json({ success: false, message: 'candidats (array) requis' });
        return;
      }
      const result = await this._ajouterCandidats.execute({ schoolId, sessionId, candidats });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // POST /api/v2/entrance-exams/:id/candidates/import
  importCandidats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const file = (req as any).file as Express.Multer.File;
      if (!file) {
        res.status(400).json({ success: false, message: 'Fichier requis' });
        return;
      }

      const wb = XLSX.read(file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });

      const candidats = rows.map(r => ({
        firstName: String(r.prenom || r.firstName || '').trim(),
        lastName: String(r.nom || r.lastName || '').trim(),
        dateOfBirth: parseDateFR(String(r.dateNaissance || r.dateOfBirth || '')) ?? undefined,
        originSchool: String(r.ecoleOrigine || r.originSchool || '').trim() || undefined,
        examScore: r.note || r.examScore ? Number(String(r.note || r.examScore).replace(',', '.')) : undefined,
        parentPhone: String(r.telephoneParent || r.parentPhone || '').trim() || undefined,
      })).filter(c => c.firstName && c.lastName);

      const result = await this._ajouterCandidats.execute({ schoolId, sessionId, candidats });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // POST /api/v2/entrance-exams/:id/compute-admission
  calculer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const result = await this._calculerAdmission.execute({ schoolId, sessionId });
      res.json({ success: true, data: result });
      for (const c of result.admisCandidats) {
        void notifyAdmissionProvisoireSms({
          schoolId, candidateName: `${c.firstName} ${c.lastName}`, parentPhone: c.parentPhone,
        });
      }
    } catch (err) { next(err); }
  };

  // POST /api/v2/entrance-exams/:id/candidates/scan
  scanner = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const { imageBase64, mimeType } = req.body as { imageBase64: string; mimeType?: string };
      if (!imageBase64) {
        res.status(400).json({ success: false, message: 'imageBase64 requis' });
        return;
      }
      const result = await this._scannerListe.execute(schoolId, sessionId, imageBase64, mimeType);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // POST /api/v2/entrance-exams/:id/detect-anomalies
  detecterAnomalies = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const result = await this._detecterAnomalies.execute(schoolId, sessionId);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // PATCH /api/v2/entrance-exams/candidates/:id/cep-result
  enregistrerCep = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const candidateId = String(req.params['id']);
      const { cepResult } = req.body as { cepResult: 'REUSSI' | 'ECHOUE' };
      if (!cepResult || !['REUSSI', 'ECHOUE'].includes(cepResult)) {
        res.status(400).json({ success: false, message: 'cepResult requis (REUSSI ou ECHOUE)' });
        return;
      }
      const enregistreParId = req.user!.userId;
      const result = await this._enregistrerCep.execute({ schoolId, candidateId, cepResult, enregistreParId });
      res.json({ success: true, data: result });
      // SMS distinct de la notification onboarding : celui-ci annonce l'admission (Phase 4 du
      // concours), l'autre (notifierOnboardingLienCree) invite à compléter le dossier — jamais
      // le même message deux fois (règle métier n°6 de la spec onboarding auto-service).
      void notifyCepResultSms({
        schoolId, candidateName: result.candidateName, parentPhone: result.parentPhone, result: cepResult,
      });
      if (result.onboarding) {
        void notifierOnboardingLienCree(this.prisma, schoolId, result.candidateName, result.onboarding);
      }
    } catch (err) { next(err); }
  };

  // GET /api/v2/entrance-exams/:id/summary
  resume = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const result = await this._resumeSession.execute(schoolId, sessionId);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };
}
