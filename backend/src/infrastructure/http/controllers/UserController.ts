import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
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
    private readonly prisma: PrismaClient,
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
        maxAge: 8 * 60 * 60 * 1000,
      });
      res.cookie('refresh_token', resultat.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      res.json({
        success: true,
        data: {
          userId: resultat.userId,
          role: resultat.role,
          permissions: resultat.permissions,
          nomComplet: resultat.nomComplet,
          roleMismatch: resultat.roleMismatch ?? false,
          redirectTo: resultat.redirectTo ?? null,
        },
      });
    } catch (error) {
      // École suspendue — credentials valides mais accès bloqué
      if (error instanceof Error && (error as any).code === 'SCHOOL_SUSPENDED') {
        res.status(403).json({
          success: false,
          error: 'SCHOOL_SUSPENDED',
          message: 'Votre établissement a été suspendu. Contactez le support EduNexus.',
        });
        return;
      }
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
        maxAge: 8 * 60 * 60 * 1000,
      });
      res.cookie('refresh_token', tokens.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      res.json({ success: true, message: 'Tokens rafraîchis' });
    } catch (error) {
      // Ne pas effacer les cookies sur erreur transitoire (redémarrage backend, réseau)
      // Seul un logout explicite ou un refresh token vraiment expiré mérite un clearCookie
      res.status(401).json({ success: false, message: 'Session expirée — reconnectez-vous' });
    }
  };

  // POST /api/v2/users
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const bcrypt = await import('bcryptjs');
      const isDevMode = process.env.EMAIL_DISABLED === 'true';

      let passwordHash: string;
      if (isDevMode) {
        // Dev : mot de passe fixe — le frontend est ignoré volontairement
        passwordHash = await bcrypt.hash('chris123456789', 10);
      } else {
        // Prod : hash aléatoire — l'utilisateur crée son mot de passe via le lien d'invitation
        const crypto = await import('crypto');
        passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      }

      const resultat = await this.inscrire.execute({
        schoolId: user.schoolId,
        ...req.body,
        passwordHash,
      });

      res.status(201).json({ success: true, data: resultat });

      // Envoi du lien d'invitation (prod uniquement, STAFF/TEACHER avec email)
      const recipientEmail: string | undefined = (req.body.email as string | undefined)?.trim();
      const role: string = req.body.role || '';
      if (!isDevMode && recipientEmail && ['STAFF', 'TEACHER'].includes(role)) {
        (async () => {
          try {
            const jwt = await import('jsonwebtoken');
            const inviteToken = jwt.default.sign(
              { sub: resultat.userId, email: recipientEmail, schoolId: user.schoolId, type: 'user_invite' },
              process.env.JWT_SECRET!,
              { expiresIn: '7d' },
            );

            const school = await this.prisma.school.findUnique({
              where: { id: user.schoolId },
              select: { name: true },
            });
            const schoolName = school?.name ?? 'votre établissement';
            const frontendUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
            const inviteUrl = `${frontendUrl}/invite/set-password?token=${inviteToken}`;

            console.log(`[Invite] Lien d'invitation pour ${recipientEmail}: ${inviteUrl}`);

            const { sendTransactionalEmail } = await import('../../../services/emailService');
            await sendTransactionalEmail({
              recipientEmail,
              subject: `EduNexus — Créez votre mot de passe · ${schoolName}`,
              html: `
                <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
                  <div style="background:#1a2e1e;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
                    <h1 style="color:white;margin:0;font-size:20px;">🎓 EduNexus</h1>
                  </div>
                  <div style="background:#ffffff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e8e0d4;">
                    <h2 style="color:#1a1209;margin-top:0;">Bonjour ${String(req.body.firstName || '').trim()} ${String(req.body.lastName || '').trim()},</h2>
                    <p style="color:#6b5c45;font-size:15px;line-height:1.6;">
                      Vous avez été invité(e) à rejoindre <strong>${schoolName}</strong> sur EduNexus.
                      Cliquez sur le bouton ci-dessous pour créer votre mot de passe et accéder à votre espace.
                    </p>
                    <div style="text-align:center;margin:28px 0 16px;">
                      <a href="${inviteUrl}" style="background:linear-gradient(135deg,#059669,#047857);color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;">
                        🔑 Créer mon mot de passe
                      </a>
                    </div>
                    <p style="color:#a89478;font-size:13px;text-align:center;">Ce lien expire dans 7 jours.</p>
                    <hr style="border:none;border-top:1px solid #e8e0d4;margin:20px 0;" />
                    <p style="color:#a89478;font-size:12px;margin:0;text-align:center;">
                      EduNexus · Plateforme de gestion scolaire · Cameroun
                    </p>
                  </div>
                </div>
              `,
              template: 'user_invitation',
              eventType: 'user_invite',
              metadata: { schoolId: user.schoolId },
            });
          } catch (emailErr) {
            console.error('[Email] Invitation error:', emailErr);
          }
        })();
      }
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // GET /api/v2/users/auth/invite/validate?token=...
  validateInvite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.query.token as string;
      if (!token) {
        res.status(400).json({ success: false, message: 'Token manquant' });
        return;
      }

      const jwt = await import('jsonwebtoken');
      let payload: any;
      try {
        payload = jwt.default.verify(token, process.env.JWT_SECRET!);
      } catch {
        res.status(401).json({ success: false, message: 'Lien invalide ou expiré. Contactez votre administrateur.' });
        return;
      }

      if (payload.type !== 'user_invite') {
        res.status(401).json({ success: false, message: 'Lien invalide.' });
        return;
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub as string },
        select: { id: true, firstName: true, lastName: true, email: true, schoolId: true },
      });
      if (!user) {
        res.status(404).json({ success: false, message: 'Compte introuvable.' });
        return;
      }

      const school = await this.prisma.school.findUnique({
        where: { id: user.schoolId },
        select: { name: true, subdomain: true },
      });

      res.json({
        success: true,
        data: {
          email: user.email || payload.email,
          firstName: user.firstName,
          lastName: user.lastName,
          schoolName: school?.name ?? '',
          subdomain: school?.subdomain ?? '',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/users/auth/invite/complete
  completeInvite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, password, confirmPassword } = req.body as {
        token?: string;
        password?: string;
        confirmPassword?: string;
      };

      if (!token || !password) {
        res.status(400).json({ success: false, message: 'Token et mot de passe requis.' });
        return;
      }
      if (password !== confirmPassword) {
        res.status(400).json({ success: false, message: 'Les mots de passe ne correspondent pas.' });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 8 caractères.' });
        return;
      }

      const jwt = await import('jsonwebtoken');
      let payload: any;
      try {
        payload = jwt.default.verify(token, process.env.JWT_SECRET!);
      } catch {
        res.status(401).json({ success: false, message: 'Lien invalide ou expiré. Contactez votre administrateur.' });
        return;
      }

      if (payload.type !== 'user_invite') {
        res.status(401).json({ success: false, message: 'Lien invalide.' });
        return;
      }

      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 10);

      await this.prisma.user.update({
        where: { id: payload.sub as string },
        data: { passwordHash },
      });

      res.json({ success: true, message: 'Mot de passe créé avec succès. Vous pouvez maintenant vous connecter.' });
    } catch (error) {
      next(error);
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
        nomParent: String(r.nom_parent || '').trim(),
        prenomParent: String(r.prenom_parent || '').trim(),
        emailParent: String(r.email_parent || '').trim(),
        telephoneParent: String(r.telephone_parent || '').trim(),
        matieres: String(r.matieres || '').trim(),
        classePrincipale: String(r.classe_principale || '').trim(),

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
