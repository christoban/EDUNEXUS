import type { Request, Response, NextFunction } from 'express';
import type { ConnecterUtilisateurUseCase } from '@application/user/ConnecterUtilisateurUseCase';
import type { InscrireUtilisateurUseCase } from '@application/user/InscrireUtilisateurUseCase';
import type { RafraichirTokenUseCase } from '@application/user/RafraichirTokenUseCase';
import type { DeconnecterUtilisateurUseCase } from '@application/user/DeconnecterUtilisateurUseCase';
import type { ModifierUtilisateurUseCase } from '@application/user/ModifierUtilisateurUseCase';
import type { SupprimerUtilisateurUseCase } from '@application/user/SupprimerUtilisateurUseCase';
import type { TransfererEleveUseCase } from '@application/user/TransfererEleveUseCase';
import type { DesignerAPUseCase } from '@application/user/DesignerAPUseCase';
import type { ImporterUtilisateursUseCase } from '@application/user/ImporterUtilisateursUseCase';
import type { TokenService } from '@domain/ports/services/TokenService';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import * as XLSX from 'xlsx';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export class UserController {
  constructor(
    private readonly connecter: ConnecterUtilisateurUseCase,
    private readonly inscrire: InscrireUtilisateurUseCase,
    private readonly rafraichir: RafraichirTokenUseCase,
    private readonly deconnecter: DeconnecterUtilisateurUseCase,
    private readonly modifier: ModifierUtilisateurUseCase,
    private readonly supprimer: SupprimerUtilisateurUseCase,
    private readonly transferer: TransfererEleveUseCase,
    private readonly tokenService: TokenService,
    private readonly schoolRepository: SchoolRepository,
    private readonly designerAP: DesignerAPUseCase,
    private readonly importer: ImporterUtilisateursUseCase,
  ) {}

  // POST /api/v2/auth/login
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password, subdomain, role } = req.body;
      if (!email || !password || !subdomain) {
        res.status(400).json({ success: false, message: 'email, password et subdomain requis' });
        return;
      }

      const school = await this.schoolRepository.findBySubdomain(subdomain);
      if (!school) {
        res.status(404).json({ success: false, message: 'Établissement introuvable' });
        return;
      }

      const resultat = await this.connecter.execute({
        email,
        plainPassword: password,
        schoolId: school.id,
        role: role || undefined,
      });

      res.cookie('access_token', resultat.accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 15 * 60 * 1000,
      });
      res.cookie('refresh_token', resultat.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
        success: true,
        data: {
          userId: resultat.userId,
          role: resultat.role,
          permissions: resultat.permissions,
          nomComplet: resultat.nomComplet,
          roleMismatch: resultat.roleMismatch ?? false,
        },
      });
    } catch (error) {
      // Cas multi-rôles : l'utilisateur doit choisir son rôle parmi les disponibles
      if (error instanceof Error && error.message === 'ROLE_MISMATCH_MULTIPLE') {
        res.status(422).json({
          success: false,
          code: 'ROLE_MISMATCH_MULTIPLE',
          message: 'Le rôle sélectionné ne correspond à aucun compte dans cet établissement.',
          availableRoles: (error as any).availableRoles as string[],
        });
        return;
      }
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/auth/logout
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (user?.userId) {
        await this.deconnecter.execute(user.userId);
      }
      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/' });
      res.json({ success: true, message: 'Déconnecté avec succès' });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/auth/refresh
  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies?.refresh_token;
      if (!refreshToken) {
        res.status(401).json({ success: false, message: 'Token de rafraîchissement manquant' });
        return;
      }

      const payload = this.tokenService.verifierRefreshToken(refreshToken) as any;
      const tokens = await this.rafraichir.execute(payload);

      res.cookie('access_token', tokens.accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 15 * 60 * 1000,
      });
      res.cookie('refresh_token', tokens.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({ success: true, message: 'Tokens rafraîchis' });
    } catch (error) {
      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/' });
      res.status(401).json({ success: false, message: 'Session expirée — reconnectez-vous' });
    }
  };

  // POST /api/v2/users
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(req.body.password || 'Edunexus2025!', 10);

      const resultat = await this.inscrire.execute({
        schoolId: user.schoolId,
        ...req.body,
        passwordHash,
      });

      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // PUT /api/v2/users/:id
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      let passwordHash: string | undefined;

      if (req.body.password) {
        const bcrypt = await import('bcryptjs');
        passwordHash = await bcrypt.hash(req.body.password, 10);
      }

      await this.modifier.execute({
        cibleUserId: req.params.id as string,
        demandeurId: user.userId,
        demandeurRole: user.role,
        schoolId: user.schoolId,
        ...req.body,
        passwordHash,
      });

      res.json({ success: true, message: 'Utilisateur mis à jour' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // DELETE /api/v2/users/:id
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      await this.supprimer.execute({
        userId: req.params.id as string,
        schoolId: user.schoolId,
        demandeurRole: user.role,
      });
      res.json({ success: true, message: 'Utilisateur supprimé' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/students/:id/transfer
  transfer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { fromClasseId, toClasseId } = req.body;

      if (!fromClasseId || !toClasseId) {
        res.status(400).json({ success: false, message: 'fromClasseId et toClasseId requis' });
        return;
      }

      await this.transferer.execute({
        studentId: req.params.id as string,
        fromClasseId,
        toClasseId,
        schoolId: user.schoolId,
        demandeurId: user.userId,
      });

      res.json({ success: true, message: 'Élève transféré avec succès' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/users/import
  importUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const role = req.body.role as string;
      const file = (req as any).file as Express.Multer.File | undefined;

      if (!file) {
        res.status(400).json({ success: false, message: 'Fichier requis (.xlsx ou .xls)' });
        return;
      }
      if (role !== 'STUDENT' && role !== 'TEACHER') {
        res.status(400).json({ success: false, message: "role doit être 'STUDENT' ou 'TEACHER'" });
        return;
      }

      const wb = XLSX.read(file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rowsJson = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });

      const rows = rowsJson.map((r, i) => ({
        ligne: i + 2,
        nom: String(r.nom || '').trim(),
        prenom: String(r.prenom || '').trim(),
        email: String(r.email || '').trim(),
        telephone: String(r.telephone || '').trim(),
        matricule: String(r.matricule || '').trim(),
        dateNaissance: String(r.date_naissance || '').trim(),
        classe: String(r.classe || '').trim(),
        emailParent: String(r.email_parent || '').trim(),
        telephoneParent: String(r.telephone_parent || '').trim(),
        matieres: String(r.matieres || '').trim(),
      }));

      if (rows.length === 0) {
        res.status(400).json({ success: false, message: 'Aucune ligne trouvée dans le fichier' });
        return;
      }

      const resultat = await this.importer.execute(user.schoolId, rows, role as 'STUDENT' | 'TEACHER');

      res.json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // PATCH /api/v2/users/:id/ap-designation
  apDesignation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { departmentSubjectIds, action } = req.body as {
        departmentSubjectIds?: string[];
        action?: string;
      };

      if (action !== 'ASSIGN' && action !== 'REMOVE') {
        res.status(400).json({ success: false, message: "action doit être 'ASSIGN' ou 'REMOVE'" });
        return;
      }
      if (!Array.isArray(departmentSubjectIds)) {
        res.status(400).json({ success: false, message: 'departmentSubjectIds (tableau) requis' });
        return;
      }

      await this.designerAP.execute({
        userId: req.params.id as string,
        schoolId: user.schoolId,
        demandeurRole: user.role,
        departmentSubjectIds,
        action,
      });

      const msg = action === 'ASSIGN'
        ? 'Enseignant désigné Animateur Pédagogique avec succès'
        : 'Désignation AP retirée avec succès';
      res.json({ success: true, message: msg });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof Error) {
      if (error.message.includes('existe déjà')) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('incorrect') || error.message.includes('expirée')) {
        res.status(401).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('refusée') || error.message.includes('Permission')) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }
}
