import type { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import type { PrismaClient } from '@prisma/client';
import { AnalyserDiplomeUseCase } from '@application/hr/AnalyserDiplomeUseCase';

/**
 * Préfixe /api/v2/hr-self-service. Contrairement à HRController (/api/v2/hr, réservé
 * ADMIN/STAFF), ces routes sont ouvertes à TOUT employé authentifié (ADMIN/STAFF/TEACHER)
 * mais SCOPÉES à req.user!.userId — jamais un :id de paramètre — pour qu'un employé ne
 * puisse jamais lire ou modifier la fiche d'un autre.
 *
 * Motivation : le module RH était ~10% complet (saisie 100% admin, aucun accès employé) et
 * les déclarations statistiques MINESEC/MINEDUB ont révélé des gaps concrets (sexe absent,
 * diplômes en texte libre non vérifiable) que seul l'employé concerné peut renseigner
 * fiablement — voir conversation du 13/07/2026.
 */
const DOCUMENTS_DIR = path.resolve(process.cwd(), 'storage', 'hr-documents');
const ALLOWED_DOCUMENT_TYPES = ['DIPLOME_ACADEMIQUE', 'DIPLOME_PROFESSIONNEL', 'PIECE_IDENTITE', 'AUTRE'] as const;

export class HRSelfServiceController {
  private readonly analyserDiplome = new AnalyserDiplomeUseCase();

  constructor(private readonly prisma: PrismaClient) {}

  // GET /api/v2/hr-self-service/me
  getMyFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const file = await (this.prisma as any).employeeFile.findUnique({ where: { userId } });
      res.json({ success: true, data: file });
    } catch (err) { next(err); }
  };

  // PATCH /api/v2/hr-self-service/me
  updateMyFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const schoolId = req.user!.schoolId;
      const body = req.body as Record<string, unknown>;

      const allowedKeys = ['dateNaissance', 'gender', 'diplomes', 'numeroCNPS', 'typeContrat', 'echelonActuel'];
      const data: Record<string, unknown> = {};
      for (const key of allowedKeys) if (key in body) data[key] = body[key];
      if (typeof data.dateNaissance === 'string') data.dateNaissance = new Date(data.dateNaissance);
      // dateEmbauche et schoolId délibérément exclus des champs self-service : décision RH
      // administrative, pas une donnée personnelle que l'employé doit pouvoir modifier lui-même.

      if (body['confirmComplete'] === true) data.selfServiceCompletedAt = new Date();

      const file = await (this.prisma as any).employeeFile.upsert({
        where: { userId },
        create: { userId, schoolId, ...data },
        update: data,
      });
      res.json({ success: true, data: file });
    } catch (err) { next(err); }
  };

  // POST /api/v2/hr-self-service/me/document  (multipart, champ "file" + "type" + "label")
  uploadMyDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const schoolId = req.user!.schoolId;
      const file = (req as any).file as Express.Multer.File | undefined;
      const { type, label } = req.body as { type?: string; label?: string };

      if (!file) { res.status(400).json({ success: false, message: 'Aucun fichier reçu' }); return; }
      if (!type || !ALLOWED_DOCUMENT_TYPES.includes(type as any)) {
        res.status(400).json({ success: false, message: 'Type de document invalide' }); return;
      }

      const userDir = path.join(DOCUMENTS_DIR, userId);
      fs.mkdirSync(userDir, { recursive: true });
      const safeExt = path.extname(file.originalname).toLowerCase();
      const fileName = `${type}-${Date.now()}${safeExt}`;
      const filePath = path.join(userDir, fileName);
      fs.writeFileSync(filePath, file.buffer);

      const existing = await (this.prisma as any).employeeFile.findUnique({ where: { userId } });
      const documents = Array.isArray(existing?.documentsUrls) ? existing.documentsUrls : [];
      documents.push({ type, label: label || type, url: filePath, uploadedAt: new Date().toISOString() });

      const updated = await (this.prisma as any).employeeFile.upsert({
        where: { userId },
        create: { userId, schoolId, documentsUrls: documents },
        update: { documentsUrls: documents },
      });
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  };

  // POST /api/v2/hr-self-service/me/analyser-diplome (multipart, champ "file")
  // Analyse IA d'une photo/scan de diplôme pour PRÉ-REMPLIR le formulaire — n'écrit jamais
  // en base elle-même, se contente de suggérer (voir AnalyserDiplomeUseCase).
  analyserDiplomeDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) { res.status(400).json({ success: false, message: 'Aucun fichier reçu' }); return; }
      if (!file.mimetype.startsWith('image/')) {
        res.status(400).json({ success: false, message: "L'analyse IA ne fonctionne que sur une image (JPG/PNG) — pas sur un PDF. Vous pouvez toujours saisir le diplôme manuellement." });
        return;
      }

      const imageBase64 = file.buffer.toString('base64');
      const result = await this.analyserDiplome.execute(imageBase64, file.mimetype);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // GET /api/v2/hr-self-service/me/document/:index/download
  downloadMyDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const index = Number(req.params['index']);
      const file = await (this.prisma as any).employeeFile.findUnique({ where: { userId } });
      const documents = Array.isArray(file?.documentsUrls) ? file.documentsUrls : [];
      const doc = documents[index];
      if (!doc || !fs.existsSync(doc.url)) {
        res.status(404).json({ success: false, message: 'Document introuvable' }); return;
      }
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(doc.url)}"`);
      fs.createReadStream(doc.url).pipe(res);
    } catch (err) { next(err); }
  };
}
